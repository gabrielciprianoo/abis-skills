# Changelog

All notable changes to this project are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-09-21

### Added

- `npx abis-skills` (no command) and `npx abis-skills install` (no skill name) open an interactive selector in a terminal, by running Vercel's `skills` CLI (`npx skills@latest add gabrielciprianoo/abis-skills#v<version> -a claude-code`).
  - Search, "Select All" and a global / project scope prompt; Claude Code only; symlink install.
  - Skills come from the git tag matching the package version.
- `npx abis-skills update` and `npx abis-skills uninstall` (no skill name) run `skills update` and `skills remove -a claude-code` in a terminal, for selector-installed skills.

### Changed

- Without an interactive terminal, the no-name forms never run `skills`: `abis-skills` prints the help and `install` / `update` / `uninstall` fail with `missing skill name` (exit code 1).
- `--force` without a skill name is now an error: `--force requires a skill name`.
- Help and README describe the interactive install as the main path; `install <skill>` stays as the non-interactive / CI path.

## [0.1.0] - 2026-09-21

### Added

- `abis-skills` CLI (Node 18+, no dependencies) with `list`, `install`, `update` and `uninstall`, plus `--force`.
- Skills are installed into `~/.claude/skills/<skill>/` with an `.installed.json` marker.
- `update` and `uninstall` only touch skills installed by this package.
- `install` and `update` refuse to install a skill that contains symbolic links.
- `/pr-review` skill: guided review of someone else's GitHub PR.
  - GitHub connection check, review and comment language (es/en), PR selection with pagination.
  - Review criteria: SOLID, DRY, KISS, Scalability, Atomic Design, Performance, Bugs/logic, Security, plus custom ones.
  - Summary by severity, one-by-one walkthrough with solutions and editable inline comments (multi-line, multi-file).
  - Out-of-diff comments moved to the review body.
  - Anti-AI check before publishing; single review published only after explicit confirmation.
  - Progress saved in `~/.claude/pr-review/sessions/` and resumable.

[0.2.0]: https://github.com/gabrielciprianoo/abis-skills/releases/tag/v0.2.0
[0.1.0]: https://github.com/gabrielciprianoo/abis-skills/releases/tag/v0.1.0
