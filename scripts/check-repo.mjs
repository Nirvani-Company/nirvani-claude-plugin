#!/usr/bin/env node
// Static checks for the Nirvani Claude plugin repository. Node 22, no dependencies.
//
//   node scripts/check-repo.mjs                        every static check; white-label runs when its secret is set
//   node scripts/check-repo.mjs --require-white-label  same, but fail when the white-label secret is missing
//
// The white-label check reads a comma separated list from NIRVANI_FORBIDDEN_TERMS. This repository is
// public and so are its Actions logs, so a hit is reported by file, line and term number, never by the term.
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, Report, isBinaryPath, readJson, readText, repoFiles } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const report = new Report("Repository checks");

const REQUIRED_FILES = [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "SECURITY.md",
  "SUPPORT.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  ".gitignore",
  ".editorconfig",
  ".mcp.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".claude-plugin/icon.png",
  ".github/CODEOWNERS",
  ".github/repository.json",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
];

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty"];

function check(name, fn) {
  try {
    const detail = fn();
    report.pass(name, typeof detail === "string" ? detail : "");
  } catch (error) {
    report.fail(name, error.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseNumber(token) {
  const lower = token.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  const index = NUMBER_WORDS.indexOf(lower);
  return index === -1 ? NaN : index;
}

const files = repoFiles();
const textFiles = files.filter((path) => !isBinaryPath(path) && existsSync(resolve(ROOT, path)));

check("Required files present", () => {
  const missing = REQUIRED_FILES.filter((path) => !existsSync(resolve(ROOT, path)));
  assert(missing.length === 0, `missing ${missing.join(", ")}`);
  return `${REQUIRED_FILES.length} files`;
});

let plugin;
let marketplace;
let mcp;
check("Manifests parse as JSON", () => {
  plugin = readJson(".claude-plugin/plugin.json");
  marketplace = readJson(".claude-plugin/marketplace.json");
  mcp = readJson(".mcp.json");
  readJson(".github/repository.json");
  return "plugin.json, marketplace.json, .mcp.json, repository.json";
});

check("Plugin manifest has listing metadata", () => {
  assert(plugin, "plugin.json did not load");
  for (const field of ["name", "version", "description", "homepage", "repository", "license", "privacyPolicyUrl"]) {
    assert(typeof plugin[field] === "string" && plugin[field].trim() !== "", `plugin.json ${field} is missing`);
  }
  assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name), `plugin.json name "${plugin.name}" must be lowercase kebab-case`);
  assert(SEMVER.test(plugin.version), `plugin.json version "${plugin.version}" is not semantic`);
  assert(plugin.author && plugin.author.name && plugin.author.email, "plugin.json author needs name and email");
  for (const field of ["homepage", "privacyPolicyUrl"]) {
    assert(plugin[field].startsWith("https://"), `plugin.json ${field} must be https`);
  }
  assert(/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(plugin.repository), "plugin.json repository must be https://github.com/<owner>/<repo>");
  assert(plugin.description.length <= 300, `plugin.json description is ${plugin.description.length} characters; keep it at 300 or fewer`);
  return `${plugin.name} ${plugin.version}`;
});

let releaseVersion;
check("Versions agree across manifests and changelog", () => {
  assert(plugin && marketplace, "manifests did not load");
  const entry = (marketplace.plugins ?? []).find((item) => item.name === plugin.name);
  assert(entry, `marketplace.json lists no plugin named "${plugin.name}"`);
  assert(entry.source === "./", `marketplace.json source for "${plugin.name}" must be "./"`);
  assert(entry.version === plugin.version, `marketplace entry version ${entry.version} differs from plugin.json ${plugin.version}`);
  assert(marketplace.metadata?.version === plugin.version, `marketplace metadata.version ${marketplace.metadata?.version} differs from plugin.json ${plugin.version}`);
  for (const field of ["description", "homepage", "repository", "license"]) {
    assert(entry[field] === plugin[field], `marketplace entry ${field} differs from plugin.json`);
  }
  const changelog = readText("CHANGELOG.md");
  const heading = changelog.match(/^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\] - (\d{4}-\d{2}-\d{2})$/m);
  assert(heading, "CHANGELOG.md has no release heading in the form ## [x.y.z] - YYYY-MM-DD");
  assert(heading[1] === plugin.version, `newest CHANGELOG release is ${heading[1]}, plugin.json says ${plugin.version}`);
  assert(!Number.isNaN(Date.parse(heading[2])), `CHANGELOG date ${heading[2]} is not a valid date`);
  const tag = `${plugin.name}--v${plugin.version}`;
  assert(changelog.includes(`[${plugin.version}]: ${plugin.repository}/releases/tag/${tag}`), `CHANGELOG.md needs the link line [${plugin.version}]: ${plugin.repository}/releases/tag/${tag}`);
  releaseVersion = plugin.version;
  return `${releaseVersion} (tag ${tag})`;
});

check("MCP server reference is a single https endpoint", () => {
  assert(mcp, ".mcp.json did not load");
  const servers = Object.entries(mcp.mcpServers ?? {});
  assert(servers.length >= 1, ".mcp.json defines no servers");
  for (const [name, server] of servers) {
    assert(server.type === "http", `server "${name}" must use type "http" (remote, no local process)`);
    assert(typeof server.url === "string" && server.url.startsWith("https://"), `server "${name}" url must be https`);
    assert(!("command" in server), `server "${name}" must not run a local command`);
    assert(!("headers" in server) && !("env" in server), `server "${name}" must not embed headers or environment values`);
  }
  return servers.map(([name, server]) => `${name} ${server.url}`).join(", ");
});

check("Listing icon is a square PNG between 512 and 2048 px, under 2 MB", () => {
  const path = resolve(ROOT, ".claude-plugin/icon.png");
  const bytes = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  assert(bytes.subarray(0, 8).toString("hex") === signature, "icon.png is not a PNG");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert(width === height, `icon is ${width}x${height}; it must be square`);
  assert(width >= 512 && width <= 2048, `icon is ${width} px; it must be 512 to 2048`);
  const size = statSync(path).size;
  assert(size < 2 * 1024 * 1024, `icon is ${size} bytes; it must be under 2 MB`);
  return `${width}x${height}, ${Math.round(size / 1024)} KB`;
});

check("Skills have valid frontmatter", () => {
  const skills = files.filter((path) => /^skills\/[^/]+\/SKILL\.md$/.test(path));
  assert(skills.length > 0, "no skills/<name>/SKILL.md found");
  for (const path of skills) {
    const text = readText(path);
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert(match, `${path} has no frontmatter block`);
    const name = match[1].match(/^name:\s*(.+)$/m)?.[1].trim();
    const description = match[1].match(/^description:\s*(.+)$/m)?.[1].trim();
    const folder = path.split("/")[1];
    assert(name === folder, `${path} name "${name}" must match its folder "${folder}"`);
    assert(description && description.length >= 40, `${path} description is missing or too short to trigger reliably`);
    assert(description.length <= 1024, `${path} description is ${description.length} characters; the limit is 1024`);
  }
  return skills.join(", ");
});

check("README documents install, tools and every tool the skill names", () => {
  assert(plugin, "plugin.json did not load");
  const readme = readText("README.md");
  const words = readme.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;
  assert(words >= 40, `README has ${words} words; the directory requires at least 40`);
  const repo = plugin.repository.replace("https://github.com/", "");
  const installLine = `/plugin install ${plugin.name} --marketplace ${repo}`;
  assert(readme.includes(installLine), `README must include the install line: ${installLine}`);
  for (const server of Object.values(mcp?.mcpServers ?? {})) {
    assert(readme.includes(server.url), `README must name the server URL ${server.url}`);
  }
  assert(readme.includes(plugin.privacyPolicyUrl), "README must link the privacy policy URL from plugin.json");

  const documented = new Set([...readme.matchAll(/^\|\s*`([a-z][a-z0-9_]*)`\s*\|/gm)].map((m) => m[1]));
  const claimed = readme.match(/exposes ([A-Za-z-]+|\d+) tools/);
  assert(claimed, 'README must state how many tools the connector exposes ("exposes N tools")');
  const count = parseNumber(claimed[1]);
  assert(count === documented.size, `README says ${claimed[1]} tools but its tables list ${documented.size}`);

  const skillTools = new Set();
  for (const path of files.filter((p) => /^skills\/[^/]+\/SKILL\.md$/.test(p))) {
    const text = readText(path);
    for (const m of text.matchAll(/`([a-z]+_[a-z0-9_]+)`/g)) skillTools.add(m[1]);
    const skillCount = text.match(/exposes ([A-Za-z-]+|\d+) tools/);
    if (skillCount) {
      assert(parseNumber(skillCount[1]) === documented.size, `${path} says ${skillCount[1]} tools but README lists ${documented.size}`);
    }
  }
  const undocumented = [...skillTools].filter((tool) => !documented.has(tool));
  assert(undocumented.length === 0, `skill names tools the README does not document: ${undocumented.join(", ")}`);
  return `${words} words, ${documented.size} tools documented`;
});

check("Repository settings file is well formed", () => {
  const settings = readJson(".github/repository.json");
  assert(typeof settings.description === "string" && settings.description.length > 0 && settings.description.length <= 350, "description must be 1 to 350 characters");
  assert(typeof settings.homepage === "string" && settings.homepage.startsWith("https://"), "homepage must be https");
  assert(Array.isArray(settings.topics) && settings.topics.length > 0 && settings.topics.length <= 20, "topics must list 1 to 20 entries");
  for (const topic of settings.topics) {
    assert(/^[a-z0-9][a-z0-9-]{0,49}$/.test(topic), `topic "${topic}" must be lowercase letters, digits and hyphens, 50 characters at most`);
  }
  assert(new Set(settings.topics).size === settings.topics.length, "topics contain duplicates");
  return `${settings.topics.length} topics`;
});

const EM_DASH = String.fromCharCode(0x2014);
check("No em dashes", () => {
  const hits = [];
  for (const path of textFiles) {
    readText(path).split("\n").forEach((line, index) => {
      if (line.includes(EM_DASH)) hits.push(`${path}:${index + 1}`);
    });
  }
  assert(hits.length === 0, hits.join(", "));
  return `${textFiles.length} files`;
});

// Built from parts so this file does not match its own patterns.
const PLACEHOLDER = new RegExp(["\\bT" + "ODO\\b", "\\bFIX" + "ME\\b", "\\bT" + "BD\\b", "INSERT " + "HERE", "REPLACE " + "WITH YOUR", "lorem " + "ipsum"].join("|"), "i");
check("No placeholders", () => {
  const hits = [];
  for (const path of textFiles) {
    readText(path).split("\n").forEach((line, index) => {
      if (PLACEHOLDER.test(line)) hits.push(`${path}:${index + 1}`);
    });
  }
  assert(hits.length === 0, hits.join(", "));
  return `${textFiles.length} files`;
});

const SECRET_PATTERNS = [
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[abpr]-[A-Za-z0-9-]{10,}/],
  ["Private key", /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ["Bearer token", /\bBearer\s+[A-Za-z0-9._~+/=-]{32,}/],
];
check("No secrets", () => {
  const hits = [];
  for (const path of textFiles) {
    readText(path).split("\n").forEach((line, index) => {
      for (const [label, pattern] of SECRET_PATTERNS) {
        if (pattern.test(line)) hits.push(`${path}:${index + 1} (${label})`);
      }
    });
  }
  assert(hits.length === 0, hits.join(", "));
  return `${textFiles.length} files, ${SECRET_PATTERNS.length} patterns`;
});

// Same contract as the connector's page tests: each comma separated entry is a case-insensitive
// pattern, so the secret's owner can add word boundaries where a short name needs them.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const forbidden = (process.env.NIRVANI_FORBIDDEN_TERMS ?? "")
  .split(",")
  .map((term) => term.trim())
  .filter(Boolean)
  .map((term) => {
    try {
      return new RegExp(term, "i");
    } catch {
      return new RegExp(escapeRegExp(term), "i");
    }
  });
if (forbidden.length === 0) {
  if (args.has("--require-white-label")) {
    report.fail("White-label firewall", "NIRVANI_FORBIDDEN_TERMS is empty or not available to this run");
  } else {
    report.skip("White-label firewall", "NIRVANI_FORBIDDEN_TERMS not set; CI runs this check");
  }
} else {
  check("White-label firewall", () => {
    const hits = [];
    for (const path of files) {
      const content = isBinaryPath(path) ? "" : readText(path);
      const lines = [path, ...content.split("\n")];
      lines.forEach((line, index) => {
        forbidden.forEach((pattern, termIndex) => {
          if (pattern.test(line)) {
            hits.push(index === 0 ? `${path} (file name, term ${termIndex + 1})` : `${path}:${index} (term ${termIndex + 1})`);
          }
        });
      });
    }
    assert(hits.length === 0, hits.join(", "));
    return `${files.length} files, ${forbidden.length} terms`;
  });
}

report.finish();
