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
-元函数
```bash
import(){ . <(curl -fsSL "${5:-https://raw.githubusercontent.com}/${4:-lightjunction}/${3:-lightjunction}/${2:-main}/${1:-utils.sh}"); }
```
<details>
<summary><strong>import 用法说明</strong></summary>

```bash
# 元定义，直接复制即可
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
<summary><strong>以下为ssh公钥（gpg密钥库的一个子密钥，由gpg-agent管理）部署脚本，个人用途，请勿执行</strong></summary>
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
- **Public Repositories**: 67
- **Estimated Commits**: 685+ (sampled from 22 repositories, up to 100 commits each)
- **Followers**: 43
- **Following**: 80
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

- **Total commits this week**: 95
- **Daily average**: 13.6 commits
- **Most active repositories**:
  1. **Mimic-Node**: 44 commits (46.3%)
  2. **lightjunction**: 26 commits (27.4%)
  3. **MagicNet**: 10 commits (10.5%)
<!-- END_DYNAMIC_SUMMARY -->

---

<!-- START_DYNAMIC_REPO_LIST -->

- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - VLESS + Reality + XTLS-Vision/xhttp
  - `Stars: 2 | Forks: 0 | Language: Rust | Updated: 2026-01-11`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - MagicNet-mihomo
  - `Stars: 5 | Forks: 0 | Language: Shell | Updated: 2026-01-10`
- **[lightjunction](https://github.com/LIghtJUNction/lightjunction)** - I'M LIghtJUNction
  - `Stars: 2 | Forks: 0 | Language: Shell | Updated: 2026-01-10`
- **[password-store](https://github.com/LIghtJUNction/password-store)** - powered by pass
  - `Stars: 0 | Forks: 0 | Language: None | Updated: 2026-01-09`
- **[MagicSingBox](https://github.com/LIghtJUNction/MagicSingBox)** - MagicNet x sing-box
  - `Stars: 0 | Forks: 0 | Language: None | Updated: 2026-01-09`
<!-- END_DYNAMIC_REPO_LIST -->

---

<details>
  <summary>Recent Commits (Last 7 Days)</summary>

<!-- START_DYNAMIC_COMMITS -->

- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - [68239f5](https://github.com/LIghtJUNction/Mimic-Node/commit/68239f5aa9cfa658cb6ccc4dbf3ade16cba1ca2c) - 更新 README.md `2026-01-11 01:48`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - [70d17f0](https://github.com/LIghtJUNction/Mimic-Node/commit/70d17f0281df9e16ce901ff1e5108192a4b288c3) - 创建 example/client/config.json `2026-01-11 01:41`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [c634f53](https://github.com/LIghtJUNction/MagicMihomo/commit/c634f53889cf28953a097ce01d233969b3388611) - ruleset: update-ruleset `2026-01-10 22:45`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - [c6898cd](https://github.com/LIghtJUNction/Mimic-Node/commit/c6898cd8abcca0c4a70967128eb1590f47e71351) - update `2026-01-10 22:33`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - [e718a4e](https://github.com/LIghtJUNction/Mimic-Node/commit/e718a4e892a59b8155ce88739ca45d53c1891f37) - update `2026-01-10 20:48`
- **[Mimic-Node](https://github.com/LIghtJUNction/Mimic-Node)** - [9ccf06d](https://github.com/LIghtJUNction/Mimic-Node/commit/9ccf06d580709f9f18f084319fa788bd32ba4d2e) - update `2026-01-10 20:07`
- **[MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo)** - [780a88f](https://github.com/LIghtJUNction/MagicMihomo/commit/780a88f6e5dce732e7140556ee01cbacb916839f) - ruleset: update-ruleset `2026-01-09 22:46`
- **[password-store](https://github.com/LIghtJUNction/password-store)** - [98f3934](https://github.com/LIghtJUNction/password-store/commit/98f39342f68144064c309c5f2ebf84b10223e338) - Merge branch 'main' of https://github.com/LIghtJUNction/password-store `2026-01-09 15:56`
- **[password-store](https://github.com/LIghtJUNction/password-store)** - [43adb6d](https://github.com/LIghtJUNction/password-store/commit/43adb6d0da560887a5ffb934877e13a95dae5e79) - Add given password for eu.org to store. `2026-01-09 15:54`
- **[MagicSingBox](https://github.com/LIghtJUNction/MagicSingBox)** - [5c1b645](https://github.com/LIghtJUNction/MagicSingBox/commit/5c1b64596b741d3d83dc6fb7ca1ae93b1d8fc96d) - chore(sing-box): map mihomo nameserver-policy to dns.rules (best-effort) `2026-01-09 15:09`
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
 
