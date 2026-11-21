# Contributing

This repository is the published Nirvani plugin for Claude. Nirvani Company maintains it. Bug reports and feature requests are welcome through [issues](https://github.com/Nirvani-Company/nirvani-claude-plugin/issues/new/choose). Code changes are made by the Nirvani team; an outside pull request is reviewed and, if accepted, re-created by a maintainer so it runs the full check suite.

## Repository layout

| Path | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Plugin manifest: name, version, listing metadata. |
| `.claude-plugin/marketplace.json` | Marketplace manifest, so Claude Code installs the plugin from this repository. |
| `.claude-plugin/icon.png` | Listing icon, 1024 by 1024 PNG. The directory keeps the first icon it receives, so it does not change. |
| `.mcp.json` | The remote MCP server the plugin connects to. |
| `skills/nirvani-workspace/SKILL.md` | The skill Claude loads for Nirvani tasks. |
| `scripts/` | Dependency-free checks that CI runs. |
| `.github/repository.json` | Repository description, homepage, topics and security settings, applied by the Repository settings workflow. |

## Rules for every change

1. Branch from `main`. Never commit to `main` directly.
2. One change per commit, with a message that says what changed and why.
3. Open a pull request using the template. CODEOWNERS review is required.
4. Every check in the CI workflow passes. A pull request is not ready while a check is red.
5. No em dashes in any file. Never name an upstream platform provider in any file; the white-label check enforces it. No secrets, tokens, or customer data anywhere.

## Versioning

Follow [Semantic Versioning](https://semver.org):

| Change | Bump |
| --- | --- |
| Wording fixes in the README or skill that do not change behavior | Patch |
| New skill guidance, new tool coverage, new listing metadata | Minor |
| Removed tools, renamed plugin, changed server URL, or anything that breaks an existing install | Major |

A versioned change updates `version` in `.claude-plugin/plugin.json`, the plugin entry and `metadata.version` in `.claude-plugin/marketplace.json`, and adds a dated section at the top of `CHANGELOG.md`. CI fails when the three disagree.

## Releasing

Releases are automatic. When a merge to `main` carries a version with no release yet, the Release workflow validates the plugin, creates the tag `nirvani--v<version>`, and publishes a GitHub release with that version's changelog section. Nobody tags by hand.

## Running the checks

From a Codespace or any Node 22 environment:

```bash
node scripts/check-repo.mjs
```

```bash
node scripts/check-live.mjs
```

```bash
npx --yes @anthropic-ai/claude-code@2.1.330 plugin validate . --strict --profile directory
```

The white-label check needs the `NIRVANI_FORBIDDEN_TERMS` secret and runs in CI only.
