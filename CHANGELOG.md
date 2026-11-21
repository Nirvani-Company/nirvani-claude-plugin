# Changelog

All notable changes to the Nirvani plugin for Claude are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release section is headed `## [x.y.z] - YYYY-MM-DD`. The newest release comes first and must match the `version` in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; CI enforces it.

## [1.0.0] - 2026-11-21

First public release.

### Added

- Connection to the Nirvani remote MCP server at `https://mcp.nirvani.ai/mcp` (Streamable HTTP, OAuth 2.1 with PKCE).
- Eighteen tools: ten read tools for contacts, deals, pipelines, calendars, appointments and conversations, and eight write tools for contacts, deals, appointment booking and messages.
- `nirvani-workspace` skill: look up ids before acting, confirm before any change, report record ids after a change, and format results for a busy team.
- Marketplace manifest, so Claude Code installs the plugin straight from this repository.
- Listing icon, privacy policy link, security policy, support routes and release automation.

[1.0.0]: https://github.com/Nirvani-Company/nirvani-claude-plugin/releases/tag/nirvani--v1.0.0
