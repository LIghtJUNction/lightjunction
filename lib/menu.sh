#!/usr/bin/env bash
# Shared software catalog and numbered setup menu. Execute with Bash.

if [[ -n "${LIGHTJUNCTION_SHELL_BASE_URL:-}" && ${__PRELOAD_SH_VERSION:-} != 2 ]]; then
    if [[ -n "${ZSH_VERSION:-}" ]]; then
        # zsh does not expose a waitable PID for process substitution.
        __preload_body="$(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh")" || return
        # shellcheck source=/dev/null
        . <(printf '%s\n' "$__preload_body") || return
        unset __preload_body
    else
        # shellcheck source=/dev/null
        . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh") || return
        wait "$!" || return
    fi
    [[ ${__PRELOAD_SH_LOADED:-} == 1 ]] || return 1
fi

[[ ${__menu_sh_loaded:-} == 1 ]] && return 0
__menu_sh_loaded=1
MENU_ITEMS=()
MENU_SELECTED=()
MENU_CATEGORIES=(ai base mirrors proxy shell dev apps)
MENU_TITLES=('AI 工具' '基础系统软件' '软件包换源工具' '代理与网络工具' 'Shell 与终端' '开发环境' '桌面与多媒体')

menu_catalog() {
    local data category id label method target platforms
    data="$(fetch lib/software.tsv)" || return
    MENU_ITEMS=()
    while IFS='|' read -r category id label method target platforms; do
        [[ -n "$category" && "$category" != \#* ]] || continue
        if [[ "$platforms" == '*' || ",$platforms," == *",$MENU_PLATFORM,"* ]]; then
            MENU_ITEMS+=("$category|$id|$label|$method|$target")
        fi
    done <<<"$data"
}
menu_has() {
    local id
    for id in ${MENU_SELECTED[@]+"${MENU_SELECTED[@]}"}; do [[ "$id" != "$1" ]] || return 0; done
    return 1
}
menu_toggle() {
    local id entry kept=()
    if menu_has "$1"; then
        for id in "${MENU_SELECTED[@]}"; do [[ "$id" == "$1" ]] || kept+=("$id"); done
        MENU_SELECTED=("${kept[@]}")
    else
        for entry in "${MENU_ITEMS[@]}"; do
            IFS='|' read -r _ id _ _ _ <<<"$entry"
            if [[ "$id" == "$1" ]]; then MENU_SELECTED+=("$id"); return 0; fi
        done
        return 2
    fi
}
menu_read() { IFS= read -r MENU_REPLY </dev/tty; }
menu_title() {
    local index
    for ((index=0; index<${#MENU_CATEGORIES[@]}; index++)); do
        if [[ "${MENU_CATEGORIES[index]}" == "$1" ]]; then
            printf '%s\n' "${MENU_TITLES[index]}"
            return
        fi
    done
    printf '%s\n' "$1"
}
menu_list() {
    local filter="${1:-}" category id label method target entry previous='' mark
    for entry in "${MENU_ITEMS[@]}"; do
        IFS='|' read -r category id label method target <<<"$entry"
        [[ -z "$filter" || "$filter" == "$category" ]] || continue
        if [[ "$category" != "$previous" ]]; then printf '\n%s\n' "$(menu_title "$category")"; previous="$category"; fi
        mark=' '
        if menu_has "$id"; then mark=x; fi
        printf '  [%s] %-14s %s\n' "$mark" "$id" "$label"
    done
}
menu_category() {
    local filter="$1" entry category id label method target token number mark
    local ids=() tokens=()
    while true; do
        ids=()
        printf '\n%s\n' '输入编号切换勾选，可用空格多选；a 全选本类，0 返回。'
        for entry in "${MENU_ITEMS[@]}"; do
            IFS='|' read -r category id label method target <<<"$entry"
            [[ "$category" == "$filter" ]] || continue
            ids+=("$id")
            mark=' '
            if menu_has "$id"; then mark=x; fi
            printf '  %2s [%s] %s\n' "${#ids[@]}" "$mark" "$label"
        done
        printf '> '
        menu_read || return 0
        case "$MENU_REPLY" in
            0|q) return 0 ;;
            a) for id in "${ids[@]}"; do menu_has "$id" || menu_toggle "$id"; done ;;
            *)
                read -r -a tokens <<<"${MENU_REPLY//,/ }"
                for token in ${tokens[@]+"${tokens[@]}"}; do
                    if [[ "$token" =~ ^[1-9][0-9]?$ ]] && ((10#$token <= ${#ids[@]})); then
                        number=$((10#$token - 1))
                        menu_toggle "${ids[number]}"
                    else
                        printf '无效编号：%s\n' "$token"
                    fi
                done ;;
        esac
    done
}
menu_package() {
    local package="$1"
    case "$MENU_PLATFORM:$package" in
        deb:openssh) package=openssh-client ;;
        deb:gnupg) package=gnupg ;;
        deb:fd) package=fd-find ;;
        deb:proxychains-ng) package=proxychains4 ;;
        deb:python) package=python3 ;;
        deb:go) package=golang-go ;;
        deb:rust) package=rustc ;;
        dnf:fd|yum:fd) package=fd-find ;;
        dnf:go|yum:go|zypper:go) package=golang ;;
        zypper:openssh) package=openssh-clients ;;
        apk:rust) package=rust ;;
        apk:python) package=python3 ;;
        dnf:pkgconf|yum:pkgconf) package=pkgconf-pkg-config ;;
        xbps:fish) package=fish-shell ;;
        termux:nodejs) package=nodejs-lts ;;
        termux:rust) package=rust ;;
        brew:obs-studio) package=obs ;;
    esac
    printf '%s\n' "$package"
}
menu_native() {
    local package
    package="$(menu_package "$1")" || return
    if [[ "$MENU_PLATFORM" == brew ]]; then
        brew_install formula "$package"
    else
        install_packages "$package" || return
        case "$MENU_PLATFORM:$1" in
            deb:rust|dnf:rust|yum:rust|zypper:rust|apk:rust) install_packages cargo ;;
        esac
    fi
}
menu_node() {
    if command_exists npm && command_exists node; then return 0; fi
    if [[ "$MENU_PLATFORM" == brew ]]; then
        brew_install formula node
    elif [[ "$MENU_PLATFORM" == termux ]]; then
        menu_native nodejs
    else
        menu_native nodejs || return
        menu_native npm
    fi
}
menu_uv() {
    command_exists uv && return 0
    if [[ "$MENU_PLATFORM" == brew ]]; then
        brew_install formula uv
    else
        run_script https://astral.sh/uv/install.sh || return
        export PATH="$HOME/.local/bin:$PATH"
    fi
}
menu_install() {
    local method="$1" target="$2"
    case "$method" in
        native) menu_native "$target" ;;
        node) menu_node ;;
        npm)
            menu_node || return
            npm install --global --prefix "$HOME/.local" "$target" ;;
        script) run_script "$target" ;;
        uv-install) menu_uv ;;
        uv) menu_uv || return; uv tool install "$target" ;;
        chsrc)
            if [[ "$MENU_PLATFORM" == brew ]]; then
                brew_install formula chsrc
            else
                local body work
                body="$(curl -fsSL https://chsrc.run/posix)" || return
                work="$(make_tmp_dir)" || return
                printf '%s\n' "$body" >"$work/chsrc.sh" || return
                "${SUDO[@]}" bash "$work/chsrc.sh"
            fi ;;
        clash|vscode)
            if [[ "$MENU_PLATFORM" == brew ]]; then
                brew_install cask "$target"
            elif [[ "$EUID" == 0 ]]; then
                printf '%s\n' 'AUR 软件请使用普通用户安装。' >&2
                return 1
            elif command_exists paru; then
                if [[ "$method" == clash ]]; then target=clash-verge-rev-bin; else target=visual-studio-code-bin; fi
                paru -S --needed --noconfirm "$target"
            elif command_exists yay; then
                if [[ "$method" == clash ]]; then target=clash-verge-rev-bin; else target=visual-studio-code-bin; fi
                yay -S --needed --noconfirm "$target"
            else
                printf '需要已有的 paru 或 yay 才能安装 %s。\n' "$target" >&2
                return 1
            fi ;;
        desktop)
            if [[ "$MENU_PLATFORM" == brew ]]; then brew_install cask "$(menu_package "$target")"
            else menu_native "$target"; fi ;;
        *) printf '未知安装方式：%s\n' "$method" >&2; return 2 ;;
    esac
}
menu_plan() {
    local entry category id label method target
    printf '\n待安装 %s 项：\n' "${#MENU_SELECTED[@]}"
    for entry in "${MENU_ITEMS[@]}"; do
        IFS='|' read -r category id label method target <<<"$entry"
        menu_has "$id" || continue
        if [[ "$method" == native ]]; then target="$(menu_package "$target")"; fi
        printf '  %-14s %s [%s: %s]\n' "$id" "$label" "$method" "$target"
    done
    printf '%s\n' 'npm 工具需要 Node.js/npm，Python 工具需要 uv；缺少时会一并安装。' \
        '软件源、代理配置和默认登录 Shell 均由你安装后自行设置。'
}
menu_apply() {
    local entry category id label method target answer
    local succeeded=() failed=()
    menu_plan
    [[ ${#MENU_SELECTED[@]} -gt 0 ]] || return 0
    [[ "$MENU_DRY_RUN" != 1 ]] || return 0
    printf '开始安装？[y/N] '
    menu_read || return 0
    answer="$MENU_REPLY"
    [[ "$answer" == y || "$answer" == Y ]] || return 0
    # Package managers and model tools can write well over 100 MB.
    df -h "$HOME" "${TMPDIR:-/tmp}" || return
    if command_exists findmnt; then findmnt -T "$HOME" || return; fi
    if [[ "$MENU_PLATFORM" == brew ]]; then
        ensure_xcode_cli_tools || return
        ensure_homebrew || return
    elif [[ "$MENU_PLATFORM" != termux ]]; then
        require_sudo || return
    fi
    init_tmp_dirs || return
    for entry in "${MENU_ITEMS[@]}"; do
        IFS='|' read -r category id label method target <<<"$entry"
        menu_has "$id" || continue
        printf '\n正在安装：%s\n' "$label"
        if menu_install "$method" "$target"; then succeeded+=("$id"); else failed+=("$id"); fi
    done
    printf '\n成功 %s 项，失败 %s 项。\n' "${#succeeded[@]}" "${#failed[@]}"
    if ((${#failed[@]})); then printf '失败项目：%s\n' "${failed[*]}"; fi
    printf '%s\n' '用户级命令位于 ~/.local/bin；如有需要请将它加入 PATH。'
    [[ ${#failed[@]} == 0 ]]
}
menu_main() {
    MENU_PLATFORM="$1"
    shift
    MENU_DRY_RUN=0
    MENU_SELECTED=()
    local list_only=0 token id found index selected_ids=()
    for token do
        case "$token" in
            --list) list_only=1 ;;
            --dry-run) MENU_DRY_RUN=1 ;;
            *) printf '未知参数：%s\n' "$token" >&2; return 2 ;;
        esac
    done
    menu_catalog || return
    if [[ -n "${BOOTSTRAP_PACKAGES:-}" ]]; then
        read -r -a selected_ids <<<"${BOOTSTRAP_PACKAGES//,/ }"
        for id in "${selected_ids[@]}"; do
            menu_has "$id" || menu_toggle "$id" || { printf '不支持的软件：%s\n' "$id" >&2; return 2; }
        done
    fi
    if [[ "$list_only" == 1 ]]; then menu_list; return; fi
    if ! is_interactive; then
        if [[ "$MENU_DRY_RUN" == 1 ]]; then menu_plan
        else printf '%s\n' '请在交互式终端运行 bootstrap 打开菜单，或使用 --list / --dry-run。'; fi
        return 0
    fi
    while true; do
        printf '\n%s\n' '╭─ bootstrap · 软件自选商店 ─╮'
        printf '平台：%s  已选：%s\n' "$MENU_PLATFORM" "${#MENU_SELECTED[@]}"
        for ((index=0; index<${#MENU_CATEGORIES[@]}; index++)); do
            found=0
            for token in "${MENU_ITEMS[@]}"; do
                [[ "${token%%|*}" != "${MENU_CATEGORIES[index]}" ]] || found=1
            done
            if [[ "$found" == 1 ]]; then printf '  %s  %s\n' "$((index + 1))" "${MENU_TITLES[index]}"; fi
        done
        printf '%s\n' '  p  查看已选    x  清空' '  i  查看清单并安装    q  退出'
        printf '> '
        menu_read || return 0
        case "$MENU_REPLY" in
            [1-7]) menu_category "${MENU_CATEGORIES[MENU_REPLY-1]}" ;;
            p) menu_plan ;;
            x) MENU_SELECTED=() ;;
            i) menu_apply; return ;;
            q|0) return 0 ;;
            *) printf '%s\n' '请输入菜单编号或 p/x/i/q。' ;;
        esac
    done
}

if [[ ${__PRELOAD_SH_LOADED:-} == 1 ]]; then
    _preload_register menu \
        menu_catalog menu_has menu_toggle menu_read menu_title menu_list menu_category \
        menu_package menu_native menu_node menu_uv menu_install menu_plan menu_apply menu_main
fi
