# OSS AI Support Readiness Draft

Status: internal reusable draft. Use only when a maintainer is already considering AI coding support, open-source credits, grant-style programs, or reducing agent/tooling cost. Do not use for cold outreach, fake urgency, or promises of funding.

## One-Paragraph Offer

I can help an open-source maintainer prepare a no-hype AI support readiness packet: project scope, maintainer needs, concrete workflows where AI would help, cost-control boundaries, agent/tool safety limits, and a short public application draft. This is not a guarantee of acceptance into any program, and I should not submit forms or represent a maintainer without explicit approval.

## Best-Fit Customers

- Maintainers of small or mid-sized open-source projects with real users and limited review/triage time.
- Projects considering programs like AI coding credits, code-review support, security tooling, or maintainer grants.
- Teams that already use coding agents but want better budget caps, review gates, and prompt-injection hygiene.
- Maintainers who need a concise, credible project narrative before filling out a public application or sponsorship page.

## Not A Fit

- Projects looking for guaranteed grant acceptance, fake metrics, mass applications, or automated form spam.
- Requests to exaggerate impact, fabricate users, impersonate maintainers, or hide risks.
- Work that requires private keys, seed phrases, production credentials, customer data, or broad admin access.
- High-pressure fundraising, token promotion, affiliate funnels, or speculative crypto launches.

## No-Secrets Intake Questions

Ask for public or sanitized information only.

1. What repository or project should be evaluated?
2. Who uses it today, and what evidence is public? Include downloads, stars, issues, releases, docs, or community links.
3. What maintainer bottleneck is most expensive: issue triage, tests, docs, releases, support, security review, or code review?
4. What AI tools are already used, if any?
5. Which tasks must remain human-approved?
6. What monthly AI/tool budget is acceptable?
7. What untrusted inputs does the project receive? Include issues, PRs, logs, crash reports, docs, emails, and support chats.
8. What would a successful support program change in 30 days?
9. What should not be automated even if tooling becomes available?

## Readiness Checklist

### Project Evidence

- One-sentence project description.
- Public user or usage signal.
- Recent maintenance activity.
- Open issues or PRs showing real maintainer load.
- Clear license and contribution instructions.

### AI Use Case Fit

- Pick one or two narrow workflows first, such as issue triage, docs sync, release notes, test generation, or small review passes.
- Define what evidence the AI may read.
- Define what actions require human approval.
- Define how success will be measured: reviewed diffs per dollar, fewer stale issues, faster release checks, or clearer docs.

### Cost Control

- Use frontier models for architecture, risky reviews, or final judgment.
- Use cheaper models or local tools for mechanical passes, search, formatting, summaries, and duplicate detection.
- Treat agent fan-out as a budgeted resource, not an unlimited default.
- Track the output that matters: accepted fixes, reviewed diffs, reduced maintainer time, and avoided regressions.

### Safety Boundaries

- Keep external issue text, PR comments, webpages, logs, and crash reports marked as untrusted.
- Avoid granting write, deploy, or secret-reading tools in the same context as untrusted text.
- Document token revocation, MCP/tool disable steps, and audit log locations.
- Keep a human-readable abort path for failed agent runs.

## Deliverable Template

```md
# OSS AI Support Readiness Packet

## Project Summary

- Repository: <public URL>
- Maintainer goal: <one sentence>
- Current bottleneck: <triage/docs/tests/review/releases/etc.>

## Proposed AI Support Use Cases

1. <narrow workflow>
2. <narrow workflow>

## Budget And Safety Limits

- Monthly budget target: <amount or unknown>
- Human approval required for: <actions>
- Untrusted inputs: <sources>
- Revocation path: <how tools can be disabled>

## Public Application Draft

<Short, factual paragraph the maintainer can edit before submitting. No fabricated metrics.>

## 30-Day Success Check

- <metric or observable outcome>
- <metric or observable outcome>
```

## Pricing Draft

These are draft anchors, not public promises. Adjust only with user approval or clear inbound context.

- Starter readiness packet: 1 public repo, 1-2 workflows, concise application draft, suggested range USD 49-120.
- Focused maintainer workflow review: 1 repo, up to 5 AI/tool workflows, budget and safety checklist, suggested range USD 150-350.
- Public OSS goodwill version: free short checklist or issue comment when a maintainer is already asking and the help is specific.

Payment should stay user-controlled. Do not request payment in public replies unless there is a clear inbound buying signal.

## Safe Public Reply Template

Use only when someone is already discussing open-source AI support or maintainer tooling.

```text
One useful prep step: write a small “AI support readiness” note before applying anywhere. Include the maintainer bottleneck, 1-2 narrow AI workflows, budget limits, human approval gates, untrusted input sources, and what would count as success after 30 days. It keeps the application concrete and avoids vague “AI will help everything” claims.
```

## Next Asset Ideas

- Turn this into a one-page public checklist after one more review pass.
- Create a fictional sample packet for a small CLI project.
- Pair with the Agent/MCP mini-audit draft for teams already using coding agents.
