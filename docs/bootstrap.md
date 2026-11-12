# bootstrap 软件菜单

加载任意在线库后运行 `bootstrap`，进入中文软件自选菜单：

```bash
export LIGHTJUNCTION_SHELL_BASE_URL=https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main
. <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh")
bootstrap
```

## 分类

清单共 57 项，按系统筛选显示；不同发行版的软件源和软件版本会影响实际可用性。

| 分类 | 示例 |
| --- | --- |
| AI 工具 | Codex、Claude Code、Gemini CLI、LLM、Ollama |
| 基础系统软件 | Git、curl、wget、jq、OpenSSH、GnuPG、rsync、btop |
| 软件包换源工具 | chsrc、Reflector、nrm、termux-change-repo |
| 代理与网络工具 | Mihomo、sing-box、Clash Verge Rev、ProxyChains、Tor、WireGuard |
| Shell 与终端 | Zsh、Fish、Starship、tmux、fzf、zoxide、ripgrep、fd、bat |
| 开发环境 | Node.js/npm、Python、uv、Rust、Go、CMake、Make、ShellCheck |
| 桌面与多媒体 | Neovim、Vim、Ghostty、mpv、FFmpeg、OBS、VS Code |

## 操作

- 主菜单输入分类编号进入软件列表。
- 软件列表输入编号切换勾选；`1 3 5` 或 `1,3,5` 可以同时切换多项。
- `a` 全选当前分类，`0` 返回；跨分类保留已选软件。
- 主菜单 `p` 查看待安装清单，`x` 清空，`q` 或 `0` 退出。
- 主菜单 `i` 显示清单，再输入 `y` 开始安装；其他回答取消。
- 单项安装失败后继续其他项目，最后列出失败项目并返回非零退出码。

```bash
bootstrap --list       # 只列出适用于当前平台的软件
bootstrap --dry-run    # 正常勾选，最终只预览，不安装
bootstrap linux       # Linux / Termux
bootstrap macbook     # macOS
```

可以预选软件，并在无交互环境中生成清单：

```bash
BOOTSTRAP_PACKAGES=git,jq,codex bootstrap --dry-run
```

软件 ID 可从 `bootstrap --list` 查看。未知 ID 会报错，不会开始安装。
非交互环境默认不安装软件；不提供绕过菜单确认的自动全装模式。

## 安装行为

软件目录是 [`lib/software.tsv`](../lib/software.tsv)，菜单与安装分派位于
[`lib/menu.sh`](../lib/menu.sh)。新增软件应填写分类、ID、名称、安装方式、
包名或官方安装地址，以及支持的平台。

Linux 使用当前发行版包管理器，macOS 使用 Homebrew，Termux 使用 `pkg`。
Arch 的 Clash Verge Rev / VS Code 使用已有的 paru 或 yay；脚本不会自动添加
AUR 助手或第三方软件源，也不会用 root 执行 AUR 安装。

npm 工具自动准备 Node.js/npm，并安装到 `~/.local`；Python CLI 使用 uv 的
独立工具环境，缺少 uv 时安装官方版本。请确保 `~/.local/bin` 在 PATH 中。

[Claude Code](https://code.claude.com/docs/en/setup) 使用官方原生安装脚本；
[LLM](https://llm.datasette.io/en/stable/setup.html) 使用 `uv tool install llm`；
[chsrc](https://chsrc.run/) 使用官方安装器或 Homebrew。

换源工具只安装，不自动修改镜像源；代理软件安装后由用户自行配置。
macOS 不再自动安装固定全家桶、切换登录 Shell 或改写 Ghostty 配置。
软件包自身的安装脚本仍可能执行其默认系统配置。

开始安装前会显示 HOME 和临时目录的可用空间、可获取的 HOME 挂载信息。
安装器的临时文件由现有 bootstrap 清理机制回收。脚本不会卸载原有软件。

旧的 Linux 模块入口仍保留：

```bash
export BOOTSTRAP_FEATURES=shell,fs-bees,cn-desktop
bootstrap linux
```

这会运行旧模块，而非软件菜单；`unset BOOTSTRAP_FEATURES` 恢复菜单。
`fs-bees` 仅安装工具，不自动启用去重服务。
