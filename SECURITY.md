# Security policy

## Supported versions

Only the latest release of this plugin is supported. The plugin holds no code that runs on your machine; it points Claude at the Nirvani server at `https://mcp.nirvani.ai/mcp`, which is maintained continuously and is always current.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Earlier releases | No. Update with `/plugin update nirvani`. |

## Reporting a vulnerability

Report security issues privately. Do not open a public issue.

1. Preferred: use **Report a vulnerability** on this repository's [Security tab](https://github.com/Nirvani-Company/nirvani-claude-plugin/security/advisories/new).
2. Or email support@nirvani.ai with the subject line `SECURITY`.

Include the affected component (plugin, skill, sign-in, or MCP server), steps to reproduce, and the impact you observed. Do not include real customer data.

## What to expect

- We acknowledge your report within two business days.
- We confirm or rule out the issue and share a remediation plan within ten business days.
- We credit you in the release notes when the fix ships, unless you ask us not to.

## Scope

In scope: this repository, the sign-in and consent flow on `mcp.nirvani.ai`, and the MCP endpoint `https://mcp.nirvani.ai/mcp`.

Out of scope: denial of service, volumetric testing, social engineering, and testing against workspaces you do not own. Test only with your own account and data.
