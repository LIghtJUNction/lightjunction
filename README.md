<p align="center">
  <a href="https://lightjunction.github.io/lightjunction/"><img src="public/readme-hero.svg" alt="LIghtJUNction — simplicity, beauty, openness, freedom, encryption" width="100%" /></a>
</p>

English · [中文](README.zh.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

# LIghtJUNction

**Simplicity · Beauty · Openness · Freedom · Encryption.**

Co-founder of [api.lmm.best](https://api.lmm.best/). Small tools for AI, Linux, and networks.
This repository is also home to my digital assistant; the accounts and assets remain mine.

## Code

- [HumanGrant](https://github.com/LIghtJUNction/humangrant) — human permission for AI agents.
- [LMM Scripts](https://github.com/TokenNotIncluded/lmm-scripts) — install and update AI tools.
- [MagicNet](https://github.com/LIghtJUNction/MagicNet) — networking tools for rooted Android.
- [AUL](https://github.com/LIghtJUNction/AUL) — an upstream-feedback license experiment.

[All projects](https://github.com/LIghtJUNction?tab=repositories) · [Platform source](https://github.com/TokenNotIncluded/api.lmm.best) · [Script commands](ONLINE-SCRIPTS.md) · [Contributing](CONTRIBUTING.md)

## Encrypted contact

[age recipient](public/age-recipients.txt) · [OpenPGP public key](pubkey.asc)

```text
age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n
```

Install [age](https://github.com/FiloSottile/age) and [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey), download the recipient file, and encrypt locally:

```sh
age -R age-recipients.txt -o message.txt.age message.txt
```

Email `message.txt.age` to **lightjunction.me@gmail.com**. Only the recipient needs the YubiKey to decrypt.
Please do not send private keys, passwords, or recovery codes.

## Elsewhere

[Website](https://lightjunction.github.io/lightjunction/) · [Notes](https://msg.lmm.best/@lightjunction) · [Open-source bounties](https://api.lmm.best/) · [Support](https://donate.lmm.best/?project=lightjunction)

[Challenge I — claimed](https://msg.lmm.best/main/184) · [Challenge II — asymmetric signal](https://msg.lmm.best/main/185)

## License

Original material uses [AUL 1.0-draft.1](LICENSE), a custom draft without OSI approval. Earlier MIT grants and third-party terms remain valid; see [LICENSING.md](LICENSING.md).
