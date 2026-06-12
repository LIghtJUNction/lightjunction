> **今日工作汇报:** [WORK_REPORT/index.md](WORK_REPORT/index.md)

> **Support / ad slot:** Want to support my work or leave a public message? Open the project website, choose **Encrypted Message**, and send safe sponsorship details such as payment method, public transaction ID, public wallet address, contact information, or a short note. Do not send private keys, seed phrases, recovery codes, passwords, or production credentials.

> **OpenReview verification:** Hello OpenReview reviewers, I confirm that I have registered an OpenReview account under the name **LIghtJUNction**.

**Languages:** English · [中文](README.zh.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

<div align="center">
  <a href="https://gravatar.com/totallytriumph1a8c29e246" target="_blank">
    <img src="https://1.gravatar.com/avatar/1c12c2b9decdd50a37e024c03c80845876d06839aadda34c578a6183fd83c927?s=160&d=identicon" alt="LIghtJUNction" width="128" height="128">
  </a>

# LIghtJUNction

**AI tooling / independent AI research hat / Linux automation / practical security**

I build small, sharp tools for messy real-world systems: agents, bootstraps, data pipelines, game tooling, and terminal-first workflows.

Currently wearing the independent AI researcher hat, which is apparently very official now, while building agent tooling, proxy-aware bootstrap scripts, and practical Linux/macOS automation.

[Website Terminal](https://lightjunction.github.io/lightjunction/) · [Encrypted Message](https://lightjunction.github.io/lightjunction/) · [GitHub](https://github.com/LIghtJUNction) · [Hugging Face](https://huggingface.co/LIghtJUNction) · [Kaggle](https://www.kaggle.com/lightjunction) · [Email](mailto:lightjunction.me@gmail.com)

![Open to Work](https://img.shields.io/badge/Open_to-Remote%20%2F%20Hybrid-238636?style=for-the-badge)
![Focus](https://img.shields.io/badge/Focus-AI%20%2B%20Linux%20Automation-0d1117?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-OpenPGP%20Ready-6e40c9?style=for-the-badge)

</div>

## Agent Skills

Install my personal agent skills globally:

```bash
npx skills add LIghtJUNction/lightjunction -g
```

The skills live under `.agents/skills/` and are meant to capture my reusable workflows, preferences, and project-specific operating knowledge.

## Profile

Non-CS background, but I learn by shipping. My projects usually start from a personal pain point: setting up fresh machines behind difficult networks, making agents easier to operate, automating data collection, or turning a rough script into something another person can run.

<details>
<summary>Early technical interests</summary>

I have always been drawn to operating systems, especially Linux. Earlier on, I was obsessed with flashing and replacing systems on both phones and computers; I even managed to install an ARM build of Windows on an old Android phone.

For most of high school, I did not have access to today's level of AI tooling. Around my final year, I tried ChatGPT 3.5 for the first time and immediately felt that artificial intelligence would reshape society at a fundamental level.

</details>

| Snapshot | |
|:--|:--|
| Education | Zhengzhou University |
| Looking for | Remote or hybrid engineering opportunities |
| Strongest signal | Debugging real systems, not just demos |
| Open-source focus | AstrBot ecosystem, agent tooling, Linux automation |
| Favorite game | Oxygen Not Included |

I am looking for work where this style is useful: strong ownership, fast iteration, comfort with Linux, and willingness to debug the real path instead of only the happy path.

My rule of thumb: if a tool only works on my machine, it is not finished yet. Good automation should explain the machine it sees, make conservative choices, and fail loudly before it damages anything.

| What I like building | Evidence |
|:--|:--|
| AI and agent tooling | AstrBot ecosystem work, MCP tools, automation surfaces, terminal workflows |
| Linux and bootstrap automation | macOS/Linux setup scripts, package-manager detection, proxy-aware installs |
| Network tools | daed/mihomo/Hiddify related setup, transparent proxy workflows, domestic-network fallbacks |
| Data and platform tooling | Python CLIs, API wrappers, collection pipelines, repeatable scripts |
| Security-minded utilities | OpenPGP contact flow, SSH key deployment, explicit permission boundaries |
| Simulation games | Oxygen Not Included, especially systems that reward automation and debugging |

## Working Style

| Signal | What it means in practice |
|:--|:--|
| Reproduce first | I chase the actual failing command, package, network, or runtime path. |
| Prefer explicit systems | Scripts print diagnostics, list assumptions, and ask before risky work. |
| Ship usable surfaces | CLIs, README commands, defaults, and error messages are part of the product. |
| Keep learning public | The repository is a workshop: rough ideas become documented tools over time. |

## Selected Work

| Project | Why it matters |
|:--|:--|
| [AstrBot](https://github.com/AstrBotDevs/AstrBot) ecosystem | Bot framework contribution and packaging/plugin work around real runtime behavior. |
| [lightjunction](https://github.com/LIghtJUNction/lightjunction) | Personal terminal site, bootstrap scripts, encrypted contact flow, and reusable shell helpers. |
| [OniMods](https://github.com/LIghtJUNction/OniMods) | Oxygen Not Included tooling and MCP-style automation experiments for a complex simulation game. |
| [humen-mcp](https://github.com/LIghtJUNction/humen-mcp) | Rust MCP tool for human-in-the-loop interaction, with persistence and agent setup for real workflows. |
| [emailctl](https://github.com/LIghtJUNction/emailctl) | Published Rust crate for terminal email workflows; the package is `emailctl` and the CLI binary remains `email`. |
| [douyin](https://github.com/LIghtJUNction/douyin) | Python package and CLI work around Douyin APIs, auth flows, and automation-heavy workflows. |
| [MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo) | Network configuration automation where reliability matters more than cleverness. |

## Toolbox

`Python` · `Rust` · `TypeScript` · `Shell/Bash` · `Linux` · `macOS` · `GitHub Actions` · `OpenPGP` · `MCP` · `Network Debugging` · `CLI Design`

## Profile References

I keep this README closer to a compact portfolio than a sticker wall. The structure borrows from GitHub's profile README guidance and the community examples collected in `awesome-github-profile-readme`: clear identity first, selected proof second, and daily work notes kept separately in [WORK_REPORT/index.md](WORK_REPORT/index.md).

- GitHub Docs: [Managing your profile README](https://docs.github.com/en/account-and-profile/how-tos/setting-up-and-managing-your-profile/customizing-your-profile/managing-your-profile-readme)
- Examples: [abhisheknaiidu/awesome-github-profile-readme](https://github.com/abhisheknaiidu/awesome-github-profile-readme)

## Bootstrap Lab

These scripts are intentionally practical: they print diagnostics first, branch on the detected machine/network, and fail with explicit guidance when automation would be dishonest.

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

Run as a normal Administrator user, not through `sudo`. Homebrew refuses root. On a fresh Mac, the script opens the Xcode Command Line Tools installer first because Homebrew needs Apple's `git`. If a previous Command Line Tools install left `/Library/Developer/CommandLineTools` behind without registering it, the script clears that stale directory and resets `xcode-select` before retrying.

### SSH public key deployment

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash
```

Supports Termux and systemd Linux.

## Shell Modules

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/basic.sh | bash
```

<details>
<summary><strong>Module map</strong></summary>

| Module | Description |
|:--|:--|
| `env.sh` | Color variables, terminal detection, UTF-8/ASCII compatibility |
| `log.sh` | `err`, `warn`, `ok`, `info`, `debug`, `line` |
| `lib/str.sh` | trim, split, contains, replace, upper, lower, hash, uuid, rand |
| `lib/arr.sh` | join, contains, map, filter, sort, unique, sum, max, min |
| `lib/os.sh` | detect, is, arch, distro, has, require, ensure_dir, tmpdir |
| `lib/file.sh` | exists, is_file, is_dir, read, write, copy, move, size, md5 |
| `lib/net.sh` | check, download, http_get, http_post, public_ip, dns_lookup |
| `lib/prompt.sh` | yesno, input, password, menu, spinner, progress |

</details>

## Secure Contact

Use the [website terminal](https://lightjunction.github.io/lightjunction/) to encrypt a message in the browser, or import my public key manually:

```bash
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys EB21B83AB1E982DF66F08387A67178405F7736FD
```

Fingerprint:

```text
EB21B83AB1E982DF66F08387A67178405F7736FD
```

## Support

If my projects are useful to you, sponsorship is welcome: [sponsor and support](https://github.com/LIghtJUNction/lightjunction/tree/master/sponsor).

<div align="center">
  <img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=238636&height=80&section=footer" alt="">
</div>
