# abis-skills

Collection of [Claude Code](https://claude.com/claude-code) skills, installable with a single `npx` command.

## Requirements

- **Node.js 18+** (only to run the installer; skills themselves need no Node).
- **Claude Code**.
- **`git`** and network access, for the interactive install.
- **GitHub CLI (`gh`)**, authenticated, for `pr-review`:

  ```sh
  gh auth login
  gh auth status   # should show you as logged in
  ```

## Install

```sh
npx abis-skills
```

This opens an interactive selector: search the list, pick the skills you want (or "Select All") and choose where to install them:

- **Global**: available in every project.
- **Project**: only in the current directory.

Restart Claude Code and run the skill, e.g. `/pr-review`.

The selector is [Vercel's `skills` CLI](https://github.com/vercel-labs/skills) (`npx skills@latest`), run for you by `abis-skills`:

- It installs for **Claude Code only**; it never asks which agent.
- It installs the skills from the git tag matching this package's version (`npx abis-skills@0.2.1` → tag `v0.2.1`).
- Skills are **symlinked** into Claude Code's skills directory from a copy managed by `skills`. If that copy is removed, run `npx abis-skills` again.
- If a skill is already installed, `skills` overwrites it.
- It only runs in an interactive terminal. When `skills` detects it is launched by an agent (e.g. with `!` inside Claude Code), it installs without showing the selector; run `npx abis-skills` from a regular terminal instead.

Skills installed with the selector are managed without a skill name:

```sh
npx abis-skills update      # runs: npx skills@latest update
npx abis-skills uninstall   # runs: npx skills@latest remove -a claude-code
```

`skills update` is owned by `skills` and may update beyond this package's pinned tag.

The named commands below (`update <skill>`, `uninstall <skill>`) do not touch selector-installed skills.

### Non-interactive install (CI, scripts)

```sh
npx abis-skills install pr-review
```

This copies the skill to `~/.claude/skills/pr-review/` without `git`, network access or the `skills` CLI. Use it when there is no interactive terminal, or as a fallback if the selector fails.

## Commands

```sh
npx abis-skills                     # interactive selector (terminal only)
npx abis-skills install             # same as above
npx abis-skills update              # update selector-installed skills
npx abis-skills uninstall           # remove selector-installed skills
npx abis-skills list                # available skills and install status
npx abis-skills install <skill>     # install (asks before overwriting)
npx abis-skills update <skill>      # overwrite with this package's version
npx abis-skills uninstall <skill>   # remove (asks for confirmation)
```

| Option | Effect |
| --- | --- |
| `-f`, `--force` | Overwrite (`install <skill>`) or remove (`uninstall <skill>`) without asking. Requires a skill name. |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show package version |

Notes:

- Without an interactive terminal, the forms without a skill name never run the selector: `npx abis-skills` prints the help and `install` / `update` / `uninstall` fail with `missing skill name` (exit code 1).

For the named commands (`install <skill>`, `update <skill>`, `uninstall <skill>`):

- Each installed skill gets a `.installed.json` with the package name, version and install date.
- `update` and `uninstall` only touch skills installed by this package. A skill you created yourself with the same name is never overwritten or deleted unless you run `install <skill> --force`.
- To get the latest version of a skill: `npx abis-skills@latest update <skill>`.
- Without an interactive terminal (e.g. CI), confirmation prompts count as "no"; use `--force`.
- For safety, `install` and `update` refuse any skill that contains symbolic links, so nothing outside the skill folder can end up in `~/.claude/skills/`.

## Skills

Workflow for your own branch: **review → fix**. [`review-fixes`](#review-fixes) turns problems into fix specs in `fixes/<branch>/`; [`fix-impl`](#fix-impl) implements them step by step.

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

### `review-fixes`

Reviews **your own** branch: only its commits against its base branch, plus (optionally) the open PR's review comments. Each problem becomes a fix spec you decide with the agent, ready to implement later.

```text
/review-fixes   # no arguments: reviews the current branch
```

Flow:

1. Offers to continue if the branch already has fixes in `fixes/<branch>/` (`Continue` / `Review again` / `Cancel`).
2. Checks the current branch (stops in detached HEAD).
3. Language (Español / English), for the conversation and every file written.
4. Base branch: the open PR's base, or the remote default branch. You confirm it.
5. Diff `merge-base..HEAD` (committed changes only; uncommitted ones are reported and left out). Lockfiles, build output and generated files are skipped.
6. What to review: SOLID, DRY, KISS, Scalability, Bugs/logic, Security, GitHub comments, plus your own. With GitHub comments you pick which reviewers to address; each comment is checked against `HEAD`, and the ones already fixed are skipped.
7. Report of findings from critical to low, written to `fixes/<branch>/README.md`.
8. Walkthrough of each finding: problem, why it fails, 2–3 solutions. You pick **one** solution (or write your own) or discard the finding. The fix file is written right away.
9. Summary: fixes written, discarded and skipped.

`fixes/` layout (branch `feature/login-form`):

```text
fixes/feature-login-form/
├── README.md                          # index: one row per finding with severity, status and link
├── 01-token-logged-in-plain-text.md   # one fix spec per decided finding
└── 02-missing-null-check-on-profile.md
```

Each fix file has: Problem, Why it fails, Decided solution (exactly one), Discarded alternatives, Implementation plan (`- [ ]` steps) and Acceptance criteria. Before writing a fix, the skill checks it has no open decisions or hedging words (`maybe`, `could`, `TBD`…). Status values stay in English so `/fix-impl` can read them.

Details:

- Every decision is an option selection; free text only when you choose "Other".
- Progress lives in the `fixes/` files. Stop at any finding and relaunch `/review-fixes` to continue from the first undecided one.
- **Read-only on git and GitHub:** it never modifies code, commits, stages, fetches or switches branches, and never replies to or resolves PR comments. The only files it writes are under `fixes/<branch>/`. Review them and commit them yourself.

### `fix-impl`

Implements the fix specs written by `/review-fixes`, one fix at a time in priority order and one plan step at a time. You review and commit every diff yourself.

```text
/fix-impl      # next fix: first In progress, then first Pending
/fix-impl 03   # fix 03 of the folder
```

Flow:

1. Folder: `fixes/<current-branch>/`, or, if the branch has none, a list of the folders with unfinished fixes to pick from. The folder is kept for the whole run.
2. Fix: `Done` fixes are skipped. Shows a summary (decided solution, plan with checked steps, acceptance criteria) and warns about findings still `Undecided` (decide them with `/review-fixes`; they are never implemented).
3. Branch, **asked per fix**: `Same branch` or `New branch`, created from the reviewed branch (independent fixes), the current HEAD (stacked fixes) or another ref, named `fix/<branch>-NN-slug` by default. Before switching it stops on uncommitted changes and warns about uncommitted `fixes/` files.
4. Drift check: warns if the files in the plan changed since the review.
5. Steps: implements one step, ticks it `- [x]` in the fix file, sets the fix and its README row to `In progress`, shows the files touched and pauses (`Next step` / `Adjust this step` / `Stop here`). Any ambiguity or plan/code mismatch is asked to you and recorded under `## Decisions during implementation` in the fix file.
6. Verify: offers to run the project's `test` / `lint` / `typecheck` scripts (`package.json`) or `make test` / `make lint`, then checks each acceptance criterion. Only then the fix becomes `Done`, with `Implemented in: <branch>`. A failing check keeps it `In progress`.
7. Next fix or stop, then a summary: fixes done in this run, fixes left, undecided findings.

Details:

- Every decision is an option selection; free text only when you choose "Other".
- Progress lives in the `fixes/` files, in the same diff as the code. Stop at any step and relaunch `/fix-impl` to resume at the first unchecked step.
- **Never commits:** no `commit`, `add`, `stash`, `push` or PRs, and no GitHub access. The only git write is switching branches after you choose it.
- It only runs when you call it (`disable-model-invocation`): Claude never starts it on its own.

## Security

> [!WARNING]
> When installing, the `skills` selector shows **High** (Gen Agent Trust Hub) and **Medium** (Snyk) risk for `pr-review`. This is expected: the skill runs `gh` commands and reads pull requests written by other people, with your GitHub login. There is no malicious code (Socket: 0 alerts), but a malicious PR could try to trick the agent (odd file names, hidden instructions for AI reviewers).

Since v0.2.1 the skill validates every value before it reaches a command, treats PR content as data (never as instructions), reports manipulation attempts as findings, and posts nothing until you confirm the final preview.

Be careful:

- Install only `abis-skills` from npm or `gabrielciprianoo/abis-skills` from GitHub; check the name before `npx`.
- Read the preview before **Publish review**: event and every comment.
- Take extra care with PRs from unknown contributors or forks. Stop Claude if it proposes anything that is not part of the review.
- Keep Claude Code's permission prompts on, and use a `gh` token with the minimum scopes.

Details, audit results and how to report a vulnerability: [SECURITY.md](https://github.com/gabrielciprianoo/abis-skills/blob/main/SECURITY.md).

## Uninstall

```sh
npx abis-skills uninstall             # installed with the selector
npx abis-skills uninstall pr-review   # installed with `install pr-review`
npx abis-skills uninstall review-fixes   # installed with `install review-fixes`
npx abis-skills uninstall fix-impl   # installed with `install fix-impl`
rm -rf ~/.claude/pr-review   # optional: pending review sessions
```

## License

MIT
