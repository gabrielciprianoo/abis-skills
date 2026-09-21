# @goldengate/skills

Collection of [Claude Code](https://claude.com/claude-code) skills, installable globally into `~/.claude/skills/` with a single `npx` command.

## Requirements

- **Node.js 18+** (only to run the installer; skills themselves need no Node).
- **Claude Code**.
- **GitHub CLI (`gh`)**, authenticated, for `pr-review`:

  ```sh
  gh auth login
  gh auth status   # should show you as logged in
  ```

## Install

```sh
npx @goldengate/skills install pr-review
```

This copies the skill to `~/.claude/skills/pr-review/`. Restart Claude Code and run `/pr-review` in any repository.

## Commands

```sh
npx @goldengate/skills list                  # available skills and install status
npx @goldengate/skills install <skill>       # install (asks before overwriting)
npx @goldengate/skills update <skill>        # overwrite with this package's version
npx @goldengate/skills uninstall <skill>     # remove (asks for confirmation)
```

| Option | Effect |
| --- | --- |
| `-f`, `--force` | Overwrite (`install`) or remove (`uninstall`) without asking |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show package version |

Notes:

- Each installed skill gets a `.installed.json` with the package name, version and install date.
- `update` and `uninstall` only touch skills installed by this package. A skill you created yourself with the same name is never overwritten or deleted unless you run `install <skill> --force`.
- To get the latest version of a skill: `npx @goldengate/skills@latest update <skill>`.
- Without an interactive terminal (e.g. CI), confirmation prompts count as "no"; use `--force`.
- For safety, `install` and `update` refuse any skill that contains symbolic links, so nothing outside the skill folder can end up in `~/.claude/skills/`.

## Skills

### `pr-review`

Reviews **someone else's** GitHub pull request step by step, with your approval on every finding, and publishes a single review whose comments read as written by you.

```text
/pr-review                                       # pick from the repo's open PRs
/pr-review 42                                    # PR #42 of the current repo
/pr-review https://github.com/org/repo/pull/42   # any PR by URL
```

Flow:

1. Offers to resume a pending review, if there is one.
2. Checks the GitHub connection: `✓ Connected to GitHub as @you`.
3. Review language (Español / English).
4. PR selection (PRs requesting your review first, 3 per page).
5. Review criteria: SOLID, DRY, KISS, Scalability, Atomic Design, Performance, Bugs/logic, Security, plus your own.
6. Analysis of the diff, the full changed files and the repo's `CLAUDE.md`/`AGENTS.md` (lockfiles, build output and generated files are skipped).
7. Summary of findings by severity, ordered by priority.
8. Comment language (Español / English).
9. Walkthrough of each finding: **This is the problem** / **These are the possible solutions**, with the proposed inline comments. You choose solutions, edit comments or add context.
10. Event (`COMMENT` / `REQUEST_CHANGES` / `APPROVE`) and optional general message.
11. Check that no comment carries any trace of AI (signatures, `Co-Authored-By`, 🤖…).
12. Final preview and confirmation. **Nothing is posted to GitHub before this point.**
13. Publishes one review and shows its URL.

Details:

- Every decision is an option selection; free text only when you choose "Other" (to write or edit a comment).
- Comments can span several lines and several files. Comments on lines outside the diff go into the review body with a `file:line` reference (GitHub doesn't allow them inline).
- Progress is saved after every decision in `~/.claude/pr-review/sessions/<owner>__<repo>__<pr>.json`. Relaunching `/pr-review` offers to continue. The file is deleted after a successful publish.
- It never modifies code, switches branches or checks out the PR.
- On your own PR, only `COMMENT` is available (GitHub rule).

## Uninstall

```sh
npx @goldengate/skills uninstall pr-review
rm -rf ~/.claude/pr-review   # optional: pending review sessions
```

## License

MIT
