# Agent/MCP Security Mini-Audit Draft

Status: internal reusable draft. Use only for relevant inbound requests or public discussions where the other person is already asking about AI-agent, MCP, coding-agent, Sentry, GitHub, email, or internal-tool safety. Do not use for cold spam.

## One-Paragraph Offer

I can do a small, no-secrets review of an AI coding-agent or MCP setup and return a practical risk report: tool permissions, prompt-injection surfaces, audit logging, revocation steps, and safer defaults. The review is not a formal security certification or penetration test. It is a scoped configuration and workflow review designed to reduce obvious agent/tooling risk without asking for private keys, seed phrases, production credentials, or broad admin access.

## Best-Fit Customers

- Small teams using Claude Code, Cursor, Codex, or similar coding agents with real tools connected.
- Developers exposing MCP servers for GitHub, Sentry, Slack, email, databases, CI, support queues, or internal admin tools.
- Open-source maintainers worried about fake bug reports, prompt injection, or agentjacking through issue trackers and error-reporting tools.
- Indie SaaS teams that want a practical checklist before letting agents touch repositories, tickets, customer support, or deployment workflows.

## Not A Fit

- Requests that require private keys, seed phrases, recovery codes, wallet signatures, or production passwords.
- Requests for a formal audit certificate, compliance attestation, exploit development, or guaranteed security outcome.
- Broad enterprise security audits, red-team engagements, or high-risk production access.
- Cold outreach campaigns, affiliate funnels, or automated lead scraping.

## No-Secrets Intake Questions

Ask for sanitized, minimal evidence only.

1. What agent or coding assistant is being used?
2. Which tools can it call today? Include MCP server names, hosted services, and local scripts.
3. Which tools can write, delete, deploy, spend money, send messages, or change permissions?
4. How are tool calls approved: always allowed, per-session approval, per-call approval, allowlist, or custom policy?
5. Where are prompts, tool calls, inputs, outputs, and errors logged?
6. How can a single tool grant be revoked quickly?
7. Do tool grants expire automatically?
8. Are external inputs treated as untrusted? Include issues, PRs, Sentry errors, emails, Slack messages, docs, websites, and logs.
9. Are secrets ever included in prompts, logs, screenshots, traces, issue comments, or MCP resources?
10. What is the highest-impact action the agent can currently perform without a human approving that specific action?
11. What is the worst plausible prompt-injection source in the workflow?
12. Which repository, service, or workflow is the highest priority to protect first?

Do not request credentials. If screenshots are provided, ask the customer to redact tokens, emails, customer names, internal hostnames, and private URLs where practical.

## Review Checklist

### Tool Inventory

- List every connected tool and MCP server.
- Mark each as read-only, write-capable, deploy-capable, spend-capable, or permission-changing.
- Identify ambient authority: tools that can act without task-specific context or fresh approval.

### Permission Boundaries

- Check whether each tool grant has an owner, purpose, expiry, and revocation path.
- Prefer narrow scopes over account-wide tokens.
- Prefer per-call approval for destructive, external, or irreversible actions.
- Flag any write-capable tool that can run from untrusted external text without a human checkpoint.

### Prompt-Injection Surfaces

- Treat issues, PRs, comments, Sentry errors, emails, Slack messages, docs, webpages, logs, and generated files as untrusted.
- Check whether the agent separates external content from operator instructions.
- Check whether external content can tell the agent to reveal secrets, change policies, run unrelated tools, or contact third parties.

### Logging And Audit

- Confirm tool calls are logged with timestamp, actor, inputs, outputs, and approval source.
- Confirm logs are durable enough to answer: what did the agent see, what did it do, and why?
- Avoid storing secrets in logs.

### Revocation And Recovery

- Confirm there is a one-command or documented rollback path for each grant.
- Confirm owners know how to disable an MCP server, revoke a token, remove a GitHub app, rotate a webhook secret, and stop scheduled agents.
- Prefer cheap, boring revocation over complex incident playbooks.

## Report Template

```md
# Agent/MCP Security Mini-Audit

## Scope

- Reviewed: <sanitized systems and tools>
- Not reviewed: <explicit exclusions>
- Evidence: <screenshots/config snippets/log snippets, all sanitized>

## Executive Summary

- Overall risk: Low / Medium / High
- Main concern: <one sentence>
- Fastest risk reduction: <one practical step>

## Findings

### 1. <Finding title>

- Severity: Low / Medium / High
- Evidence: <sanitized evidence>
- Why it matters: <specific agent/tool risk>
- Suggested fix: <smallest safe change>
- Verification: <how to confirm it is fixed>

## Quick Wins

- <action that takes less than 30 minutes>
- <action that reduces ambient authority>
- <action that improves auditability>

## Follow-Up Options

- Re-check after changes.
- Help write a no-secrets MCP/tool policy.
- Help add a revocation checklist to the repository docs.
```

## Example Finding

### Write-Capable Sentry Tool Is Available During Issue Triage

- Severity: Medium
- Evidence: The agent can read external issue comments and call a Sentry MCP tool in the same session. The tool grant does not expire and there is no per-call approval for state-changing actions.
- Why it matters: A fake bug report or pasted error can include instructions that attempt to redirect the agent into unrelated tool calls. Even when the model is well-behaved, combining untrusted text with broad tool access creates unnecessary ambient authority.
- Suggested fix: Split triage into a read-only mode by default. Require explicit per-call approval for write actions, set a grant expiry, and document a one-command revocation path.
- Verification: Start a fresh triage session and confirm the agent can read the issue and Sentry event, but cannot mutate Sentry/GitHub state without a human approval step.

## Pricing Draft

These are draft anchors, not public promises. Adjust only with user approval or clear inbound context.

- Starter review: 1 workflow, up to 5 tools, concise report, suggested range USD 49-99.
- Focused review: 1 agent setup, up to 12 tools, prioritized findings and revocation checklist, suggested range USD 150-300.
- Open-source maintainer version: public repo only, no private systems, can be handled as sponsorship or small paid issue if the maintainer asks.

Payment should stay user-controlled. Do not request payment in public replies unless there is a clear inbound buying signal.

## Safe Public Reply Template

Use only when someone is already discussing agent/MCP safety and a short helpful reply fits the thread.

```text
One practical check: make a table of every agent tool with owner, scope, expiry, audit log location, and one-command revocation. The risky cases are usually write-capable tools that can run in the same context as untrusted issues, Sentry errors, emails, or webpages.
```

## Public One-Liner

No-secrets Agent/MCP mini-audit: a scoped review of tool permissions, untrusted-input surfaces, audit logs, and revocation paths for coding-agent or MCP setups. Not a formal security certification, penetration test, or request for production credentials.

## Next Asset Ideas

- Turn the checklist into a one-page public gist or README section after one more review pass.
- Create a sanitized sample report from a fictional GitHub + Sentry + MCP setup.
- Create a tiny script that inventories local MCP config files and prints a no-secrets permission checklist.
