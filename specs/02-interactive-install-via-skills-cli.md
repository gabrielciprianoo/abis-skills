# SPEC 02 — Interactive skill selection via the `skills` CLI

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-09-21
> **Objective:** Make `npx abis-skills` (with no skill name) open the interactive `skills` selector (banner, search, Select All) so the user picks which skills to install for Claude Code, by delegating to `npx skills@latest add`.

---

## Why this spec exists

Today the only way to install is `npx abis-skills install <skill>`, which requires knowing the skill name beforehand.
The user wants the experience of `npx skills@latest add Klerith/fernando-skills`: a banner, a search field, a multi-select list with "Select All", and a choice of scope.
That UI is not part of the Klerith repo; it belongs to Vercel's third-party `skills` CLI (`vercel-labs/skills`), which clones any GitHub repo shaped as `skills/<name>/SKILL.md`.
This repo already has that shape: `npx skills@1.7.0 add gabrielciprianoo/abis-skills -l` detects `pr-review` today, and `#v0.1.0` refs work (`Source: … @ v0.1.0`).
So instead of drawing our own UI, `abis-skills` delegates to that CLI when no skill name is given.

---

## Scope

**In:**

- `npx abis-skills` with no command, in an interactive terminal, runs the `skills` selector.
- `npx abis-skills install` with no skill name, in an interactive terminal, runs the same selector.
- `npx abis-skills update` with no skill name, in an interactive terminal, delegates to `npx skills@latest update`.
- `npx abis-skills uninstall` with no skill name, in an interactive terminal, delegates to `npx skills@latest remove -a claude-code`.
- The agent is forced to Claude Code (`-a claude-code`); the user is never asked which agent.
- The `skills` CLI asks the scope (global / project); `abis-skills` does not pass `-g`.
- Install mode is the `skills` default (symlink); `abis-skills` does not pass `--copy`.
- The source is pinned to the git tag matching the package version: `gabrielciprianoo/abis-skills#v<package.json version>`.
- The `skills` CLI is always invoked as `skills@latest`.
- Without an interactive terminal, the no-argument forms keep today's behavior (help/error, exit 1) and never delegate.
- `install <skill>`, `update <skill>`, `uninstall <skill>` and `list` keep working exactly as in SPEC 01.
- README, CHANGELOG and a version bump to `0.2.0`.

**Out of scope (for future specs):**

- A custom selector UI drawn by `abis-skills` (own banner "ABIS", own search).
- Agents other than Claude Code (Codex, Gemini CLI, Cursor…).
- Making `abis-skills list` aware of skills installed through `skills` (symlinked, no `.installed.json`).
- Migrating `spec` and `spec-impl` into the package.
- Publishing to the skills.sh directory / telemetry metadata.
- CI to publish automatically.

---

## Data model

This feature introduces no new persisted data.
It reuses `.installed.json` from SPEC 01 for the named-skill commands.
Skills installed through the selector are tracked by the `skills` CLI itself (its own lock / canonical directory), not by `abis-skills`.

Delegation table (the only new structure, a constant in `bin/cli.js`):

```js
const SKILLS_CLI = 'skills@latest';
const SOURCE = `gabrielciprianoo/abis-skills#v${PKG.version}`;

// command (no skill name, TTY) → npx arguments
// (none) / install → ['-y', SKILLS_CLI, 'add', SOURCE, '-a', 'claude-code']
// update           → ['-y', SKILLS_CLI, 'update']
// uninstall        → ['-y', SKILLS_CLI, 'remove', '-a', 'claude-code']
```

Conventions:

- `-y` here is `npx`'s flag (skip "Need to install the following packages" prompt), not the `skills` `--yes` flag.
- The child process runs with `stdio: 'inherit'` so the `skills` UI draws directly in the user's terminal.
- The exit code of `abis-skills` is the exit code of the child process.
- On Windows the executable is `npx.cmd`; elsewhere `npx`.

---

## Implementation plan

1. In `bin/cli.js`, add the `SKILLS_CLI` / `SOURCE` constants and a `delegate(npxArgs)` function that spawns `npx` with `stdio: 'inherit'` and resolves with the child exit code. If the spawn fails (`ENOENT`, etc.), print a clear error that suggests `abis-skills install <skill>` and return 1. Manual test: call it temporarily from a scratch script.
2. Make `install` with no skill name delegate to `add` when `process.stdin.isTTY`; without a TTY keep the current `missing skill name` error. `install <skill>` is unchanged. Manual test: `node bin/cli.js install` in a terminal opens the selector with `pr-review`.
3. Make `abis-skills` with no command delegate the same way when there is a TTY; without a TTY, print `USAGE` and exit 1 as today. `-h` / `-v` are unchanged.
4. Make `update` with no skill name delegate to `skills update`, and `uninstall` with no skill name delegate to `skills remove -a claude-code`, both only with a TTY. The named forms and their `.installed.json` checks are unchanged.
5. Reject `-f` / `--force` combined with a no-skill-name command: `Error: --force requires a skill name`, exit 1. Nothing is delegated.
6. Update `USAGE` to show the new no-argument forms.
7. Update `README.md`: interactive install (`npx abis-skills`) as the main path, a note that it uses Vercel's `skills` CLI (needs `git` and network), Claude Code only, the scope prompt, symlink install, and that selector-installed skills are managed with `npx abis-skills update` / `uninstall` without a name (not with the named forms). Keep `install <skill>` documented as the non-interactive / CI path.
8. Bump `package.json` to `0.2.0` and add the `0.2.0` entry to `CHANGELOG.md`.
9. Release: merge to `main`, tag `v0.2.0` and push the tag **before** `npm publish` (the selector clones that tag).

---

## Acceptance criteria

- [ ] In a TTY, `npx abis-skills` shows the `skills` banner, "Source: https://github.com/gabrielciprianoo/abis-skills.git @ v0.2.0", a search field, "Select All (0/N)" and the list of skills.
- [ ] In a TTY, `npx abis-skills install` shows the same selector.
- [ ] The selector never asks which agent; the result lands in Claude Code's skills directory.
- [ ] The selector asks global vs project scope.
- [ ] Selecting `pr-review` and confirming makes `/pr-review` available in Claude Code after restart.
- [ ] Selecting an already-installed skill overwrites it without an extra `abis-skills` prompt.
- [ ] Without a TTY (`npx abis-skills < /dev/null`), the usage is printed, exit code is 1, and no `npx skills` process is spawned.
- [ ] Without a TTY, `npx abis-skills install` fails with `missing skill name` and exit code 1.
- [ ] In a TTY, `npx abis-skills update` runs `skills update`.
- [ ] In a TTY, `npx abis-skills uninstall` runs `skills remove` restricted to Claude Code.
- [ ] `npx abis-skills install --force` (no skill) exits 1 with `--force requires a skill name`.
- [ ] `npx abis-skills install pr-review`, `update pr-review`, `uninstall pr-review` and `list` behave exactly as in SPEC 01.
- [ ] Cancelling the selector (Ctrl+C / Esc) exits `abis-skills` with a non-zero code and no stack trace.
- [ ] `package.json` still has no `dependencies`.
- [ ] `package.json` version is `0.2.0` and the `v0.2.0` tag exists on GitHub before the npm publish.

---

## Decisions

- **Yes:** delegate to Vercel's `skills` CLI. Gives exactly the UI in the reference screenshot with almost no code.
- **No:** custom selector drawn by `abis-skills` (readline + ANSI). More code to maintain; considered and discarded.
- **No:** `@clack/prompts` as a dependency. Breaks the "no dependencies" rule from SPEC 01.
- **No:** only documenting `npx skills add …` without touching the CLI. The user wants `npx abis-skills` itself to open the selector.
- **Yes:** keep the named commands from SPEC 01. Non-interactive / CI installs keep working and keep `.installed.json`.
- **Yes:** force `-a claude-code`. Claude Code is the only target for now.
- **Yes:** let `skills` ask the scope (global / project). User's choice; SPEC 01 was global-only.
- **Yes:** symlink install (the `skills` default). User's choice over `--copy`.
- **Yes:** source pinned to `#v<package version>`. `npx abis-skills@0.2.0` installs the 0.2.0 skills, consistent with `install <skill>`.
- **No:** `main` branch as source. Could install skills newer than the npm package.
- **Yes:** `skills@latest`. User's choice: receive `skills` improvements automatically, accepting the risk of breaking changes.
- **No:** pinned `skills@1.7.0`.
- **Yes:** no delegation without a TTY. `skills` in a non-interactive context installs without asking.
- **Yes:** also delegate `update` / `uninstall` with no skill name. Skills installed by the selector have no `.installed.json`, so the named commands refuse to touch them.
- **Yes:** `--force` without a skill name is an error. `--force` only has meaning for the SPEC 01 commands; silently ignoring it would be misleading.
- **Yes:** overwriting an already-installed skill is decided by the `skills` CLI, with no extra `abis-skills` prompt.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| `skills@latest` changes flags or UI | Flags used are minimal (`add`, `-a`, `update`, `remove`); README shows `install <skill>` as fallback. Pin the version in a later release if it breaks. |
| Tag `v<version>` missing when the package is published | Release step 9 tags and pushes before `npm publish`; acceptance criterion checks it. |
| `git` not installed or no network | `skills` fails and its exit code propagates; README lists `git` + network as requirements for the interactive path and points to `install <skill>`. |
| Symlink install points into a directory that is later cleaned | Documented behavior of `skills`; reinstall with `npx abis-skills`. |
| `abis-skills list` shows selector-installed skills as `installed (unmanaged)` or not at all | Accepted for now; `list` awareness is out of scope. |
| `skills update` updates beyond the pinned tag | Behavior owned by `skills`; documented in README. |
| `npx` not on PATH (Windows `npx.cmd`) | Platform-specific executable name; spawn error prints a clear message. |

---

## What is **not** in this spec

- Custom selector UI / "ABIS" banner.
- Agents other than Claude Code.
- `list` awareness of selector-installed skills.
- Migrating `spec` and `spec-impl` into the package.
- skills.sh listing, CI publishing.

Each of these, if it lands, goes in its own spec.
