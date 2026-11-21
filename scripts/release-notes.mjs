#!/usr/bin/env node
// Prints the CHANGELOG.md section for one version, for the GitHub release body.
//
//   node scripts/release-notes.mjs 1.0.0
import { readText } from "./lib.mjs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node scripts/release-notes.mjs <x.y.z>");
  process.exit(2);
}

const lines = readText("CHANGELOG.md").split("\n");
const start = lines.findIndex((line) => line.startsWith(`## [${version}] - `));
if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
let end = lines.findIndex((line, index) => index > start && (line.startsWith("## [") || /^\[[^\]]+\]: /.test(line)));
if (end === -1) end = lines.length;

const body = lines.slice(start + 1, end).join("\n").trim();
if (body === "") {
  console.error(`CHANGELOG.md section for ${version} is empty`);
  process.exit(1);
}
process.stdout.write(`${body}\n`);
