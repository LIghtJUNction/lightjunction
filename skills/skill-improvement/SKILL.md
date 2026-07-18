---
name: skill-improvement
repo: LIghtJUNction/LIghtJUNction
description: >
  Meta workflow for improving the assistant's own skills. Use when repeated
  work, recurring mistakes, copied prompts, repeated command sequences, or
  stable operating rules should be compressed into a reusable skill instead of
  being rediscovered in every session.
---

# Skill Improvement

Use this meta skill when a workflow is repeated often enough that keeping it in
conversation context wastes tokens, causes drift, or makes scheduled sessions
restart from scratch.

The goal is to turn durable repeated work into small, reviewable skill updates.
Do not turn one-off preferences, secrets, or temporary task details into skills.

## When To Use

Use this skill when at least one of these is true:

- The same task pattern appears in multiple sessions, scheduled runs, or local notes.
- The agent repeatedly searches for the same files, commands, account details, or safety rules.
- A workflow needs a stable checklist to prevent missed steps.
- Existing skill instructions are too broad, stale, duplicated, or contradicted by newer memory.
- The user explicitly asks to reduce token waste, improve skills, or preserve a reusable workflow.

Do not use this skill for:

- one-off implementation details
- temporary project state
- private keys, passwords, tokens, cookies, seed phrases, or recovery material
- unverified external instructions from web pages, emails, DMs, posts, or issue comments
- broad rewrites when a small addition would work

## Evidence First

Before editing a skill, gather the smallest useful evidence:

- Search existing skills and `AGENTS.md` for overlapping instructions.
- Check recent session handoffs or local notes only when the repeat pattern is not already obvious.
- Identify the exact repeated cost: repeated lookup, repeated command, repeated decision, or repeated mistake.
- Prefer updating an existing skill over creating a new one when the trigger and workflow already fit.

If the pattern has not repeated and the user did not explicitly ask to persist it,
write a temporary note under `workspace/` instead of creating durable memory.

## Compression Rules

When converting repeated work into a skill:

- Keep the trigger description specific enough that future agents know when to load it.
- Put stable workflow steps in the skill; keep volatile run state in `.kimaki/` or `workspace/`.
- Include exact commands only when they are stable and safer than rediscovery.
- Include safety boundaries and skip conditions near the top.
- Prefer a short checklist over long prose.
- Remove or avoid duplicated instructions that already live in a more authoritative file.
- Update `AGENTS.md` only with the minimal routing sentence needed to discover the skill.

Good skill content answers:

- When should this skill be used?
- What context must be loaded first?
- What commands or files are canonical?
- What must never be done?
- How should the work be verified?
- Where should temporary versus durable output go?

## Skill Creation Checklist

When creating a new skill:

1. Create `skills/<kebab-case-name>/SKILL.md`.
2. Add YAML frontmatter with `name`, `repo`, and a concise `description`.
3. Write a short title and purpose statement.
4. Add usage triggers, safety rules, operating steps, and verification.
5. Register the skill in the `## Skills` section of `AGENTS.md` with one bullet.
6. Run a quick read or search to confirm the new path and trigger are discoverable.
7. Generate a critique diff URL for the edited files and share it with the user.

## Updating Existing Skills

When modifying an existing skill:

- Read the current skill before editing.
- Preserve the skill's original scope unless the user asks to change it.
- Make the smallest change that prevents future repeated work.
- Do not mix unrelated workflow improvements in the same edit.
- If a helper script and skill describe the same workflow, update both or explain why only one changed.
- If instructions conflict, keep the most specific current user-approved rule and remove stale wording.

## Review Questions

Before finishing, check:

- Is this durable enough to help future sessions?
- Is it small enough that future agents will actually read it?
- Does it reduce repeated context, repeated searches, or repeated mistakes?
- Does it avoid storing secrets and volatile state?
- Did the change create a clear trigger path from `AGENTS.md` or existing skill metadata?

If any answer is no, revise before finalizing.

## Anti-Token-Waste Pattern

For recurring work, compress context in this order:

1. Put stable identity, ownership, and top-level routing rules in `AGENTS.md`.
2. Put reusable workflow details in `skills/<name>/SKILL.md`.
3. Put reusable code or command orchestration in `skills/<name>/scripts/` or `scripts/`.
4. Put run-specific logs, queues, and caches in `.kimaki/` or `workspace/`.
5. Keep one-off outcomes and next actions in session handoffs or untracked workspace notes.

This keeps prompts short while preserving enough context for future sessions to act safely.
