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
<summary><strong>import 用法说明</strong></summary>

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

### GitHub Statistics

- **Account Created**: 2022-06-06 (3 years, 7 months ago)
- **Public Repositories**: 66
- **Estimated Commits**: 698+ (sampled from 22 repositories, up to 100 commits each)
- **Followers**: 42
- **Following**: 84
<!-- END_DYNAMIC_STATS -->

---

### Latest Projects

<!-- START_DYNAMIC_TITLE_IMAGE -->

```

 最新项目 (Latest Projects)  

```
<!-- END_DYNAMIC_TITLE_IMAGE -->

<!-- START_DYNAMIC_SUMMARY -->

### Weekly Activity Summary

- **Total commits this week**: 13
- **Daily average**: 1.9 commits
- **Most active repositories**:
  1. **MagicMihomo**: 7 commits (53.8%)
  2. **lightjunction**: 2 commits (15.4%)
  3. **Mimic-Node**: 2 commits (15.4%)
<!-- END_DYNAMIC_SUMMARY -->

---

<!-- START_DYNAMIC_REPO_LIST -->

- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - MagicNet-mihomo
  - `Stars: 5 | Forks: 0 | Language: Shell | Updated: 2026-01-18`
- **[lightjunction](https://github.com/LIghtJUNction/lightjunction)** - I'M LIghtJUNction
  - `Stars: 2 | Forks: 0 | Language: Shell | Updated: 2026-01-18`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - VLESS + Reality + XTLS-Vision/xhttp
  - `Stars: 3 | Forks: 1 | Language: Rust | Updated: 2026-01-17`
- **[MagicNet](https://github.com/LIghtJUNction/MagicNet)** - A Magisk module that lets you use the mihomo kernel's TUN mode on Android. Built with KAM.
  - `Stars: 33 | Forks: 1 | Language: Shell | Updated: 2026-01-17`
- **[password-store](https://github.com/LIghtJUNction/password-store)** - powered by pass
  - `Stars: 0 | Forks: 0 | Language: None | Updated: 2026-01-09`
<!-- END_DYNAMIC_REPO_LIST -->

---

<details>
  <summary>Recent Commits (Last 7 Days)</summary>

<!-- START_DYNAMIC_COMMITS -->

- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [142408d](https://github.com/LIghtJUNction/MagicMihomo/commit/142408d67b89d2f0f4dca44a6990ebf7440cbdca) - ruleset: update-ruleset `2026-01-18 22:45`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [2459d1d](https://github.com/LIghtJUNction/MagicMihomo/commit/2459d1d940f1dcbe263b7b37aefd8bd67b60290a) - ruleset: update-ruleset `2026-01-17 22:44`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - [7b44b78](https://github.com/LIghtJUNction/Mimic-Node/commit/7b44b788572d0eecf09cd5983bde2b0a3cf68786) - 更新 README.md `2026-01-17 20:23`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [96105f4](https://github.com/LIghtJUNction/MagicMihomo/commit/96105f404dca627a94019295b993153ccce06914) - ruleset: update-ruleset `2026-01-16 22:47`
- **[lightjunction](https://github.com/LIghtJUNction/lightjunction)** - [a9a5503](https://github.com/LIghtJUNction/lightjunction/commit/a9a55030300f62453d7f5ce7712539e675f1361a) - 更新 README.md `2026-01-16 06:08`
- **[lightjunction](https://github.com/LIghtJUNction/lightjunction)** - [d0105e0](https://github.com/LIghtJUNction/lightjunction/commit/d0105e0586ece6a3244380d91d1dbbe11d634a30) - 更新 README.md `2026-01-16 05:55`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [9e1aea7](https://github.com/LIghtJUNction/MagicMihomo/commit/9e1aea757e3e4f2efc0c98e39f4f82804c92f1ca) - ruleset: update-ruleset `2026-01-15 22:47`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [db7b011](https://github.com/LIghtJUNction/MagicMihomo/commit/db7b011a777c7149bd65ee602e283f4c8cb91658) - ruleset: update-ruleset `2026-01-14 22:49`
- **[MagicNet](https://github.com/LIghtJUNction/MagicNet)** - [36827c9](https://github.com/LIghtJUNction/MagicNet/commit/36827c9a5942c529558ec54a21fdf85999d8c5b1) - 更新 README.md `2026-01-12 19:02`
- **[MagicNet](https://github.com/LIghtJUNction/MagicNet)** - [73f24a1](https://github.com/LIghtJUNction/MagicNet/commit/73f24a1e5b7186d0a8ed61364ea3442c1291d1fe) - 更新 README.md `2026-01-12 19:00`
<!-- END_DYNAMIC_COMMITS -->

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
 
