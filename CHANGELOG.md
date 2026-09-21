# Changelog

All notable changes to this project are documented here. Versions follow [Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/gabrielciprianoo/abis-skills/releases/tag/v0.1.0
