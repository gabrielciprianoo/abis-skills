# SPEC 01 — `/pr-review` skill installable globally via npx

> **Status:** Implemented
> **Depends on:** —
> **Date:** 2026-09-21
> **Objective:** Build the `/pr-review` skill, which reviews a GitHub PR step by step with user approval on every finding and posts inline comments with no trace of AI, distributed via `npx @goldengate/skills install pr-review`.

---

## Why this spec exists

The team wants AI-assisted code reviews without losing human control.
Every finding is explained ("This is the problem" / "These are the possible solutions") and nothing is posted without approval.
Comments must read as if written by the reviewer: no `Co-Authored-By`, no Claude signature.
Copying the skill file into every project does not scale, so it ships as an npm package that installs it globally into `~/.claude/skills/`.

---

## Scope

**In:**

- Public npm package `@goldengate/skills` with a CLI (`install`, `list`, `update`, `uninstall`).
- The CLI installs skills into `~/.claude/skills/<skill>/` (Claude Code only).
- The package is a collection: today it contains only `pr-review`, but it accepts more skills without changing the CLI.
- `/pr-review` skill that reviews **other people's** GitHub PRs and posts comments. It does not modify code.
- Every user interaction is an **option selection** (`AskUserQuestion`), never an open question.
- GitHub connection check at startup (`gh`), showing the connected user.
- Review language selection (es/en) at startup.
- PR listing and selection among the open PRs of the current repo (or a number/URL as argument).
- Review criteria selection (multi-select + option to add a custom focus).
- Initial findings summary by severity, ordered by resolution priority.
- One-by-one walkthrough of each finding with problem, solutions and proposed comments.
- One solution can produce several inline comments (multiple files or ranges).
- Multi-line inline comments (`start_line` → `line`).
- Comment language selection (es/en) before drafting comments.
- Progress persisted as JSON, with an offer to resume when the skill is relaunched.
- Final publication as a single review with a user-chosen event.
- Zero trace of AI in comments and review body.

**Out of scope (for future specs):**

- "Fix my own code" mode (apply fixes and commit).
- GitLab, Bitbucket or other platforms.
- Installation for Codex, Gemini CLI, Cursor or other agents.
- Migrating `spec` and `spec-impl` into the package.
- Replying to or resolving existing comment threads on the PR.
- CI / GitHub Actions to publish the package automatically.

---

## Data model

### Package layout

```
package.json            # name: @goldengate/skills, bin: { "goldengate-skills": "bin/cli.js" }
bin/cli.js              # dependency-free CLI (Node >= 18)
skills/
  pr-review/
    SKILL.md            # the full skill
README.md
.gitignore
```

On install, the CLI copies `skills/<skill>/` to `~/.claude/skills/<skill>/` and writes:

```json
// ~/.claude/skills/<skill>/.installed.json
{ "package": "@goldengate/skills", "version": "0.1.0", "installedAt": "2026-09-21T12:00:00Z" }
```

### Review session (for resuming)

Path: `~/.claude/pr-review/sessions/<owner>__<repo>__<pr>.json`

```json
{
  "version": 1,
  "owner": "goldengate",
  "repo": "web-app",
  "prNumber": 42,
  "headSha": "abc123",
  "githubUser": "gabrielcipriano",
  "reviewLanguage": "es",
  "commentLanguage": "en",
  "criteria": ["solid", "dry", "kiss", "scalability", "atomic-design", "performance", "bugs-logic", "security", "custom:accessibility"],
  "currentIndex": 2,
  "findings": [
    {
      "id": "F1",
      "priority": 1,
      "severity": "critical",
      "criterion": "security",
      "title": "Token exposed in logs",
      "problem": "Detailed explanation of the problem...",
      "solutions": [
        {
          "id": "S1",
          "title": "Remove the log",
          "description": "...",
          "comments": [
            { "path": "src/auth.ts", "startLine": 15, "line": 19, "side": "RIGHT", "body": "...", "inDiff": true }
          ]
        }
      ],
      "status": "pending",
      "chosenSolutionIds": [],
      "finalComments": []
    }
  ],
  "createdAt": "2026-09-21T12:00:00Z",
  "updatedAt": "2026-09-21T12:10:00Z"
}
```

Conventions:

- `severity`: `critical` | `high` | `medium` | `low`.
- `priority`: integer 1..N, the order in which findings are walked (1 = resolve first).
- `status`: `pending` | `approved` | `discarded`.
- `startLine` is omitted for single-line comments.
- `inDiff: false` → the comment goes into the review body with a `file:15-19` reference.
- Base criteria: `solid`, `dry`, `kiss`, `scalability`, `atomic-design`, `performance`, `bugs-logic`, `security`. User-defined ones use the `custom:` prefix.

---

## `/pr-review` skill flow

Cross-cutting rule: **every user decision is an `AskUserQuestion`** with clear options, the recommended one first and labeled `(Recommended)`. Free text only through the native "Other" option (editing a comment, adding a criterion). Max 4 options per question; if there are more, split them across several questions or paginate with "See more".

1. **Pending sessions.** Look for JSON files in `~/.claude/pr-review/sessions/`. If any exist, ask: `Continue review of #42` / `Start new` / `Discard pending`. If `headSha` changed, warn that the PR has new commits and recommend starting over.
2. **GitHub connection.** `gh auth status` + `gh api user --jq .login`. Show `✓ Connected to GitHub as @user`. If it fails, point to `! gh auth login` and stop.
3. **Review language** (es/en): language of the conversation and the explanations.
4. **PR selection.** `gh pr list --json number,title,author,headRefName,reviewRequests`. Options show `#N title (author)`, flagging `👀 review requested`. Paginated 3 at a time + "See more". If the argument carries a number/URL, skip the question.
5. **Criteria.** Multi-select across two questions: (SOLID, DRY, KISS, Scalability) and (Atomic Design, Performance, Bugs/logic, Security). "Other" lets the user add a custom focus.
6. **Context loading.** `gh pr diff`, full changed files, the reviewed repo's `CLAUDE.md`/`AGENTS.md`, and related files (imports/usages) when a finding needs them. Ignore lockfiles, `dist/`, `build/`, `*.min.*`, snapshots and generated files.
7. **Summary.** Table: total, count per severity, list ordered by priority (`#1 🔴 critical — Token exposed in logs — src/auth.ts:15-19`). JSON is saved.
8. **Comment language** (es/en).
9. **Step by step** for each finding, in priority order:
   - `Finding 1/5 · 🔴 Critical · Security`
   - **This is the problem:** detailed explanation with the code snippet.
   - **These are the possible solutions:** 2–3 solutions; each lists its N proposed inline comments (file, range, text).
   - Question (multi-select): solutions to include + `Discard finding`.
   - Then ask: `Post as is` / `Edit a comment` / `Add more context` (edit/add is the recommended one, encouraging collaboration). Edit/add uses "Other" as free text.
   - Save the JSON after every decision.
   - Headings follow the review language ("Este es el problema" / "Estas son las posibles soluciones" in Spanish).
10. **Final review.** List all approved comments. Ask for the event: `COMMENT` / `REQUEST_CHANGES` / `APPROVE`, recommending based on severity (critical/high → `REQUEST_CHANGES`). If the PR author is the user, offer only `COMMENT`. Ask whether to add a general body.
11. **Anti-AI check** on every `body`: reject `Co-Authored-By`, `Generated with`, `🤖`, `Claude`, `Anthropic`, `AI`/`IA` as a signature. If anything is detected, remove it and show the change.
12. **Final confirmation** (`Publish review` / `Go back and review` / `Cancel`). Publish with `gh api repos/{owner}/{repo}/pulls/{n}/reviews` (`commit_id`, `event`, `body`, `comments[]` with `path`, `line`, `start_line`, `side`, `start_side`). `inDiff: false` comments go into the body.
13. On success: show the review URL and delete the JSON. On failure: keep the JSON and show the error.

---

## Implementation plan

1. Create `package.json` (`@goldengate/skills`, `version: 0.1.0`, `bin`, `files: ["bin", "skills"]`, `engines.node >= 18`), `.gitignore` and a minimal `README.md`. Verifiable: `npm pack --dry-run` lists the files.
2. Create `bin/cli.js` with argument parsing and `list` (reads the package's `skills/` and flags those installed in `~/.claude/skills/`). Verifiable: `node bin/cli.js list`.
3. Add `install <skill>`: recursive copy, write `.installed.json`; if it already exists ask `[y/N]` unless `--force`. Clear error if the skill does not exist.
4. Add `update <skill>` (overwrites without asking) and `uninstall <skill>` (asks `[y/N]` unless `--force`).
5. Create `skills/pr-review/SKILL.md` with frontmatter (`name: pr-review`, `description`) and flow steps 1–4 (sessions, GitHub connection, language, PR selection). Verifiable: install and launch `/pr-review` in a repo with PRs.
6. Add steps 5–8 (criteria, context loading, prioritized summary, comment language) and the session JSON schema.
7. Add step 9 (one-by-one walkthrough, solutions with multiple comments, collaborative editing, JSON saving).
8. Add steps 10–13 (event, anti-AI check, publishing with `gh api`, out-of-diff fallback, JSON cleanup).
9. Complete `README.md` (npx installation, commands, requirements: Node 18+, authenticated `gh`).
10. Publish: `npm publish --access public` under the `@goldengate` scope.

---

## Acceptance criteria

- [x] `npx @goldengate/skills list` shows `pr-review` as available.
- [x] `npx @goldengate/skills install pr-review` creates `~/.claude/skills/pr-review/SKILL.md` and `.installed.json`.
- [x] Reinstalling without `--force` asks for confirmation; with `--force` it overwrites without asking.
- [x] `update pr-review` overwrites with the package version.
- [x] `uninstall pr-review` removes `~/.claude/skills/pr-review/` after confirming.
- [x] `install nonexistent` exits with a non-zero code and a clear message.
- [x] The package has no entries in `dependencies`.
- [ ] `/pr-review` without authenticated `gh` points to `gh auth login` and does not continue.
- [ ] With authenticated `gh` it shows `Connected to GitHub as @<user>`.
- [ ] Every user decision is presented as an option selection; none is an open question.
- [ ] Review language is asked before listing PRs, and comment language before the walkthrough.
- [ ] With more than 3 open PRs, a "See more" option appears.
- [ ] The 8 base criteria appear as options and a custom one can be added.
- [ ] The summary shows the count per severity and the list ordered by priority.
- [ ] Every finding shows literally "This is the problem" and "These are the possible solutions" (or their Spanish equivalents).
- [ ] A solution with comments on 2 files posts 2 inline comments.
- [ ] A comment on lines 15–19 inside the diff is posted as a multi-line inline comment.
- [ ] A comment outside the diff appears in the body with `file:line` and the user is warned.
- [ ] Nothing is posted to GitHub before the final confirmation.
- [ ] The published review contains no `Co-Authored-By`, `Generated with`, `🤖`, `Claude` or any mention of AI.
- [ ] Interrupting mid-session and relaunching `/pr-review` offers to continue from the pending finding.
- [ ] After a successful publish, the session JSON is deleted.
- [ ] On the user's own PR only the `COMMENT` event is offered.

---

## Implementation notes

Decisions taken during implementation (branch `spec-01-pr-review-skill-npx`):

- **CLI safety:** `update` and `uninstall` only touch skills whose `.installed.json` says they were installed by this package; `uninstall` validates the skill name (no path traversal). `install`/`update` refuse skills that contain symbolic links (added after review, at the user's request).
- **CLI prompts:** without an interactive terminal, `[y/N]` prompts count as "no"; aborting exits with code 1. Overwriting deletes the old folder first (no stale files).
- **Comment bodies** are drafted in step 9, after the comment language is chosen (step 8); the analysis in step 6 only stores comment locations.
- **Criteria question 2** lists `Bugs/logic` and `Security` first, as recommended options.
- **Step 9:** `Edit a comment` is the recommended option and goes first; `Post as is` is last.
- **Comments on removed lines** are supported (`side: LEFT`).
- **Anti-AI check:** an `AI`/`IA` mention that is the subject matter of the PR is removed only after asking the user; everything else is removed automatically, and a `grep` on the final payload blocks publishing.
- **Step 13:** when GitHub rejects out-of-diff comments (422), the skill offers to move them to the body and retry, going through preview and confirmation again.
- **Release order:** merge to `main`, tag `v0.1.0` and GitHub release, then `npm publish` from `main` (step 10 runs last). Added `repository`/`homepage`/`bugs`/`author` to `package.json`, plus `LICENSE` (MIT) and `CHANGELOG.md`.
- **Next spec candidates:** distribution through skills.sh / `npx skills add`, other agents, `npm publish --provenance` from GitHub Actions.

Verification: CLI criteria checked with `npx --package=<tarball> goldengate-skills` and a throwaway `HOME`. `/pr-review` criteria require a manual run in Claude Code.

---

## Decisions

- **Yes:** only "other people's PR → comment" mode. Fixing your own code is a different flow, a different spec.
- **Yes:** GitHub only, via `gh`. Already installed and authenticated on the team; avoids handling custom tokens.
- **No:** GitHub MCP. `gh` is more predictable and portable.
- **Yes:** accumulate and publish a single review at the end. Less notification noise and a summary before sending.
- **No:** posting comment by comment.
- **No:** PENDING review on GitHub for resuming. Local JSON was preferred.
- **Yes:** global JSON in `~/.claude/pr-review/sessions/`. Does not pollute the reviewed repo and needs no `.gitignore`.
- **Yes:** 100% option-selection interaction (`AskUserQuestion`). Explicit request: visual and simple.
- **Yes:** the skill encourages editing/adding to each comment. The reviewer remains the author.
- **Yes:** one solution = 1..N comments. Some fixes span several files or ranges.
- **Yes:** multi-line inline + fallback to body when the range is not inside a diff hunk. GitHub rejects inline comments outside the diff.
- **Yes:** user-chosen event, with a severity-based recommendation.
- **Yes:** zero trace of AI, with an explicit check before publishing.
- **Yes:** public npm with the `@goldengate/skills` scope. Semver versioning, npx with no config.
- **No:** `npx github:...`. No clean versioning.
- **Yes:** collection package with a generic CLI. Future skills need no new package.
- **Yes:** Claude Code as the only target. Other agents go in future specs.
- **Yes:** name `/pr-review`. Avoids colliding with Claude Code's native `/code-review`.
- **Yes:** full project context when needed (full changed files, `CLAUDE.md`, related files). The user considers it important.
- **Yes:** excluding generated files as the only explicit token optimization.
- **No:** criteria in separate files or single-pass-per-file analysis. Not chosen; revisit if token usage turns out high.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| `@goldengate` scope does not exist or is unavailable on npm | Create the npm org before step 10; fallback: another scope chosen by the team. |
| `AskUserQuestion` limits questions to 4 options | Paginate PRs 3 at a time + "See more"; split criteria across 2 questions. |
| PR gets new commits between sessions | Compare `headSha` on resume; recommend starting over. |
| Comment lines no longer exist in the diff | Validate against the diff before publishing; move to body. |
| Very large PR drives token usage up | Exclude generated files; load related files only on demand. |
| GitHub rejects `APPROVE`/`REQUEST_CHANGES` on own PR | Offer only `COMMENT` if the author is the user. |
| The model slips an AI signature into the text | Mandatory anti-AI check on every `body` before publishing. |

---

## What is **not** in this spec

- Fix-own-code mode / commits.
- GitLab, Bitbucket.
- Installation for Codex, Gemini CLI, Cursor.
- Migrating `spec` and `spec-impl` into the package.
- Replying to or resolving existing threads.
- Automatic publishing via CI.

Each of these, if it lands, goes in its own spec.
