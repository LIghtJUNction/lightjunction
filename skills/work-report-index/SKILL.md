---
name: work-report-index
repo: LIghtJUNction/LIghtJUNction
description: >
  Generate and synchronize the canonical daily work report index. Use when
  updating WORK_REPORT/index.md, adding diary/report navigation, maintaining
  collapsible archives, or checking that daily work report links are current.
---

# Work Report Index

Use this skill when a task involves the canonical daily diary/work report index
for the assistant home workspace.

The canonical report directory is:

```text
/root/.kimaki/projects/lightjunction/WORK_REPORT
```

The index file is:

```text
/root/.kimaki/projects/lightjunction/WORK_REPORT/index.md
```

## Goal

Keep `WORK_REPORT/index.md` generated from actual `YYYY/MM/DD.md` files instead
of hand-maintaining links. As the diary history grows, keep the newest entries
easy to scan and fold older entries with Markdown/HTML `<details>` blocks.

## Required Command

From the `lightjunction` project root, run:

```bash
uv run scripts/sync-work-report-index.py
```

This scans the canonical `WORK_REPORT` tree and rewrites the index.

## Verification

After syncing, check that the index is current:

```bash
uv run scripts/sync-work-report-index.py --check
```

To preview the generated Markdown without writing:

```bash
uv run scripts/sync-work-report-index.py --dry-run
```

## Folding Rules

- The newest reports stay expanded under `Recent Reports`.
- Older reports are grouped under `Archived Reports`.
- Archive groups are folded by year, then by month.
- The default expanded count is 14 reports.
- Use `--recent-count N` when a smaller or larger expanded section is useful.

## Operating Rules

- Do not hand-edit generated index contents unless fixing the generator first.
- Do not include transient local reports from `workspace/reports/`; only canonical
  daily reports under `WORK_REPORT/YYYY/MM/DD.md` belong in this index.
- If a daily report exists but is missing from the index, run the sync script
  rather than adding a one-off link.
- If the index format needs to change, update the script and this skill together.
