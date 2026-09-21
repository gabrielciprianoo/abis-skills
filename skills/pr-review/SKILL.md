---
name: pr-review
description: Review someone else's GitHub pull request step by step. Detects findings by chosen criteria, walks through each one with the user (problem, possible solutions, proposed inline comments), and publishes a single review via `gh` only after explicit confirmation. Comments are written as the reviewer, with no trace of AI. Use when the user wants to review a PR, e.g. "/pr-review", "/pr-review 42", "/pr-review https://github.com/org/repo/pull/42".
---

# /pr-review — Guided GitHub PR review

You help the user review **another person's** GitHub pull request. You find issues, explain them, propose solutions and draft inline comments. The user decides everything; you publish nothing until they confirm at the very end.

Argument received: `$ARGUMENTS` (optional PR number, `#N`, or PR URL).

---

## Hard rules (apply to every step)

1. **Every user decision is an `AskUserQuestion`.** Never ask an open question in plain text. Put the recommended option first and add ` (Recommended)` to its label. Free text only comes through the native "Other" option (editing a comment, adding a criterion, typing a PR number).
2. **Max 4 options per question.** If there are more, split them across several questions or paginate with a `See more` option.
3. **Read-only on GitHub until the final confirmation.** Only read commands (`gh auth status`, `gh api user`, `gh pr list`, `gh pr view`, `gh pr diff`, `gh api` with GET) are allowed before the user picks `Publish review`. No comments, no reviews, no labels, no approvals.
4. **Never modify the reviewed code.** No edits, no commits, no branch switches, no `gh pr checkout`. This skill only comments.
5. **Stay inside `gh`.** Do not use GitHub MCP tools or custom tokens.

---

## Step 1 — Pending sessions

Session files live in `~/.claude/pr-review/sessions/<owner>__<repo>__<pr>.json` (schema in the "Session JSON" section).

1. List them: `ls -t ~/.claude/pr-review/sessions/*.json 2>/dev/null`. If there are none, go to Step 2 silently.
2. Read each file (`owner`, `repo`, `prNumber`, `headSha`, `currentIndex`, `findings`, `updatedAt`).
3. For each session, try to get the current head of the PR: `gh pr view <prNumber> -R <owner>/<repo> --json headRefOid,state --jq '.headRefOid + " " + .state'`. If the command fails (e.g. `gh` not authenticated), skip this check; Step 2 will deal with the connection.
4. Ask with `AskUserQuestion` (header `Session`):
   - One option per session, up to 2, most recently updated first, sessions of the current repo before others: label `Continue review of #<prNumber>`, description `<owner>/<repo> · finding <currentIndex + 1>/<total> · updated <updatedAt>`. If the PR head changed, add to the description: `⚠️ PR has new commits since this session`. If the PR is no longer open, add `⚠️ PR is <state>`.
   - `Start new` — review a different PR (or the same one from scratch). Pending sessions are kept.
   - `Discard pending` — delete saved sessions.
   - If there are more than 2 sessions, mention in the `Start new` description how many other sessions exist; the user can reach them by relaunching after discarding or finishing others.
   - Recommendation: `Continue review of #N` for the most recent session **unless** its PR has new commits or is not open; in that case recommend `Start new`.
5. Handle the answer:
   - **Continue** and `headSha` changed → warn: "PR #N has new commits since this session. Line numbers in saved comments may be wrong." Ask (header `New commits`): `Start over on this PR (Recommended)` / `Continue anyway`. Start over → delete that session file and go to Step 2 with that PR preselected (skip the PR question in Step 4).
   - **Continue** (head unchanged or `Continue anyway`) → load the session: `githubUser`, `reviewLanguage`, `commentLanguage`, `criteria`, `findings`, `currentIndex`. Run Step 2 (connection check) and verify the connected login equals `githubUser`; if it differs, warn and ask `Continue as @<current> (Recommended)` / `Cancel`. Then skip Steps 3–8 and resume the walkthrough (Step 9) at `findings[currentIndex]`, using the saved languages. If `commentLanguage` is `null` (the session was interrupted before Step 8), run Step 8 first.
   - **Discard pending** → if there is only one session, delete it. If there are several, ask a multi-select question (header `Discard`) listing them (paginate if more than 4) and delete the selected ones. Then continue to Step 2 as a new review.
   - **Start new** → go to Step 2.

---

## Step 2 — GitHub connection

1. Check `gh` exists: `command -v gh`. If missing, tell the user: "GitHub CLI (`gh`) is not installed. Install it from https://cli.github.com and run `! gh auth login`." **Stop.**
2. Run `gh auth status`. If it fails, tell the user: "You are not logged in to GitHub. Run `! gh auth login` and then relaunch `/pr-review`." **Stop.** Do not continue with any other step.
3. Get the login: `gh api user --jq .login`. If it fails, same message as above and **stop**.
4. Show exactly: `✓ Connected to GitHub as @<login>`
5. Keep `<login>` as `githubUser` for the rest of the session.

---

## Step 3 — Review language

Ask with `AskUserQuestion` (header `Language`), question text in both languages: "Review language / Idioma de la revisión?"

- `Español` — explanations and conversation in Spanish.
- `English` — explanations and conversation in English.

Recommend the language the user has been writing in; if unknown, recommend `English`.

Store it as `reviewLanguage` (`es` | `en`). From now on, **all** your messages, questions and option labels are in that language. (The comment language is chosen separately in Step 8.)

---

## Step 4 — PR selection

### 4.1 Argument given

If `$ARGUMENTS` contains a PR reference, skip the question:

- `42` or `#42` → PR 42 in the current repo.
- `https://github.com/<owner>/<repo>/pull/42[/...]` → PR 42 in `<owner>/<repo>` (may differ from the current repo).

Validate it: `gh pr view 42 [-R <owner>/<repo>] --json number,title,author,state,url`. If it does not exist or `state` is not `OPEN`, tell the user ("PR #42 is MERGED/CLOSED/not found") and fall back to 4.2.

### 4.2 List and choose

1. Resolve the repo: `gh repo view --json owner,name --jq '.owner.login + "/" + .name'`. If this fails (not a GitHub repo) and no URL was given, tell the user: "This folder is not a GitHub repository. Run `/pr-review` inside the repo or pass a PR URL." **Stop.**
2. List open PRs: `gh pr list --json number,title,author,headRefName,reviewRequests --limit 100`.
3. If there are no open PRs: say so and **stop**.
4. Order: PRs where `reviewRequests` contains `githubUser` first (flag them `👀 review requested`), then the rest by number, newest first.
5. Ask with `AskUserQuestion` (header `PR`), paginated:
   - If 4 or fewer PRs remain, show all of them and no `See more`.
   - Otherwise show 3 PRs + `See more`. `See more` asks again with the next 3 (or the last ≤4).
   - PR option label: `#<number> <title> (<author.login>)`, prefixed with `👀 ` when review is requested. Truncate the title so the label stays under ~60 characters.
   - PR option description: `<headRefName>` plus `· 👀 review requested` when applicable.
   - Recommended: the first review-requested PR on the current page, if any. Otherwise no recommendation.
   - The user may type a PR number through "Other"; validate it as in 4.1.

### 4.3 Load PR metadata

For the chosen PR run:

```sh
gh pr view <n> [-R <owner>/<repo>] --json number,title,author,url,headRefOid,headRefName,baseRefName,body,additions,deletions,changedFiles
```

Keep `owner`, `repo`, `prNumber`, `headSha` (= `headRefOid`), `author.login`, `url`. Show a one-line header:

`#<n> <title> — @<author> · <headRefName> → <baseRefName> · +<additions> −<deletions> in <changedFiles> files`

If a pending session exists for this same PR (`<owner>__<repo>__<n>.json`) and the user chose `Start new`, warn that it will be replaced when the new summary is saved.

If `author.login` equals `githubUser`, note it: only the `COMMENT` event will be available when publishing.

---

## Step 5 — Review criteria

Ask **one** `AskUserQuestion` call with two multi-select questions (header `Criteria`):

**Question 1 — "Which design criteria should the review focus on?"**

| Label | Description | Id |
| --- | --- | --- |
| `SOLID` | Single responsibility, open/closed, substitution, interface segregation, dependency inversion | `solid` |
| `DRY` | Duplicated logic, copy-pasted code, missing abstractions | `dry` |
| `KISS` | Needless complexity, over-engineering, clever code that hurts readability | `kiss` |
| `Scalability` | Growth in data, traffic or features; coupling that blocks evolution | `scalability` |

**Question 2 — "Which quality criteria should the review focus on?"**

| Label | Description | Id |
| --- | --- | --- |
| `Bugs/logic (Recommended)` | Wrong behavior, edge cases, null handling, race conditions, broken contracts | `bugs-logic` |
| `Security (Recommended)` | Injection, secrets, authz/authn, unsafe input, data exposure | `security` |
| `Performance` | Unnecessary work, N+1 queries, re-renders, blocking I/O, memory | `performance` |
| `Atomic Design` | Component hierarchy (atoms/molecules/organisms), reuse, UI composition | `atomic-design` |

Mention in the question text that "Other" adds a custom focus (e.g. accessibility, testing, naming). Each custom focus is stored as `custom:<kebab-case>` (e.g. `custom:accessibility`).

If nothing was selected in either question, ask (header `Criteria`): `Use Bugs/logic + Security (Recommended)` / `Choose again`.

Store the result as `criteria` (array of ids).

---

## Step 6 — Context loading and analysis

### 6.1 Files

1. List changed files: `gh pr diff <n> -R <owner>/<repo> --name-only`.
2. **Ignore** (do not read, do not review) and tell the user which were skipped:
   - Lockfiles: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `composer.lock`, `Gemfile.lock`, `poetry.lock`, `Pipfile.lock`, `Cargo.lock`, `go.sum`.
   - Build output: anything under `dist/`, `build/`, `out/`, `.next/`, `coverage/`.
   - Minified files: `*.min.*`.
   - Snapshots: `__snapshots__/`, `*.snap`.
   - Generated files: `*.generated.*`, `*.g.dart`, `*.pb.go`, `*_pb2.py`, or files whose first lines contain `@generated`, `DO NOT EDIT` or `auto-generated`.
3. Get the diff: `gh pr diff <n> -R <owner>/<repo>`. Work only with the hunks of non-ignored files.
4. For every non-ignored, non-deleted file, read the **full file at the PR head** without switching branches:
   `gh api -H "Accept: application/vnd.github.raw" "repos/<owner>/<repo>/contents/<path>?ref=<headSha>"`
5. Read the reviewed repo's guidelines at the base branch, if they exist: `CLAUDE.md` and `AGENTS.md` at the root and in the directories of the changed files (same `gh api` call with `ref=<baseRefName>`; a 404 just means it does not exist). Findings must respect these conventions.
6. **Related files on demand only:** when a finding depends on code outside the diff (a called function, an interface, usages of a changed export), fetch that file with the same `gh api` call (or `grep` locally if the current folder is that repo). Do not bulk-load the project.

### 6.2 Diff map

From each file's hunk headers `@@ -a,b +c,d @@`, record the line ranges each hunk covers:
- `RIGHT` side (new code): lines `c` … `c + d - 1`.
- `LEFT` side (removed code): lines `a` … `a + b - 1`.

A comment is `inDiff: true` only if its whole range (`startLine`…`line`) sits inside **one** hunk on its `side`. Otherwise `inDiff: false`: it will go into the review body with a `path:startLine-line` reference.

### 6.3 Analysis

Review the changes against the selected `criteria` only. For each real issue create a finding:

- **Be concrete.** Every finding points to exact lines and is verified against the full file, not only the diff. No speculation, no style nitpicks outside the criteria, no praise-only findings.
- **Merge duplicates.** The same issue in several places is one finding whose solutions carry several comments.
- **Severity:**
  - `critical` 🔴 — security hole, data loss, crash or broken core behavior in normal use.
  - `high` 🟠 — bug in a realistic scenario, or a design problem that will clearly cause defects.
  - `medium` 🟡 — maintainability/scalability/performance issue with real but non-immediate cost.
  - `low` 🔵 — minor improvement that is still worth mentioning.
- **Priority** (1..N, 1 = resolve first): order by severity, then by impact, then put findings that other findings depend on first (e.g. fix the wrong abstraction before its duplicated usages).
- **Solutions:** 2–3 per finding, each with a short `title`, a `description` (in `reviewLanguage`) and 1..N comment **locations** (`path`, `startLine`, `line`, `side`, `inDiff`). Leave each comment `body` as `""`: bodies are drafted in Step 9, after the comment language is chosen.
- Write `title` and `problem` in `reviewLanguage`. `problem` includes the relevant code snippet.

If there are **no findings**, say so clearly and ask (header `No findings`): `Finish without publishing (Recommended)` / `Go to publishing` (e.g. to approve or leave a general comment → Step 10 with no inline comments).

---

## Step 7 — Summary

Show, in `reviewLanguage`:

```
PR #42 · 5 findings

| Severity    | Count |
| ----------- | ----- |
| 🔴 Critical |   1   |
| 🟠 High     |   2   |
| 🟡 Medium   |   1   |
| 🔵 Low      |   1   |

#1 🔴 critical — Token exposed in logs — src/auth.ts:15-19
#2 🟠 high — Missing null check on user profile — src/profile.ts:42
...
```

- The list is ordered by `priority`. The location is the first comment location of the first solution (`path:line` or `path:startLine-line`).
- Then **save the session JSON** (see "Session JSON") with `currentIndex: 0`, `commentLanguage: null`, every finding `status: "pending"`. Create the folder first: `mkdir -p ~/.claude/pr-review/sessions`. This replaces any previous session file for the same PR.

---

## Step 8 — Comment language

Ask (header `Comments`): "In which language should the PR comments be written?"

- `Español`
- `English`

Recommend the language of the PR title/description; if unclear, recommend `reviewLanguage`. This only affects comment bodies and the review body; the conversation stays in `reviewLanguage`.

Store it as `commentLanguage` and save the session JSON.

---

## Step 9 — Step by step

Walk the findings in `priority` order, starting at `findings[currentIndex]`. Skip findings whose `status` is not `pending` (already decided in a previous run). The user may stop at any time: progress is in the session JSON and Step 1 will offer to resume.

### Localized headings

Use these texts literally, according to `reviewLanguage`:

| Key | `en` | `es` |
| --- | --- | --- |
| Progress line | `Finding <i>/<total> · <severity> · <criterion>` | `Hallazgo <i>/<total> · <severidad> · <criterio>` |
| Problem | `This is the problem` | `Este es el problema` |
| Solutions | `These are the possible solutions` | `Estas son las posibles soluciones` |
| Severity | `🔴 Critical`, `🟠 High`, `🟡 Medium`, `🔵 Low` | `🔴 Crítico`, `🟠 Alto`, `🟡 Medio`, `🔵 Bajo` |

### 9.1 Draft the comment bodies

Before showing the finding, draft the `body` of every comment of every solution (those still `""`) in `commentLanguage`, then save the JSON. Each body:

- Reads as written by the reviewer (`githubUser`): first person, natural, direct and respectful. Collaborative tone ("What do you think about…", "¿Qué te parece…").
- Says what is wrong at **that** location, why it matters, and what to change. One comment = one point. Short: 1–4 sentences plus code if useful.
- When the fix replaces exactly the commented lines and `inDiff` is `true`, may include a GitHub suggestion block:
  ````
  ```suggestion
  <replacement lines>
  ```
  ````
- Contains **no trace of AI**: no `Co-Authored-By`, no `Generated with`, no `🤖`, no mention of Claude, Anthropic, AI/IA, "as an assistant", "I analyzed", etc.
- Does not reference finding ids, severities or priorities (`F1`, `🔴`, `#1`); those are internal.

### 9.2 Show the finding

```
Finding 1/5 · 🔴 Critical · Security
Token exposed in logs

**This is the problem:**
<detailed explanation, in reviewLanguage>
<code snippet with path:lines>

**These are the possible solutions:**

S1 — Remove the log
<description>
  💬 src/auth.ts:15-19 (inline)
     > <body>
  💬 src/logger.ts:8 (inline)
     > <body>

S2 — Mask the token
<description>
  💬 src/auth.ts:15-19 (inline)
     > <body>
  💬 src/config.ts:40 ⚠️ outside the diff → will go in the review body
     > <body>
```

Translate labels such as "inline" and "outside the diff → will go in the review body" to `reviewLanguage`. Comment bodies are shown in `commentLanguage`.

### 9.3 Choose solutions

Ask a **multi-select** `AskUserQuestion` (header `Solutions`), "Which solutions do you want to include in the review?":

- One option per solution (max 3): label `S<n> — <title>`, description `<N> comment(s)`. The best solution goes first with ` (Recommended)`.
- `Discard finding` — do not comment on this.

Handle the answer:

- **Nothing selected** → ask again.
- **`Discard finding` together with solutions** → ask (header `Confirm`): `Include selected solutions (Recommended)` / `Discard finding`.
- **`Discard finding`** → set `status: "discarded"`, `chosenSolutionIds: []`, `finalComments: []`, increment `currentIndex`, save the JSON, go to the next finding.
- **Solutions selected** → set `chosenSolutionIds`. Build `finalComments` as the union of their comments. If two comments share the same `path`, `side` and range, merge them into one comment (combine the bodies coherently). Save the JSON and go to 9.4.

### 9.4 Review the comments

Show `finalComments` numbered: `1. 💬 src/auth.ts:15-19` followed by the body.

Ask (header `Comments`), "How do you want to continue with these comments?":

- `Edit a comment (Recommended)` — change the wording; the review is yours.
- `Add more context` — add your own knowledge, a reason, a link or an example.
- `Post as is` — queue these comments for the final review. **Nothing is published yet.**

Handle the answer:

- **Edit a comment**
  1. If there is more than one comment, ask which one (header `Comment`), one option per comment (label `<n>. <path>:<lines>`, description = start of the body), paginating with `See more` when there are more than 4.
  2. Ask (header `Edit`), "Write the new text in 'Other', or pick an adjustment:": `Make it shorter`, `Make the tone softer`, `Make it more direct`. The typed text via "Other" is used **verbatim** as the new body; if it clearly reads as an instruction to you (e.g. "mention the RFC too"), apply it instead.
  3. Update that comment in `finalComments`, save the JSON, show the new body and ask the 9.4 question again.
- **Add more context**
  1. Choose the comment as in "Edit" step 1.
  2. Ask (header `Context`), "Write the context in 'Other', or pick one:": `Add a code suggestion` (only for `inDiff: true` comments), `Explain the impact in more detail`, `Add a usage example`. Typed text via "Other" is the user's context: weave it into the comment in the reviewer's voice, keeping the user's facts and intent.
  3. Update, save the JSON, show the new body and ask the 9.4 question again.
- **Post as is** → set `status: "approved"`, increment `currentIndex`, save the JSON, go to the next finding.

Every body the user edits or adds still follows the rules of 9.1 (no trace of AI).

### 9.5 End of the walkthrough

When no `pending` findings remain, show: `<approved> approved · <discarded> discarded · <comments> comments queued` and go to Step 10. If every finding was discarded, say so and continue to Step 10 anyway (the user may still approve or leave a general comment).

---

## Session JSON

Path: `~/.claude/pr-review/sessions/<owner>__<repo>__<prNumber>.json` (use the absolute home path when writing).

```json
{
  "version": 1,
  "owner": "goldengate",
  "repo": "web-app",
  "prNumber": 42,
  "headSha": "abc123",
  "githubUser": "octocat",
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
- `priority`: integer 1..N, the order in which findings are walked (1 = resolve first). `findings` is stored sorted by `priority`; `currentIndex` indexes into that array.
- `status`: `pending` | `approved` | `discarded`.
- `startLine` is omitted for single-line comments.
- `side`: `RIGHT` (new code) or `LEFT` (removed code).
- `body` is `""` until drafted in Step 9. `finalComments` holds the comments exactly as they will be published (same shape as `comments`).
- `inDiff: false` → the comment goes into the review body with a `path:startLine-line` reference.
- `commentLanguage` is `null` until Step 8.
- Base criteria: `solid`, `dry`, `kiss`, `scalability`, `atomic-design`, `performance`, `bugs-logic`, `security`. User-defined ones use the `custom:` prefix.

Saving rules:

- Save after the summary (Step 7), after the comment language (Step 8) and after **every** decision in Step 9.
- Always rewrite the whole file and refresh `updatedAt` (ISO 8601 UTC). Keep `createdAt` unchanged.
