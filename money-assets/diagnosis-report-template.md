# Maintenance Diagnosis Report Template

Use this for a free first useful note or for a maintainer who explicitly asked for a narrow diagnosis. Keep it specific, evidence-based, and short enough to paste into a public issue or PR comment. Do not mention money unless the maintainer asks first.

## Report Format

### 1. Scope

- Repository: `<owner/repo>`
- Public issue, PR, or failing run: `<URL>`
- Question answered: `<what the maintainer needs to know>`
- Out of scope: secrets, production access, private credentials, broad rewrites, and official maintainer decisions.

### 2. Findings

- Root cause: `<one or two sentences>`
- User impact: `<who is affected and how>`
- Confidence: `<high|medium|low>`, because `<evidence>`

### 3. Evidence

- Reproduction command or inspected file: `<command/path>`
- Relevant output or line: `<exact output, URL, or line reference>`
- Existing behavior: `<current behavior>`
- Expected behavior: `<desired behavior>`

### 4. Recommended Fix

- Minimal fix: `<smallest safe change>`
- Validation: `<command/check to prove it>`
- Risk: `<what could still go wrong>`

### 5. Boundary

- Support: discuss only if the maintainer explicitly asks after useful work is visible.
- Safety note: never send private keys, seed phrases, API keys, cookies, production credentials, or recovery codes.

## Example: Documentation Configuration Diagnosis

### 1. Scope

- Repository: `Toyota/confluence2md`
- Public PR: https://github.com/Toyota/confluence2md/pull/8
- Question answered: whether a documented environment variable can make local state dump configuration easier to discover.
- Out of scope: release workflow changes, SBOM generation, credentials, and Confluence production access.

### 2. Findings

- Root cause: the useful state dump option existed in code but was not visible in the README configuration section.
- User impact: users who wanted to debug or preserve dump state had to inspect code or guess the environment variable.
- Confidence: high, because the README update could be verified by searching for the documented variable name.

### 3. Evidence

- Inspected file: `README.md`
- Relevant setting: `CONFLUENCE2MD_DUMP_STATE_PATH`
- Validation command used in the daily log: `grep -n "CONFLUENCE2MD_DUMP_STATE_PATH" README.md`
- Observed result: README contained the config and precedence note after the docs patch.

### 4. Recommended Fix

- Minimal fix: document the environment variable in the README configuration section and explain its precedence.
- Validation: confirm the README contains the setting name and a clear note about how it is applied.
- Risk: low for docs-only changes; still requires maintainer review for wording accuracy.

### 5. Boundary

- This type of docs/config diagnosis fits the free first useful note scope.
- If a maintainer asks for the corresponding docs patch, keep it narrow and validate it clearly.
- No external contact should be made solely to sell this; use it only when there is a concrete maintainer need.
