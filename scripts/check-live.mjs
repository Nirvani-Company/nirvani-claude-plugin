#!/usr/bin/env node
// Live contract checks for the public surface this plugin depends on. Node 22, no dependencies.
//
//   node scripts/check-live.mjs
//
// For every server in .mcp.json it proves, without credentials, that:
//   1. an unauthenticated MCP initialize is refused with 401 and a Bearer challenge naming resource metadata;
//   2. the protected resource metadata (RFC 9728) names this exact endpoint, an authorization server and the scopes;
//   3. the authorization server metadata (RFC 8414) supports the code flow with PKCE S256 and a way for Claude
//      to register (dynamic registration or client id metadata documents).
// It also proves every https link in plugin.json and every server-host link in README.md answers 200.
import { readJson, readText, Report } from "./lib.mjs";

const TIMEOUT_MS = 15_000;
const ATTEMPTS = 3;
const USER_AGENT = "nirvani-claude-plugin-ci/1.0 (+https://github.com/Nirvani-Company/nirvani-claude-plugin)";
const report = new Report("Live contract checks");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch with a timeout and retries on network errors and 5xx, never on 4xx. */
async function request(url, init = {}) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        ...init,
        headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status >= 500 && attempt < ATTEMPTS) {
        lastError = new Error(`HTTP ${response.status}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(1000 * 2 ** (attempt - 1));
  }
  throw new Error(`${url} failed after ${ATTEMPTS} attempts: ${lastError?.message ?? "unknown error"}`);
}

async function getJson(url) {
  const response = await request(url, { headers: { accept: "application/json" } });
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${url} did not return JSON`);
  }
}

async function check(name, fn) {
  try {
    const detail = await fn();
    report.pass(name, typeof detail === "string" ? detail : "");
  } catch (error) {
    report.fail(name, error.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Parses resource_metadata and scope out of a WWW-Authenticate Bearer challenge. */
function parseChallenge(header) {
  const params = {};
  for (const match of header.matchAll(/([a-z_]+)="([^"]*)"/gi)) params[match[1].toLowerCase()] = match[2];
  return { scheme: header.trim().split(/\s+/)[0], params };
}

const plugin = readJson(".claude-plugin/plugin.json");
const mcp = readJson(".mcp.json");
const readme = readText("README.md");
const servers = Object.entries(mcp.mcpServers ?? {});

for (const [name, server] of servers) {
  const endpoint = server.url;
  let challenge;
  let resourceMetadata;

  await check(`${name}: unauthenticated initialize is refused with a Bearer challenge`, async () => {
    const response = await request(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "nirvani-plugin-ci", version: "1.0.0" } },
      }),
    });
    assert(response.status === 401, `expected HTTP 401, got ${response.status}`);
    const header = response.headers.get("www-authenticate") ?? "";
    challenge = parseChallenge(header);
    assert(challenge.scheme.toLowerCase() === "bearer", `expected a Bearer challenge, got "${header || "none"}"`);
    assert(challenge.params.resource_metadata?.startsWith("https://"), "challenge has no https resource_metadata");
    return `401, resource_metadata ${challenge.params.resource_metadata}`;
  });

  await check(`${name}: protected resource metadata names this endpoint`, async () => {
    assert(challenge, "no challenge to follow");
    resourceMetadata = await getJson(challenge.params.resource_metadata);
    assert(resourceMetadata.resource === endpoint, `resource is ${resourceMetadata.resource}, expected ${endpoint}`);
    assert(Array.isArray(resourceMetadata.authorization_servers) && resourceMetadata.authorization_servers.length > 0, "no authorization_servers");
    assert(Array.isArray(resourceMetadata.scopes_supported) && resourceMetadata.scopes_supported.length > 0, "no scopes_supported");
    if (challenge.params.scope) {
      const missing = challenge.params.scope.split(/\s+/).filter((scope) => !resourceMetadata.scopes_supported.includes(scope));
      assert(missing.length === 0, `challenge asks for scopes the metadata does not list: ${missing.join(", ")}`);
    }
    return `scopes ${resourceMetadata.scopes_supported.join(" ")}`;
  });

  await check(`${name}: authorization server supports OAuth 2.1 code flow with PKCE`, async () => {
    assert(resourceMetadata, "no resource metadata to follow");
    const issuer = resourceMetadata.authorization_servers[0].replace(/\/$/, "");
    const metadata = await getJson(`${issuer}/.well-known/oauth-authorization-server`);
    assert(metadata.issuer === issuer, `issuer is ${metadata.issuer}, expected ${issuer}`);
    for (const field of ["authorization_endpoint", "token_endpoint"]) {
      assert(typeof metadata[field] === "string" && metadata[field].startsWith("https://"), `${field} must be https`);
    }
    assert((metadata.response_types_supported ?? []).includes("code"), "response type code is not supported");
    assert((metadata.code_challenge_methods_supported ?? []).includes("S256"), "PKCE S256 is not supported");
    assert((metadata.grant_types_supported ?? ["authorization_code"]).includes("authorization_code"), "authorization_code grant is not supported");
    const canRegister = typeof metadata.registration_endpoint === "string" || metadata.client_id_metadata_document_supported === true;
    assert(canRegister, "neither dynamic client registration nor client id metadata documents are supported");
    return `issuer ${metadata.issuer}`;
  });
}

const links = new Set(
  [plugin.homepage, plugin.privacyPolicyUrl, plugin.author?.url].filter((url) => typeof url === "string" && url.startsWith("https://")),
);
const serverHosts = new Set(servers.map(([, server]) => new URL(server.url).host));
for (const match of readme.matchAll(/https:\/\/[^\s)<>"'`|]+/g)) {
  const url = match[0].replace(/[.,;:]+$/, "");
  if (serverHosts.has(new URL(url).host) && !servers.some(([, server]) => server.url === url)) links.add(url);
}

for (const url of [...links].sort()) {
  await check(`Link answers 200: ${url}`, async () => {
    const response = await request(url, { headers: { accept: "text/html,application/json;q=0.9,*/*;q=0.8" } });
    assert(response.status === 200, `HTTP ${response.status}`);
    return "200";
  });
}

report.finish();
