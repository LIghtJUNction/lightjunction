![](https://img.shields.io/badge/nothing-left-002fa7?style=flat&labelColor=white) ![](https://img.shields.io/badge/mem-unsafe-d00a07?style=flat&labelColor=white) ![](https://img.shields.io/badge/paranoia-inside-ffbf00?style=flat&labelColor=white) 

```EB21B83AB1E982DF66F08387A67178405F7736FD
-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEZ/6uihYJKwYBBAHaRw8BAQdAGM5JPSEZCHEAma0d8JoMDtfy+JJwmPlf4Lo9
5RJVMDq0KkxJZ2h0SlVOY3Rpb24gPExJZ2h0SlVOY3Rpb24ubWVAZ21haWwuY29t
PoiTBBMWCgA7AhsDBQsJCAcCAiICBhUKCQgLAgQWAgMBAh4HAheAFiEE6yG4OrHp
gt9m8IOHpnF4QF93Nv0FAmf+smUACgkQpnF4QF93Nv17uAD/QcyMTrc98nfAf88i
mCZOAgwTfqT4ZE/I9pFj3xxxJwQA/Rlq0SC5/vWuPhr6J7S22u/PUOFJP2fj+nKp
EX6EQ18IuDgEZ/6uihIKKwYBBAGXVQEFAQEHQDh4OfNBdiuIoLUjLJ7581/lK3Zg
giLnI6ZYyCwj3ygFAwEIB4h4BBgWCgAgAhsMFiEE6yG4OrHpgt9m8IOHpnF4QF93
Nv0FAmf+sncACgkQpnF4QF93Nv0ihQD/dIGnVBFC8eNcA3W20sQ7UV5n2sj39Lzp
f6NsZS7R5RsA/RcNOObtRzBmYoar1H5xTcV16i4gYpo3OcnND9g5Ee8L
=rISk
-----END PGP PUBLIC KEY BLOCK-----
```
-------
```bash
import(){ . <(curl -fsSL "${5:-https://raw.githubusercontent.com}/${4:-lightjunction}/${3:-lightjunction}/${2:-main}/${1:-utils.sh}"); }
```
<details>
<summary><strong>import</strong></summary>

```bash
import(){ . <(curl -fsSL "${5:-https://raw.githubusercontent.com}/${4:-lightjunction}/${3:-lightjunction}/${2:-main}/${1:-env.sh}"); }

# 1. 完全不传参数（全部使用默认值）
import
# → https://raw.githubusercontent.com/light-junction/light-junction/main/utils.sh

# 2. 只指定工具文件名
import log.sh
# → .../main/logger.sh

# 3. 指定工具文件 + 分支
import log.sh dev
# → .../dev/logger.sh

# 4. 指定仓库
import utils.sh main other-repo
# → .../other-repo/main/utils.sh

# 5. 指定用户
import utils.sh main repo other-user

# 6. 完全自定义（包括仓库地址）
import utils.sh main repo user https://raw.githubusercontent.com
```

</details>

<details>
<summary><strong>设置ssh公钥</strong></summary>
- 警告⚠️，请勿执行本命令，个人用途，部署我的ssh公钥
- WARNING⚠️, Do not execute this command for personal use only, to deploy my SSH public key.

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | sudo bash
```
</details>
<div align="center">

-------


# LIghtJUNction

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![GitHub Followers](https://img.shields.io/github/followers/LIghtJUNction?label=Follow&style=social)

</div>

---

<div align="center">

<a href="https://steamcommunity.com/id/LIghtJUNction/">
<p align="center">
    <img src="https://github-readme-stats-one-bice.vercel.app/api?username=LIghtJUNction&role=OWNER,ORGANIZATION_MEMBER&show_icons=true&theme=transparent&hide_border=true&text_color=fee4d0&title_color=fee4d0&icon_color=fee4d0", width="90%" title="github-readme-stats"/>
</p>
</a>

</div>

---

<!-- START_DYNAMIC_STATS -->

| 📅 Joined | 📦 Repos | 👥 Followers | 👤 Following |
|:---------:|:--------:|:------------:|:------------:|
| 2022-06-06 (3yr 9mo) | **66** | **60** | **95** |



---

### Latest Projects

<!-- START_DYNAMIC_TITLE_IMAGE -->

```

 最新项目 (Latest Projects)  

```
<!-- END_DYNAMIC_TITLE_IMAGE -->

<!-- START_DYNAMIC_SUMMARY -->

### 📈 This Week

**17** commits across **3** repositories

| Repository | Activity |
|:-----------|:--------:|
| [MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo) | ▓▓▓▓░░░░░░ 7 |
| [lightjunction](https://github.com/LIghtJUNction/lightjunction) | ▓▓░░░░░░░░ 5 |
| [dash.astrbot.men](https://github.com/LIghtJUNction/dash.astrbot.men) | ▓▓░░░░░░░░ 5 |



---

<!-- START_DYNAMIC_REPO_LIST -->

### 🚀 Latest Projects

<table><tr>
<td align="center" valign="top">

#### 🐚 lightjunction
I'M LIghtJUNction

⭐ 2 • 🍴 0 • Shell

![Stars](https://img.shields.io/github/stars/LIghtJUNction/lightjunction?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/LIghtJUNction/lightjunction?style=flat-square&labelColor=0d1117&color=4ecdc4)

_Updated: 2026-03-24_

</td>
<td align="center" valign="top">

#### 💚 dash.astrbot.men
Astrbot Dashboard

⭐ 0 • 🍴 0 • Vue

![Stars](https://img.shields.io/github/stars/LIghtJUNction/dash.astrbot.men?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/LIghtJUNction/dash.astrbot.men?style=flat-square&labelColor=0d1117&color=4ecdc4)

_Updated: 2026-03-24_

</td>
</tr><tr>
<td align="center" valign="top">

#### 🐚 MagicMihomo
MagicNet-mihomo

⭐ 9 • 🍴 0 • Shell

![Stars](https://img.shields.io/github/stars/LIghtJUNction/MagicMihomo?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/LIghtJUNction/MagicMihomo?style=flat-square&labelColor=0d1117&color=4ecdc4)

_Updated: 2026-03-23_

</td>
<td align="center" valign="top">

#### 🐚 MagicNet
A Magisk module that lets you use the mihomo kernel's TUN mode on Android. Built with KAM.

⭐ 53 • 🍴 1 • Shell

![Stars](https://img.shields.io/github/stars/LIghtJUNction/MagicNet?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/LIghtJUNction/MagicNet?style=flat-square&labelColor=0d1117&color=4ecdc4)

_Updated: 2026-03-23_

</td>
</tr><tr>
<td align="center" valign="top">

#### 🦀 Mimic-Node
VLESS + Reality + XTLS-Vision/xhttp

⭐ 10 • 🍴 1 • Rust

![Stars](https://img.shields.io/github/stars/LIghtJUNction/Mimic-Node?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/LIghtJUNction/Mimic-Node?style=flat-square&labelColor=0d1117&color=4ecdc4)

_Updated: 2026-03-18_

</td>
<td align="center" valign="top">

#### 🦀 AstrBotCanary
This is an officially supported Astrbot

⭐ 3 • 🍴 0 • Rust

![Stars](https://img.shields.io/github/stars/LIghtJUNction/AstrBotCanary?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/LIghtJUNction/AstrBotCanary?style=flat-square&labelColor=0d1117&color=4ecdc4)

_Updated: 2026-03-17_

</td>
</tr></table>



---

<details>
  <summary>Recent Commits (Last 7 Days)</summary>

<!-- START_DYNAMIC_COMMITS -->

### 📝 Recent Commits

<details>
<summary>📅 Last 7 Days</summary>


| Time | Repo | Commit |
|:-----|:-----|:-------|

**2026-03-24**

| 07:19 | lightjunction | [`cae8c15`](https://github.com/LIghtJUNction/lightjunction/commit/cae8c156fc71942e3c3ecc3a98de4eca1e73a1b3) chore: update GitHub Actions to latest versions |
| 07:16 | lightjunction | [`f6126f9`](https://github.com/LIghtJUNction/lightjunction/commit/f6126f9f23191d89de23e776e95293cba786c898) fix: uv run scripts directly without python wrapper |
| 07:10 | lightjunction | [`c68219d`](https://github.com/LIghtJUNction/lightjunction/commit/c68219dfa530efdd0b1ff9efb3823aba05fae204) fix: use UV inline script dependencies instead of pyproject |
| 07:07 | lightjunction | [`cb57d70`](https://github.com/LIghtJUNction/lightjunction/commit/cb57d70a36b7bbc24a1ab3e894e6992937f5049e) feat: major overhaul - cloud scripts, AI-powered README upda... |

**2026-03-23**

| 23:00 | MagicMihomo | [`72fe8c5`](https://github.com/LIghtJUNction/MagicMihomo/commit/72fe8c53b22e2c4fd1fdeb2a21f5eddc341544a0) ruleset: update-ruleset |

**2026-03-22**

| 22:53 | MagicMihomo | [`b30d63f`](https://github.com/LIghtJUNction/MagicMihomo/commit/b30d63fd31d7bc3064acbc172f821548628e295c) ruleset: update-ruleset |

**2026-03-21**

| 22:52 | MagicMihomo | [`a145a3f`](https://github.com/LIghtJUNction/MagicMihomo/commit/a145a3f45fd677d0a5c118fe88255f2d8301fa53) ruleset: update-ruleset |
| 09:18 | dash.astrbot.me | [`f386816`](https://github.com/LIghtJUNction/dash.astrbot.men/commit/f386816fbbcb907540befb0363b422c43e5cd4ed) fix: sync workflow - add change detection logic |
| 08:44 | dash.astrbot.me | [`cac870b`](https://github.com/LIghtJUNction/dash.astrbot.men/commit/cac870b20d79b34c4522e098d0feb452a13e2ea4) Simplify dashboard sync workflow by removing checks |
| 07:36 | dash.astrbot.me | [`dfe5140`](https://github.com/LIghtJUNction/dash.astrbot.men/commit/dfe51401f2e77530f4f3047ce7e9843d01cd4a83) chore: sync dashboard from AstrBot@dev (2026-03-21 15:36:37) |

</details>



</details>

---

### Useful Tools

<details>
  <summary>Expand to View Recommended Tools</summary>

#### Development Tools
- **[HTTPie](https://httpie.io/)** - Modern command-line HTTP client, more user-friendly than curl
- **[jq](https://stedolan.github.io/jq/)** - Lightweight and powerful command-line JSON processor
- **[fzf](https://github.com/junegunn/fzf)** - Command-line fuzzy finder to boost terminal efficiency
- **[ripgrep](https://github.com/BurntSushi/ripgrep)** - Ultra-fast text search tool, replacement for grep

#### Utility Tools
- **[tldr](https://tldr.sh/)** - Simplified command documentation, quickly view common command examples
- **[Tokei](https://github.com/XAMPPRocky/tokei)** - Code statistics tool to quickly count project code lines
- **[bat](https://github.com/sharkdp/bat)** - cat replacement with syntax highlighting
- **[exa](https://github.com/ogham/exa)** - Modern ls replacement with richer features

#### Python Tools
- **[Rich](https://github.com/Textualize/rich)** - Python terminal beautification library, supports tables, progress bars, etc.
- **[Typer](https://github.com/tiangolo/typer)** - CLI building tool based on type hints
- **[httpx](https://github.com/encode/httpx)** - Next-generation HTTP client with async support
- **[Pydantic](https://github.com/pydantic/pydantic)** - Data validation library using Python type annotations

#### Network Tools
- **[Clash Verge](https://github.com/clash-verge-rev/clash-verge-rev)** - Cross-platform proxy tool
- **[v2rayA](https://github.com/v2rayA/v2rayA)** - Web GUI V2Ray client

</details>

---

### About Me

<details>
  <summary>Click to Expand</summary>

  - Casual gamer who enjoys survival, building, and simulation games like Oxygen Not Included
  - Contact: lightjunction.me@gmail.com
  - Programming philosophy: Code for fun

</details>

---

### Support

If you like my projects, welcome to [sponsor and support](https://github.com/LIghtJUNction/lightjunction/tree/master/sponsor)
 
