<p align="center">
  <a href="https://lightjunction.github.io/lightjunction/">
    <img src="public/readme-hero.svg" alt="LIghtJUNction — simplicity, beauty, openness, freedom, encryption" width="100%">
  </a>
</p>

<p align="center">
  <strong>Small, inspectable tools for AI, Linux, networks, and human–agent collaboration.</strong>
</p>

<p align="center">
  <a href="https://hireferry.lmm.best/"><img src="https://hireferry.lmm.best/badge.svg?label=LIghtJUNction&amp;message=AI%20profile" alt="LIghtJUNction — AI profile on HireFerry"></a>
</p>

<p align="center">
  English · <a href="README.zh.md">中文</a> · <a href="README.ru.md">Русский</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

## LIghtJUNction

**Simplicity · Beauty · Openness · Freedom · Encryption.**

I build open-source systems that make powerful tools easier to inspect, run, repair, and self-host. The recurring idea is simple: keep the mechanism visible, keep authority explicit, and keep users able to leave.

```text
model / tool / operating system
             ↓
    small, explicit interfaces
             ↓
 software people can inspect and own
```

This repository is both my GitHub profile and the source for the [interactive website](https://lightjunction.github.io/lightjunction/). The website, accounts, keys, project assets, and assistant identity remain under my control.

## Current work

### AI infrastructure and collaboration

- [LMM API](https://github.com/TokenNotIncluded/lmm-api) — a self-hostable model and tool gateway with routing, teams, budgets, billing and extensions.
- [HireFerry](https://github.com/TokenNotIncluded/hireferry) — an open-source, self-hostable AI-assisted talent-matching platform.
- [msg](https://github.com/TokenNotIncluded/msg) — a minimal message, identity and capability platform for humans and agents.
- [magpie-context-folding](https://github.com/LIghtJUNction/magpie-context-folding) — reversible context folding for long-running agent sessions.
- [LightNest](https://github.com/LIghtJUNction/lightnest) — research on learning structure and behavior from binaries.

### Linux, systems, and devices

- [CortexFS](https://github.com/LIghtJUNction/cortexfs) — an agent runtime exposed through a Linux `/ctx` filesystem contract.
- [MagicNet](https://github.com/LIghtJUNction/MagicNet) — a transparent networking control plane for rooted Android.
- [OniMods](https://github.com/LIghtJUNction/OniMods) — Oxygen Not Included tooling, performance work, multiplayer experiments, and MCP-native colony operations.
- [mechrevo-drivers](https://github.com/LIghtJUNction/mechrevo-drivers) — a hardware-evidence-driven Linux driver branch for selected MECHREVO notebooks.

### Human control and open collaboration

- [HumanGrant](https://github.com/LIghtJUNction/humangrant) — explicit, time-bounded human permission for AI agents.
- [AUL](https://github.com/LIghtJUNction/AUL) — an experimental license built around upstream feedback from agents.
- [AGENTS.md](https://github.com/LIghtJUNction/AGENTS.md) — reusable operating guidance for coding agents.

[Browse every repository](https://github.com/LIghtJUNction?tab=repositories) · [Contribution guide](CONTRIBUTING.md) · [Online script reference](ONLINE-SCRIPTS.md)

## This profile site

The site is a small Vite/TypeScript project rather than a hosted profile builder. It includes local tests for the profile, public keys and encrypted-message flow.

```bash
git clone https://github.com/LIghtJUNction/lightjunction.git
cd lightjunction
npm install
npm run dev
```

Full verification:

```bash
npm run check
```

That command runs TypeScript checking, cryptographic tests, site tests, and the production build. Design and product decisions are recorded in [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md).

## HireFerry badge

The badge is a cacheable SVG with no JavaScript. It can be embedded in any Markdown README:

```md
[![HireFerry — AI talent](https://hireferry.lmm.best/badge.svg)](https://hireferry.lmm.best/)
```

Custom label:

```md
[![LIghtJUNction — AI profile](https://hireferry.lmm.best/badge.svg?label=LIghtJUNction&message=AI%20profile)](https://hireferry.lmm.best/)
```

## Encrypted contact

[age recipient](public/age-recipients.txt) · [OpenPGP public key](pubkey.asc)

```text
age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n
```

Install [age](https://github.com/FiloSottile/age) and [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey), download the recipient file, then encrypt locally:

```bash
age -R age-recipients.txt -o message.txt.age message.txt
```

Send `message.txt.age` to **lightjunction.me@gmail.com**. Only the recipient needs the YubiKey to decrypt. Never send private keys, passwords, recovery codes, or unencrypted secrets.

## Elsewhere

[Website](https://lightjunction.github.io/lightjunction/) · [Notes](https://msg.lmm.best/@lightjunction) · [LMM API](https://api.lmm.best/) · [Support open-source work](https://donate.lmm.best/?project=lightjunction)

[Challenge I — claimed](https://msg.lmm.best/main/184) · [Challenge II — asymmetric signal](https://msg.lmm.best/main/185)

## Thanks

I use OpenAI, ChatGPT, and Codex to learn, test ideas, and build open-source projects. Thank you to the people who make those tools and to every contributor who reports a concrete failure, submits a focused patch, or verifies behavior on real systems.

## License

Original material uses [AUL 1.0-draft.1](LICENSE), a custom draft that is not OSI-approved. Earlier MIT grants and third-party terms remain valid; see [LICENSING.md](LICENSING.md).
