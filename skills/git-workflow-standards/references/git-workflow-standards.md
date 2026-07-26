# Git Workflow Standards

## 1. Branch Strategy

Use trunk-based development.

| Branch | Purpose | Naming Rule | Lifetime |
| --- | --- | --- | --- |
| `main` | Only long-lived branch | `main` | Permanent |
| `feature` | Feature work | `feature/[ticket]-short-description` | Up to 2 days |
| `bugfix` | Defect fixes | `bugfix/[ticket]-short-description` | Up to 1 day |
| `hotfix` | Urgent production fixes | `hotfix/[ticket]-short-description` | Within hours |
| `release` | Release preparation | `release/v[version]` | Delete after release |

Rules:

- Create all feature, bugfix, hotfix, and release branches from `main`.
- Keep feature branches alive for no more than 2 days.
- Keep bugfix branches alive for no more than 1 day.
- Complete hotfix branches within hours.
- Use feature flags for large features.
- Do not force push `main`.
- Require CI and review before merge.

## 2. Commit Message Format

Follow Conventional Commits:

```text
<type>(<scope>): <subject>

[body]

[footer]
```

### 2.1 Type

Allowed types:

- `feat`: New feature.
- `fix`: Bug fix.
- `docs`: Documentation-only change.
- `style`: Formatting-only change that does not alter behavior.
- `refactor`: Code restructuring without behavior change.
- `perf`: Performance improvement.
- `test`: Test addition or update.
- `build`: Build system or dependency change.
- `ci`: CI workflow change.
- `chore`: Maintenance task.
- `revert`: Revert a previous change.

### 2.2 Scope

Use an optional scope to identify the affected area:

```text
feat(payment): add wechat callback handler
```

### 2.3 Subject

- Use imperative wording.
- Keep it under 50 characters when practical.
- Do not end with a period.
- Keep English subjects lowercase after the type prefix.
- For Chinese subjects, keep the wording concise and action-oriented.

### 2.4 Body

- Explain what changed and why.
- Keep each line under 72 characters when practical.

### 2.5 Footer

- Link issues with `closes #234` or `refs #234`.
- Start breaking changes with `BREAKING CHANGE:`.

Example:

```text
feat(payment): 增加微信支付回调处理

接入微信支付异步通知接口，支持订单状态自动更新。
使用签名校验确保回调来源合法。

closes #234
```

## 3. Commit Granularity

- Make one commit do one thing.
- Ensure every commit can pass CI independently.
- Keep a new feature and its direct tests in the same commit when useful.
- Split refactors from behavior changes.
- Split formatting changes from logic changes.
- Split independent fixes into separate commits.

## 4. Pull Request Standards

### 4.1 Title

Use the same format as commit messages:

```text
<type>(<scope>): <subject>
```

### 4.2 Description Template

Include:

```markdown
## Changes

## Why

## Tests

## Related Issues

## Checklist

- [ ] CI passes
- [ ] Tests were added or updated when needed
- [ ] No unrelated changes are included
- [ ] No secrets or credentials are included
```

### 4.3 PR Rules

- Keep PRs as small as possible.
- Prefer PRs under 400 changed lines.
- Request review only after CI passes.
- Require at least one approval.
- Use squash merge.

## 5. Versioning And Tags

Use semantic versioning:

```text
v<major>.<minor>.<patch>[-prerelease]
```

Examples:

- `v1.2.3`
- `v1.3.0-beta.1`
- `v2.0.0-rc.1`

Bump rules:

- Breaking change: increment major.
- Backward-compatible feature: increment minor.
- Backward-compatible fix: increment patch.

Tag format:

```text
v1.2.3
```

## 6. Prohibited Patterns

- Do not force push `main`.
- Do not commit secrets, credentials, or tokens.
- Do not commit IDE configuration or temporary files unless explicitly part of
  the project.
- Do not commit unformatted code.
- Do not use meaningless commit messages such as `update` or `WIP`.
- Do not put unrelated changes in one commit.
