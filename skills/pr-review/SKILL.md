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
   - **Continue** (head unchanged or `Continue anyway`) → load the session: `githubUser`, `reviewLanguage`, `commentLanguage`, `criteria`, `findings`, `currentIndex`. Run Step 2 (connection check) and verify the connected login equals `githubUser`; if it differs, warn and ask `Continue as @<current> (Recommended)` / `Cancel`. Then skip Steps 3–8 and resume the walkthrough (Step 9) at `findings[currentIndex]`, using the saved languages.
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
