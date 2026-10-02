---
name: spec-split
description: Split an approved spec into sub-specs where every sub-spec is one specific functionality delivered as one pull request, and every step of a sub-spec is one commit. Reads the spec and the project's conventions, proposes the split (sub-specs, steps, commit messages, PR titles, branches), asks for confirmation, then writes one `specs/NN.k-slug.md` per sub-spec and a delivery table in the parent spec. Never writes code, creates branches, commits or opens PRs. Use after `/spec` and before `/spec-impl`, when a spec is too big for a single PR, e.g. "/spec-split", "/spec-split 09", "/spec-split 09-part-management", "split this spec into PRs".
argument-hint: "[NN | NN-slug | path to spec]"
allowed-tools: Read, Glob, Grep, Write, Edit, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(git log:*), Bash(git branch:*), Bash(git status:*)
---

# /spec-split — Split a spec into one PR per functionality

## Session context

Specs in this repo:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Recent commit style:
!`git log --oneline -15 2>/dev/null || echo "Not a git repository"`

Branches:
!`git branch -a 2>/dev/null`

---

You take a spec that is already well written and cut it into **specific deliverables**:

| Level | Rule |
| --- | --- |
| Spec (card) | It is an **objective**, not a delivery unit. It is split into specific, measurable functionalities. |
| Sub-spec | **One functionality.** It becomes one pull request. |
| Step | **One commit.** Steps are small, ordered and each one leaves the repo working. |
| Pull request | **Delivers one functionality.** One spec can (and usually does) produce several PRs. |

**You don't write code here.** You only write Markdown files in `specs/`, and only after the user confirms the split.

Argument received: `$ARGUMENTS` (spec number, slug or path; empty means "ask").

Talk to the user in the language they write in. Write the sub-specs in the **parent spec's language**, using its header labels and section names.

---

## Hard rules

1. **Split by functionality.** Never by file, by layer for its own sake, or by hours. A piece is a functionality when it can be described in one sentence and has a result someone can verify.
2. **Every sub-spec passes the four checks** (see Phase 3). If one fails, re-split before showing it.
3. **One step = one commit.** Every step has exactly one commit message. No step says "and also…"; if it does, it is two steps.
4. **Never write before confirmation.** Phase 4 is the only phase that writes files, and only after the user approves the split in Phase 3.
5. **Only `.md` files in `specs/`.** No code, no `git checkout -b`, `git commit`, `git push`, no `gh`. Branch names and PR titles are proposals written in the sub-specs; `/spec-impl` and the author act on them.
6. **Don't rewrite the parent spec.** You only add the delivery header line and the "Delivery in sub-specs" section. Its scope, decisions and criteria stay as they are.
7. **Don't invent scope.** Everything in a sub-spec comes from the parent spec. If the split reveals something the parent does not cover (a missing migration, a missing test setup), ask; don't add it silently.
8. **Every user decision is an `AskUserQuestion`.** Max 4 options; the recommended option goes first with ` (Recommended)` in its label.

---

## Phase 1 — Locate the spec

If `$ARGUMENTS` is empty: list the specs from the session context and ask which one to split (use `AskUserQuestion` with the most recent approved specs as options). Stop until they answer.

If it has a value: find the file in `specs/` by full name, number (`09`) or slug (`part-management`). If several files share the number, ask which one. If none matches, show the list and ask.

Then read the spec and check:

- **Status.** Continue only if it means "Approved" in any language (`Approved`, `Aprobado`, `aprobado`, `Aprovado`, …). If it is `Draft`/`In review`, say: "Approve the spec before splitting it: the split depends on its scope and decisions." and stop. If it is `Implemented`/`Obsolete`, say there is nothing to split and stop.
- **Already split.** If the spec says it is a parent spec, has a "Delivery in sub-specs" section, or `specs/NN.1-*` already exists, show the existing sub-specs and ask whether to stop (recommended) or re-plan only the sub-specs not yet implemented. Never overwrite an existing sub-spec file.

## Phase 2 — Learn the project's conventions

Read, in this order, stopping when you have enough:

1. `CLAUDE.md`, then `AGENTS.md` (conventions, commands, test policy).
2. The two most recent specs, and any existing sub-specs (`NN.k-*.md`) — they are the best model for format, language and level of detail. Match them.
3. The session context above:
   - **Commit style.** If `git log` shows Conventional Commits (`type(scope): message`), use them with the scopes the repo already uses. Otherwise copy the dominant style. If there is no history, use Conventional Commits.
   - **Commit language.** The language `git log` uses, not the spec's.
   - **Branch naming and base.** The prefix the repo uses (`specNN/k-slug`, `spec-NN-slug`, `feat/…`). The base branch: `integration`, `develop` or `main`, whichever the recent feature branches target.
   - **Test commands.** From `package.json`/`CLAUDE.md` (`pnpm test:unit`, `npm test`, …), to write "how to verify".

Never run commands beyond those in `allowed-tools`. Never read secrets or `.env` files.

## Phase 3 — Propose the split

### 3.1 Find the functionalities

Go through the spec's scope, data model, implementation plan and acceptance criteria and group them into functionalities. Useful questions:

- Which part can be **verified alone**? (A form with its validations, without backend. A service with its contract, tested in isolation. The integration that closes the flow end to end.)
- Which part is a **prerequisite** for others? (Shared rules, schema, helpers.) It goes first and must be additive.
- Which change **removes** or **switches** something? (Retiring old permissions, switching the UI to the new path.) It goes after the new path exists.
- What can be **left out** of the first PRs without breaking anything? Prefer additive PRs first, the switch-over last.

Typical shapes (not templates; follow the spec):

- UI → services → integration.
- Shared rules → backend capability (unused yet) → frontend switches to it → retire the old path.

If the spec is small enough for one PR (it already passes the checks and the signals below), say so and propose a single sub-spec — or no split at all, and recommend running `/spec-impl` directly.

### 3.2 Check every sub-spec

Each sub-spec must pass **all four**:

1. It is described in **one sentence without "and"/"y"**.
2. It has a **result someone else can verify** (a test, a screen, a query, a command).
3. It can be **reviewed without reading the other sub-specs**.
4. Merging it **does not leave the repo broken** (builds, lint and tests pass; nothing half-wired is reachable by users).

And every PR must avoid the "split it" signals:

| Good PR | Split it when |
| --- | --- |
| Understood by reading the title. | The title needs "and" or a list. |
| Touches one functionality. | It mixes frontend, services and backend in one diff. |
| Reviewed in one sitting. | The reviewer would need to schedule time to read it. |
| Testable on its own. | Testing it requires waiting for another PR. |

### 3.3 Break each sub-spec into steps

- Step 1 is always the sub-spec itself: `docs(spec): add sub-spec NN.k for <functionality>` (in the repo's commit style and language). The reviewer reads the plan first.
- Each following step is one small, verifiable change that compiles and passes the project's checks on its own. Its tests go **in the same commit** unless the project's conventions say otherwise.
- The commit message names the step it closes: `type(scope): <what this step does>`. No "WIP", "fixes", "more changes", no two actions joined by "and".
- Order the steps in the order the implementation is reasoned about (structure → behavior → presentation; model → logic → wiring → tests against real services).
- A step with no tests of its own says why (e.g. "the schema is tested in step 6").

### 3.4 Show the proposal

Show the whole split in one message, before asking anything:

```text
SPEC NN — <title>  →  n sub-specs / n PRs

NN.1 <functionality>                         PR 1 · branch specNN/1-slug ← base main
     Objective: <one sentence, no "and">
     Verify: <how someone else verifies it>
     1. Sub-spec                             docs(spec): add sub-spec NN.1 for …
     2. <step>                               feat(scope): …
     3. <step>                               test(scope): …

NN.2 <functionality>                         PR 2 · branch specNN/2-slug ← base specNN/1-slug
     ...

Checks: NN.1 ✓✓✓✓ · NN.2 ✓✓✓✓ · …
Parent criteria covered: <criterion → NN.k> (every acceptance criterion of the parent maps to exactly one sub-spec)
```

Then a short note on any judgment call (why a piece went first, why two things stayed together).

**Base branch.** If a PR needs code from the previous one, its base is the previous branch (stacked PRs, merged in order). If it is independent, its base is the repo's base branch. Say which, and note that stacked PRs must be merged in order.

**Parent criteria coverage.** Every acceptance criterion of the parent spec must land in exactly one sub-spec. If one is not covered, the split is incomplete: fix it before showing it.

Ask with `AskUserQuestion`:

- **Write the sub-specs (Recommended)**
- **Adjust the split** — then ask what to change (merge, split further, reorder, rename, move a step), apply it, re-run the checks and show the proposal again.
- **Cancel** — write nothing.

Repeat until the user picks "Write the sub-specs" or "Cancel".

## Phase 4 — Write the files

Only after confirmation.

### 4.1 Sub-spec files

Write `specs/NN.k-slug.md` for each sub-spec (kebab-case slug from its objective; match how existing sub-specs are named if there are any). Use the parent's language and labels. Shape:

```markdown
# SPEC NN.k — <Functionality title>

> **Status:** Draft
> **Parent spec:** [SPEC NN](NN-parent-slug.md)
> **PR:** k of n — branch `<branch>`, base `<base>`
> **Previous:** [SPEC NN.(k-1)](…) · **Next:** [SPEC NN.(k+1)](…)
> **Objective:** <one sentence, no "and">

---

## Scope

**In:**

- <exact items taken from the parent spec, with real file and symbol names>

**Out of scope:** <what the next sub-specs do; name them>. <What stays unchanged, e.g. "no file in src/ changes">.

---

## Steps

Every step is one commit, with its tests in the same commit. Every commit builds and passes `<project checks>`. If a step that was not planned appears during implementation, add it here and close it with its own commit.

1. **Sub-spec.** This file.
   - Commit: `docs(spec): add sub-spec NN.k for <functionality>`
2. **<Step title>.** <What changes, which files, which tests.>
   - Commit: `<type(scope): message>`
...

---

## Acceptance criteria

- [ ] <criteria taken from the parent spec, verifiable, boolean>

---

## How to verify

<Commands and manual checks someone else can run to confirm the result.>

---

## Pull request

**Title:** `<what functionality it delivers — no "and">`

**Description:**

> <One paragraph: what this PR delivers and what it does not (link to the next sub-spec).>
>
> **What was tested:** <tests added/run>.
> **How to verify:** <short steps>.
> Sub-spec: `specs/NN.k-slug.md` · Parent: SPEC NN · PR k of n<, base `<base>`: merge after PR k-1>.

**Heads-up to the reviewer (send before opening the PR):**

> <"I'm about to open a PR for <functionality>, I'll assign it to you." in the parent spec's language.>
```

Omit **Previous** / **Next** when they don't exist. Mark `Status` as `Draft` (or the repo's equivalent): the user approves each sub-spec before `/spec-impl`.

### 4.2 Parent spec

Edit the parent spec, without touching anything else:

1. Add a header line after the existing ones (same labels language): `> **Type:** parent spec. Delivered in n sub-specs, one per PR (see "Delivery in sub-specs").`
2. Add this section at the end (or before the risks section, if the existing parent specs in the repo do so):

```markdown
---

## Delivery in sub-specs

| Sub-spec | Functionality | PR | Branch | Base |
| --- | --- | --- | --- | --- |
| [NN.1](NN.1-slug.md) | <objective> | 1 of n | `<branch>` | `<base>` |
| … | … | … | … | … |

<"Stacked PRs: merge in order." when applicable.>
```

### 4.3 Final message

Tell the user, and stop:

- The files created and the parent spec edited.
- The sub-specs are `Draft`: re-read and approve each one, then run `/spec-impl NN.1` (and so on, in order).
- If PRs are stacked: merge them in order and retarget the next PR's base after each merge.
- Reminder: send the heads-up to the reviewer before opening each PR.

Do not offer to implement, create branches or open PRs.

---

## Quick reference

- Is the spec deliverable in one go? If not, split it by functionality.
- Does every sub-spec have one specific, measurable purpose (one sentence, no "and")?
- Is the sub-spec written before implementing (step 1)?
- Does every commit close one step?
- Does every PR deliver one functionality?
- Is every acceptance criterion of the parent covered by exactly one sub-spec?
