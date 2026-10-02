# SPEC 04 — `/spec-split` skill

> **Status:** Draft
> **Depends on:** SPEC 01
> **Date:** 2026-10-02
> **Objective:** Add a `/spec-split` skill that turns an approved spec into sub-specs where every sub-spec is one specific functionality delivered as one PR, and every step of a sub-spec is one commit.

---

## Why this spec exists

The team works spec-driven (`/spec` → `/spec-impl`), and the specs are well written, but a single spec often describes a whole board card: frontend, services, backend and integration together. Implemented as written, that becomes one large PR that nobody can review in one sitting, with commits that are "save points" instead of steps.

The team's development conventions already define the rule:

| Level | Rule |
| --- | --- |
| Task | Split into specific, measurable functionalities. Each one is a subtask. |
| Pull request | One PR = one specific functionality. One card can produce several PRs. |
| Commit | Every subtask has its own spec, and every step of that spec closes with one commit. |

A subtask is well split when it passes four checks: it is described in one sentence without "and", it has a result someone else can verify, it can be reviewed without reading the other subtasks, and merging it does not leave the repository broken.

Doing this split by hand is slow and inconsistent. `/spec-split` does it from the spec, following those rules, and writes the result in the same format as the specs that already exist.

---

## Scope

**In:**

- `skills/spec-split/SKILL.md`: the skill.
  - Locates the spec by number, slug or path; refuses specs that are not approved or are already split.
  - Reads the project context (`CLAUDE.md`/`AGENTS.md`, the spec, recent specs and `git log`) to copy the language, header labels and commit style already in use.
  - Proposes the split: sub-specs by functionality, steps per sub-spec, one commit message per step, PR title, branch and base per sub-spec. Every sub-spec is checked against the four checks; every PR against the "split it" signals.
  - Asks the user to confirm or adjust the split before writing anything.
  - Writes one file per sub-spec (`specs/NN.k-slug.md`) and adds a "Delivery in sub-specs" section to the parent spec.
  - Every sub-spec ends with a PR draft (title, description with what was tested and how to verify it) and a heads-up message for the reviewer.
- `README.md`: `spec-split` in the "Skills" section.
- `CHANGELOG.md`: `Unreleased` entry.

**Out of scope:**

- Writing code, creating branches, committing, pushing or opening PRs. The skill only writes `.md` files; `/spec-impl` implements each sub-spec.
- Changes to `bin/cli.js`: the CLI already lists every folder under `skills/` with a `SKILL.md`.
- Shipping `/spec` and `/spec-impl` in this package.
- Version bump and release (left to the maintainer).

---

## Data model

No persisted data. The output is Markdown:

```text
specs/
  NN-parent-slug.md          ← gets "Type: parent spec" and a "Delivery in sub-specs" section
  NN.1-first-functionality.md
  NN.2-second-functionality.md
  ...
```

Each sub-spec header:

```markdown
# SPEC NN.k — Functionality title

> **Status:** Draft
> **Parent spec:** [SPEC NN](NN-parent-slug.md)
> **PR:** k of n — branch `specNN/k-slug`, base `<base>`
> **Previous:** [SPEC NN.(k-1)](...) · **Next:** [SPEC NN.(k+1)](...)
> **Objective:** One sentence, without "and".
```

---

## Implementation plan

1. Write this spec.
2. Add `skills/spec-split/SKILL.md`.
3. Document the skill in `README.md`.
4. Add the `CHANGELOG.md` entry.

---

## Acceptance criteria

- [ ] `npx abis-skills list` shows `spec-split`.
- [ ] `/spec-split` with no argument lists the specs and asks which one; it writes nothing.
- [ ] `/spec-split NN` on a spec whose status is not approved stops and writes nothing.
- [ ] On an approved spec, the skill shows the full split (sub-specs, steps, commits, PRs) and writes nothing until the user confirms.
- [ ] Every proposed sub-spec has a one-sentence objective without "and"/"y", and every step has exactly one commit message.
- [ ] After confirming, `specs/NN.1-*.md` … `specs/NN.n-*.md` exist, the parent spec has a "Delivery in sub-specs" table, and no other file changed.
- [ ] Sub-specs are written in the parent spec's language and use its header labels.
- [ ] Commit messages follow the repo's style from `git log` (Conventional Commits when there is no clear style).
- [ ] No git command that writes (`checkout -b`, `commit`, `push`) and no `gh` command runs.

---

## Decisions

- **Yes:** split by functionality, never by file, layer or hours. That is the team rule; a layer split produces PRs that cannot be tested alone.
- **Yes:** sub-spec files next to the parent (`NN.k-slug.md`) instead of one big table inside the parent. Each PR links its own sub-spec, and `/spec-impl NN.k` can implement it.
- **Yes:** the first step of each sub-spec commits the sub-spec itself. The reviewer reads the plan first, then the steps in the order they were planned.
- **Yes:** confirmation before writing. The split is a team decision; the skill proposes, the user decides.
- **Yes:** sub-specs start as `Draft`. The user approves each one before `/spec-impl`.
- **No:** opening PRs or creating branches. Out of scope and outward-facing; `/spec-impl` and the author do that.
- **No:** a fixed number of sub-specs. Some specs need one PR; forcing three creates empty PRs.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| The model splits by layer anyway | Explicit rule, the four checks on every sub-spec, and the user confirms the split before anything is written. |
| A sub-spec leaves the repo broken when merged alone (e.g. schema without its consumer) | Check 4 is mandatory; the skill orders sub-specs so each one is additive and says which base branch each PR uses. |
| The spec is too small to split | The skill says so and proposes a single sub-spec, or none. |
