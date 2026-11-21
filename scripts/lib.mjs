// Shared helpers for the repository checks. Node 22, no dependencies.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ROOT = resolve(new URL("..", import.meta.url).pathname);

export function readText(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

export function readJson(path) {
  const text = readText(path);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

/** Tracked files plus new files not yet committed, minus ignored ones. */
export function repoFiles() {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return [...new Set(out.split("\0").filter(Boolean))].sort();
}

const BINARY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip"]);

export function isBinaryPath(path) {
  const dot = path.lastIndexOf(".");
  return dot !== -1 && BINARY_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/** Collects pass and fail results, prints them, and writes a GitHub step summary when one is available. */
export class Report {
  constructor(title) {
    this.title = title;
    this.rows = [];
  }

  pass(check, detail = "") {
    this.rows.push({ ok: true, check, detail });
  }

  fail(check, detail) {
    this.rows.push({ ok: false, check, detail });
  }

  skip(check, detail) {
    this.rows.push({ ok: null, check, detail });
  }

  get failed() {
    return this.rows.filter((row) => row.ok === false);
  }

  finish() {
    const mark = (ok) => (ok === true ? "PASS" : ok === false ? "FAIL" : "SKIP");
    console.log(`\n${this.title}\n`);
    for (const row of this.rows) {
      console.log(`${mark(row.ok).padEnd(4)}  ${row.check}${row.detail ? `: ${row.detail}` : ""}`);
    }
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      const escape = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
      const lines = [
        `### ${this.title}`,
        "",
        "| Result | Check | Detail |",
        "| --- | --- | --- |",
        ...this.rows.map((row) => `| ${mark(row.ok)} | ${escape(row.check)} | ${escape(row.detail)} |`),
        "",
      ];
      appendFileSync(summaryPath, `${lines.join("\n")}\n`);
    }
    const failures = this.failed.length;
    console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
    process.exitCode = failures === 0 ? 0 : 1;
  }
}
