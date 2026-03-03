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

- **Account Created**: 2022-06-06 (3 years, 9 months ago)
- **Public Repositories**: 65
- **Estimated Commits**: 793+ (sampled from 22 repositories, up to 100 commits each)
- **Followers**: 54
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

- **Total commits this week**: 8
- **Daily average**: 1.1 commits
- **Most active repositories**:
  1. **MagicMihomo**: 7 commits (87.5%)
  2. **Mimic-Node**: 1 commits (12.5%)
<!-- END_DYNAMIC_SUMMARY -->

---

<!-- START_DYNAMIC_REPO_LIST -->

- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - MagicNet-mihomo
  - `Stars: 7 | Forks: 0 | Language: Shell | Updated: 2026-03-02`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - VLESS + Reality + XTLS-Vision/xhttp
  - `Stars: 9 | Forks: 1 | Language: Rust | Updated: 2026-03-02`
- **[lightjunction](https://github.com/LIghtJUNction/lightjunction)** - I'M LIghtJUNction
  - `Stars: 2 | Forks: 0 | Language: Shell | Updated: 2026-03-02`
- **[MagicNet](https://github.com/LIghtJUNction/MagicNet)** - A Magisk module that lets you use the mihomo kernel's TUN mode on Android. Built with KAM.
  - `Stars: 47 | Forks: 1 | Language: Shell | Updated: 2026-03-01`
- **[dots-hyprland](https://github.com/LIghtJUNction/dots-hyprland)** - uhh questioning the meaning of dotfiles
  - `Stars: 1 | Forks: 0 | Language: QML | Updated: 2026-02-06`
<!-- END_DYNAMIC_REPO_LIST -->

---

<details>
  <summary>Recent Commits (Last 7 Days)</summary>

<!-- START_DYNAMIC_COMMITS -->

- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [dab60a7](https://github.com/LIghtJUNction/MagicMihomo/commit/dab60a77cf4323ba4b2392ba2eb310f5fd4896c0) - ruleset: update-ruleset `2026-03-02 22:54`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - [83860f2](https://github.com/LIghtJUNction/Mimic-Node/commit/83860f27f6bc2084f440cfd66c4ebfcd9cddde89) - Merge pull request #1 from LIghtJUNction/dependabot/cargo/cargo-f6ecf5c85a `2026-03-02 07:28`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [e5a4975](https://github.com/LIghtJUNction/MagicMihomo/commit/e5a49755eb1920491a65583791004a2953b86336) - ruleset: update-ruleset `2026-03-01 22:50`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [b12e622](https://github.com/LIghtJUNction/MagicMihomo/commit/b12e622861e38a6f7e593a6463739b1ad90cde71) - ruleset: update-ruleset `2026-02-28 22:48`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [a1abad1](https://github.com/LIghtJUNction/MagicMihomo/commit/a1abad121285c9ced8ffbb843e0eeffe121af6a9) - ruleset: update-ruleset `2026-02-27 22:52`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [ff260d1](https://github.com/LIghtJUNction/MagicMihomo/commit/ff260d1249c7f35a9df254efacdad91d056c4aa2) - ruleset: update-ruleset `2026-02-26 23:01`
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
 
