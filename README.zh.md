> **赞助 / 广告位：** 如果你想支持我的项目，或者留下公开展示用的信息，请打开本项目网页，进入 **Encrypted Message / 加密消息**，发送任意捐款信息：付款方式、口令红包、比特币钱包私钥、你的联系方式，或其他赞助备注。消息会在前端使用我的 GPG 公钥加密，只有我能解开。

**语言：** [English](README.md)（完整版本，动态更新） · 中文（静态版本） · [Русский](README.ru.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

<div align="center">
  <a href="https://gravatar.com/totallytriumph1a8c29e246" target="_blank">
    <img src="https://1.gravatar.com/avatar/1c12c2b9decdd50a37e024c03c80845876d06839aadda34c578a6183fd83c927?s=160&d=identicon" alt="LIghtJUNction" width="128" height="128">
  </a>

# LIghtJUNction

**AI 工具 / Linux 自动化 / 网络基础设施 / 实用安全**

我构建小而锋利的工具，用来处理真实系统里的复杂问题：agent、初始化脚本、数据流水线、游戏工具，以及终端优先的工作流。

目前主要围绕 agent 工具、代理感知的 bootstrap 脚本，以及实用的 Linux/macOS 自动化工作。

[网站终端](https://lightjunction.github.io/lightjunction/) · [加密消息](https://lightjunction.github.io/lightjunction/) · [GitHub](https://github.com/LIghtJUNction) · [Hugging Face](https://huggingface.co/LIghtJUNction) · [Kaggle](https://www.kaggle.com/lightjunction) · [Email](mailto:lightjunction.me@gmail.com)

</div>

## Agent Skills

全局安装我的个人 agent skills：

```bash
npx skills add LIghtJUNction/lightjunction -g
```

这些 skills 位于 `.agents/skills/`，用于沉淀我可复用的工作流、偏好和项目级操作知识。

## 个人简介

我不是科班 CS 出身，但我通过交付来学习。我的项目通常来自真实痛点：在复杂网络环境下配置新机器，让 agent 更容易操作，自动化数据采集，或者把粗糙脚本变成别人也能运行的工具。

<details>
<summary>早期技术兴趣</summary>

我一直很喜欢操作系统，尤其是 Linux。早些时候，我痴迷于给各种设备刷系统，不管是手机还是电脑；我甚至曾经把一台老旧安卓手机刷成 ARM 架构的 Windows 系统。

我的整个高中阶段，还没有如今这么强大的人工智能工具。大概到高三时，我第一次体验 ChatGPT 3.5，当时就判断人工智能会在未来从根本上重塑整个社会。

</details>

| 快照 | |
|:--|:--|
| 教育 | 郑州大学 |
| 求职方向 | 远程或混合办公工程岗位 |
| 最强信号 | 调试真实系统，而不是只做 demo |
| 开源重点 | AstrBot 生态、agent 工具、Linux 自动化 |
| 喜欢的游戏 | Oxygen Not Included |

我在寻找适合这种工作方式的岗位：强 ownership、快速迭代、熟悉 Linux，并愿意调试真实路径，而不只是 happy path。

我的经验法则：如果一个工具只在我的机器上能跑，那它还没完成。好的自动化应该解释它看到的机器，做保守选择，并在造成破坏前明确失败。

| 我喜欢构建的东西 | 证据 |
|:--|:--|
| AI 和 agent 工具 | AstrBot 生态工作、MCP 工具、自动化界面、终端工作流 |
| Linux 和 bootstrap 自动化 | macOS/Linux 初始化脚本、包管理器检测、代理感知安装 |
| 网络工具 | daed/mihomo/Hiddify 相关设置、透明代理工作流、国内网络 fallback |
| 数据和平台工具 | Python CLI、API wrapper、采集流水线、可复现脚本 |
| 安全意识工具 | OpenPGP 联系流程、SSH key 部署、明确权限边界 |
| 模拟游戏 | Oxygen Not Included，尤其是奖励自动化和调试能力的系统 |

## 工作方式

| 信号 | 实际含义 |
|:--|:--|
| 先复现 | 追踪真实失败的命令、包、网络或运行时路径。 |
| 偏好显式系统 | 脚本先打印诊断信息，列出假设，并在风险操作前询问。 |
| 交付可用界面 | CLI、README 命令、默认值和错误信息都是产品的一部分。 |
| 公开学习 | 这个仓库像工作台：粗糙想法会逐步变成有文档的工具。 |

## 代表项目

| 项目 | 意义 |
|:--|:--|
| [AstrBot](https://github.com/AstrBotDevs/AstrBot) ecosystem | 围绕真实运行时行为参与 bot framework 贡献、打包和插件工作。 |
| [lightjunction](https://github.com/LIghtJUNction/lightjunction) | 个人终端网站、bootstrap 脚本、加密联系流程和可复用 shell helpers。 |
| [OniMods](https://github.com/LIghtJUNction/OniMods) | Oxygen Not Included 工具和面向复杂模拟游戏的 MCP 风格自动化实验。 |
| [humen-mcp](https://github.com/LIghtJUNction/humen-mcp) | 面向真人参与的 Rust MCP 工具，支持持久化请求和 agent 初始化，适合真实工作流。 |
| [emailctl](https://github.com/LIghtJUNction/emailctl) | 已发布到 crates.io 的 Rust 终端邮件工具；crate/package 名是 `emailctl`，命令行 binary 仍是 `email`。 |
| [douyin](https://github.com/LIghtJUNction/douyin) | 围绕抖音 API、认证流程和自动化工作流的 Python package 与 CLI。 |
| [MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo) | 网络配置自动化，可靠性比炫技更重要。 |

## 工具箱

`Python` · `Rust` · `TypeScript` · `Shell/Bash` · `Linux` · `macOS` · `GitHub Actions` · `OpenPGP` · `MCP` · `Network Debugging` · `CLI Design`

## Bootstrap Lab

这些脚本有意保持实用：先打印诊断信息，再根据检测到的机器和网络分支执行；当自动化无法诚实完成时，会给出明确提示并失败。

### Linux workstation bootstrap

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh | bash
```

可选的非交互示例：

```bash
BOOTSTRAP_FEATURES=network-daed,fs-bees,shell,cn-desktop bash -c "$(curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh)"
```

它可以安装 daed 以支持透明代理工作流，在 Arch 系发行版上配置 CachyOS 仓库，在 Debian/Ubuntu 上使用 `.deb`，在 Fedora/RHEL/openSUSE 上使用 `.rpm`，并提供 shell、filesystem 和 desktop 工具模块。

### macOS bootstrap

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-macbook.sh | bash
```

请以普通 Administrator 用户运行，不要通过 `sudo`。Homebrew 拒绝 root。新 Mac 会先打开 Xcode Command Line Tools 安装器，因为 Homebrew 需要 Apple 的 `git`。

### SSH public key deployment

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash
```

支持 Termux 和 systemd Linux。

## Shell Modules

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/basic.sh | bash
```

## 安全联系

使用[网站终端](https://lightjunction.github.io/lightjunction/)在浏览器中加密消息，或手动导入我的公钥：

```bash
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys EB21B83AB1E982DF66F08387A67178405F7736FD
```

Fingerprint:

```text
EB21B83AB1E982DF66F08387A67178405F7736FD
```

## 赞助

如果我的项目对你有用，欢迎赞助：[sponsor and support](https://github.com/LIghtJUNction/lightjunction/tree/master/sponsor)。

> 这是静态翻译版本。英文 [README.md](README.md) 是完整版本，并包含自动更新的动态信息。
