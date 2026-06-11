> **支援 / 広告枠:** 私のプロジェクトを支援したい場合、または公開用のメッセージを残したい場合は、プロジェクトの Web サイトで **Encrypted Message** を開き、任意の寄付情報を送ってください。支払い方法、口令红包、Bitcoin ウォレットの秘密鍵、連絡先、その他のスポンサー用メモを送れます。メッセージはブラウザ上で私の GPG 公開鍵により暗号化され、復号できるのは私だけです。

**言語:** [English](README.md)（完全版、動的更新） · [中文](README.zh.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · 日本語（静的版）

<div align="center">
  <a href="https://gravatar.com/totallytriumph1a8c29e246" target="_blank">
    <img src="https://1.gravatar.com/avatar/1c12c2b9decdd50a37e024c03c80845876d06839aadda34c578a6183fd83c927?s=160&d=identicon" alt="LIghtJUNction" width="128" height="128">
  </a>

# LIghtJUNction

**AI tooling / Linux 自動化 / ネットワークインフラ / 実用的セキュリティ**

私は現実の複雑なシステムを扱うための小さく鋭いツールを作っています。agents、bootstrap scripts、data pipelines、game tooling、terminal-first workflows などです。

現在は agent tooling、proxy-aware bootstrap scripts、実用的な Linux/macOS automation を中心に作っています。

[Website Terminal](https://lightjunction.github.io/lightjunction/) · [Encrypted Message](https://lightjunction.github.io/lightjunction/) · [GitHub](https://github.com/LIghtJUNction) · [Hugging Face](https://huggingface.co/LIghtJUNction) · [Kaggle](https://www.kaggle.com/lightjunction) · [Email](mailto:lightjunction.me@gmail.com)

</div>

## Agent Skills

私の個人用 agent skills をグローバルにインストールします:

```bash
npx skills add LIghtJUNction/lightjunction -g
```

Skills は `.agents/skills/` にあり、再利用可能な workflows、preferences、project-specific operating knowledge を記録します。

## プロフィール

私は CS 専攻ではありませんが、実際に出荷しながら学びます。私のプロジェクトは多くの場合、個人的な課題から始まります。難しいネットワーク環境で新しいマシンをセットアップすること、agents を運用しやすくすること、データ収集を自動化すること、粗いスクリプトを他人も実行できるツールにすることです。

<details>
<summary>初期の技術的関心</summary>

私は昔からオペレーティングシステムが好きで、特に Linux に強く惹かれていました。以前はスマートフォンや PC に別のシステムを入れることに夢中で、古い Android スマートフォンに ARM 版 Windows を入れたこともあります。

高校時代のほとんどは、今ほど強力な人工知能ツールがありませんでした。高校三年生のころに初めて ChatGPT 3.5 を体験し、その時点で人工知能は将来、社会を根本から変えると感じました。

</details>

| Snapshot | |
|:--|:--|
| Education | Zhengzhou University |
| Looking for | Remote or hybrid engineering opportunities |
| Strongest signal | Debugging real systems, not just demos |
| Open-source focus | AstrBot ecosystem, agent tooling, Linux automation |
| Favorite game | Oxygen Not Included |

私はこのスタイルが役に立つ仕事を探しています。強い ownership、速い iteration、Linux への慣れ、そして happy path だけでなく実際の経路をデバッグする姿勢です。

私の目安は単純です。自分のマシンでしか動かないツールは、まだ完成していません。良い自動化は見えているマシンを説明し、保守的な選択をし、何かを壊す前に明確に失敗します。

| 作るのが好きなもの | Evidence |
|:--|:--|
| AI and agent tooling | AstrBot ecosystem work, MCP tools, automation surfaces, terminal workflows |
| Linux and bootstrap automation | macOS/Linux setup scripts, package-manager detection, proxy-aware installs |
| Network tools | daed/mihomo/Hiddify related setup, transparent proxy workflows, difficult-network fallbacks |
| Data and platform tooling | Python CLIs, API wrappers, collection pipelines, repeatable scripts |
| Security-minded utilities | OpenPGP contact flow, SSH key deployment, explicit permission boundaries |
| Simulation games | Oxygen Not Included, especially systems that reward automation and debugging |

## 作業スタイル

| Signal | 実際の意味 |
|:--|:--|
| Reproduce first | 実際に失敗している command、package、network、runtime path を追います。 |
| Prefer explicit systems | Scripts print diagnostics, list assumptions, and ask before risky work. |
| Ship usable surfaces | CLIs, README commands, defaults, and error messages are part of the product. |
| Keep learning public | The repository is a workshop: rough ideas become documented tools over time. |

## Selected Work

| Project | Why it matters |
|:--|:--|
| [AstrBot](https://github.com/AstrBotDevs/AstrBot) ecosystem | Bot framework contribution and packaging/plugin work around real runtime behavior. |
| [lightjunction](https://github.com/LIghtJUNction/lightjunction) | Personal terminal site, bootstrap scripts, encrypted contact flow, reusable shell helpers. |
| [OniMods](https://github.com/LIghtJUNction/OniMods) | Oxygen Not Included tooling and MCP-style automation experiments for a complex simulation game. |
| [humen-mcp](https://github.com/LIghtJUNction/humen-mcp) | Rust MCP tool for human-in-the-loop interaction, with persistence and agent setup for real workflows. |
| [emailctl](https://github.com/LIghtJUNction/emailctl) | Published Rust crate for terminal email workflows; the package is `emailctl` and the CLI binary remains `email`. |
| [douyin](https://github.com/LIghtJUNction/douyin) | Python package and CLI work around Douyin APIs, auth flows, automation-heavy workflows. |
| [MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo) | Network configuration automation where reliability matters more than cleverness. |

## Toolbox

`Python` · `Rust` · `TypeScript` · `Shell/Bash` · `Linux` · `macOS` · `GitHub Actions` · `OpenPGP` · `MCP` · `Network Debugging` · `CLI Design`

## Bootstrap Lab

これらのスクリプトは実用性を重視しています。まず diagnostics を表示し、検出した machine/network に応じて分岐し、自動化が正直に処理できない場合は明確な説明とともに失敗します。

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

[website terminal](https://lightjunction.github.io/lightjunction/) を使ってブラウザでメッセージを暗号化するか、私の公開鍵を手動でインポートしてください:

```bash
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys EB21B83AB1E982DF66F08387A67178405F7736FD
```

Fingerprint:

```text
EB21B83AB1E982DF66F08387A67178405F7736FD
```

## Support

私のプロジェクトが役に立つ場合は、スポンサーを歓迎します: [sponsor and support](https://github.com/LIghtJUNction/lightjunction/tree/master/sponsor)。

> これは静的な翻訳版です。英語の [README.md](README.md) が完全版で、自動更新される動的情報を含みます。
