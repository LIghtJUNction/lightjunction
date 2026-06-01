> **후원 / 광고 공간:** 제 프로젝트를 후원하거나 공개 메시지를 남기고 싶다면 프로젝트 웹사이트에서 **Encrypted Message**를 열고 후원 정보를 보내 주세요. 결제 방식, 비밀번호 홍바오, Bitcoin 지갑 개인키, 연락처 또는 기타 후원 메모 모두 가능합니다. 메시지는 브라우저에서 제 GPG 공개키로 암호화되며, 저만 복호화할 수 있습니다.

**언어:** [English](README.md) (전체 버전, 동적 업데이트) · [中文](README.zh.md) · [Русский](README.ru.md) · 한국어 (정적 버전) · [日本語](README.ja.md)

<div align="center">
  <a href="https://gravatar.com/totallytriumph1a8c29e246" target="_blank">
    <img src="https://1.gravatar.com/avatar/1c12c2b9decdd50a37e024c03c80845876d06839aadda34c578a6183fd83c927?s=160&d=identicon" alt="LIghtJUNction" width="128" height="128">
  </a>

# LIghtJUNction

**AI tooling / Linux 자동화 / 네트워크 인프라 / 실용 보안**

저는 agents, bootstrap scripts, data pipelines, game tooling, terminal-first workflows처럼 현실의 복잡한 시스템을 다루는 작고 날카로운 도구를 만듭니다.

현재는 agent tooling, proxy-aware bootstrap scripts, 실용적인 Linux/macOS 자동화를 중심으로 작업하고 있습니다.

[Website Terminal](https://lightjunction.github.io/lightjunction/) · [Encrypted Message](https://lightjunction.github.io/lightjunction/) · [GitHub](https://github.com/LIghtJUNction) · [Hugging Face](https://huggingface.co/LIghtJUNction) · [Kaggle](https://www.kaggle.com/lightjunction) · [Email](mailto:lightjunction.me@gmail.com)

</div>

## Agent Skills

제 개인 agent skills를 전역으로 설치합니다:

```bash
npx skills add LIghtJUNction/lightjunction -g
```

Skills는 `.agents/skills/` 아래에 있으며, 재사용 가능한 workflows, preferences, project-specific operating knowledge를 기록합니다.

## 프로필

저는 CS 전공자는 아니지만, 실제로 배포하면서 배웁니다. 제 프로젝트는 대개 개인적인 문제에서 시작합니다. 어려운 네트워크 환경에서 새 머신을 세팅하거나, agents를 더 쉽게 운영하거나, 데이터 수집을 자동화하거나, 거친 스크립트를 다른 사람도 실행할 수 있는 도구로 만드는 일입니다.

<details>
<summary>초기 기술 관심사</summary>

저는 운영체제를 늘 좋아했고, 특히 Linux에 끌렸습니다. 예전에는 휴대폰과 컴퓨터에 여러 시스템을 설치하고 바꾸는 일에 깊이 빠져 있었습니다. 오래된 Android 휴대폰에 ARM 빌드의 Windows를 설치해 본 적도 있습니다.

제 고등학교 시절 대부분에는 지금처럼 강력한 인공지능 도구가 없었습니다. 고3 무렵 ChatGPT 3.5를 처음 써 보고, 인공지능이 앞으로 사회를 근본적으로 바꿀 것이라고 바로 판단했습니다.

</details>

| Snapshot | |
|:--|:--|
| Education | Zhengzhou University |
| Looking for | Remote or hybrid engineering opportunities |
| Strongest signal | Debugging real systems, not just demos |
| Open-source focus | AstrBot ecosystem, agent tooling, Linux automation |
| Favorite game | Oxygen Not Included |

저는 ownership이 강하고, 빠르게 반복하며, Linux에 익숙하고, happy path만이 아니라 실제 경로를 디버깅하는 일을 중요하게 여기는 환경을 찾고 있습니다.

제 기준은 단순합니다. 도구가 제 머신에서만 동작한다면 아직 완성된 것이 아닙니다. 좋은 자동화는 자신이 보는 머신을 설명하고, 보수적인 선택을 하며, 무언가를 망가뜨리기 전에 명확하게 실패해야 합니다.

| 만들기 좋아하는 것 | 근거 |
|:--|:--|
| AI and agent tooling | AstrBot ecosystem work, MCP tools, automation surfaces, terminal workflows |
| Linux and bootstrap automation | macOS/Linux setup scripts, package-manager detection, proxy-aware installs |
| Network tools | daed/mihomo/Hiddify related setup, transparent proxy workflows, difficult-network fallbacks |
| Data and platform tooling | Python CLIs, API wrappers, collection pipelines, repeatable scripts |
| Security-minded utilities | OpenPGP contact flow, SSH key deployment, explicit permission boundaries |
| Simulation games | Oxygen Not Included, especially systems that reward automation and debugging |

## 작업 방식

| Signal | 실제 의미 |
|:--|:--|
| Reproduce first | 실제로 실패하는 command, package, network, runtime path를 먼저 추적합니다. |
| Prefer explicit systems | Scripts print diagnostics, list assumptions, and ask before risky work. |
| Ship usable surfaces | CLIs, README commands, defaults, error messages are part of the product. |
| Keep learning public | Repository is a workshop: rough ideas become documented tools over time. |

## Selected Work

| Project | Why it matters |
|:--|:--|
| [AstrBot](https://github.com/AstrBotDevs/AstrBot) ecosystem | Bot framework contribution and packaging/plugin work around real runtime behavior. |
| [lightjunction](https://github.com/LIghtJUNction/lightjunction) | Personal terminal site, bootstrap scripts, encrypted contact flow, reusable shell helpers. |
| [OniMods](https://github.com/LIghtJUNction/OniMods) | Oxygen Not Included tooling and MCP-style automation experiments for a complex simulation game. |
| [douyin](https://github.com/LIghtJUNction/douyin) | Python package and CLI work around Douyin APIs, auth flows, automation-heavy workflows. |
| [MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo) | Network configuration automation where reliability matters more than cleverness. |

## Toolbox

`Python` · `TypeScript` · `Shell/Bash` · `Linux` · `macOS` · `GitHub Actions` · `OpenPGP` · `MCP` · `Network Debugging` · `CLI Design`

## Bootstrap Lab

이 스크립트들은 실용성을 우선합니다. 먼저 diagnostics를 출력하고, 감지된 machine/network에 따라 분기하며, 자동화가 솔직하게 처리할 수 없는 경우 명확한 안내와 함께 실패합니다.

### Linux workstation bootstrap

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh | bash
```

Optional non-interactive example:

```bash
BOOTSTRAP_FEATURES=network-daed,fs-bees,shell,cn-desktop bash -c "$(curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh)"
```

It can install daed for transparent proxy workflows, configure CachyOS repositories on Arch-based systems, use `.deb` on Debian/Ubuntu, use `.rpm` on Fedora/RHEL/openSUSE, and expose optional modules for shell, filesystem, and desktop tooling.

### macOS bootstrap

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-macbook.sh | bash
```

Run as a normal Administrator user, not through `sudo`. Homebrew refuses root. On a fresh Mac, the script opens the Xcode Command Line Tools installer first because Homebrew needs Apple's `git`.

### SSH public key deployment

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash
```

Supports Termux and systemd Linux.

## Shell Modules

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/basic.sh | bash
```

## Secure Contact

[website terminal](https://lightjunction.github.io/lightjunction/)에서 브라우저로 메시지를 암호화하거나, 제 공개키를 직접 가져올 수 있습니다:

```bash
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys EB21B83AB1E982DF66F08387A67178405F7736FD
```

Fingerprint:

```text
EB21B83AB1E982DF66F08387A67178405F7736FD
```

## Support

제 프로젝트가 유용하다면 후원을 환영합니다: [sponsor and support](https://github.com/LIghtJUNction/lightjunction/tree/master/sponsor).

> 이 문서는 정적 번역본입니다. 영어 [README.md](README.md)는 전체 버전이며 자동으로 업데이트되는 동적 정보를 포함합니다.
