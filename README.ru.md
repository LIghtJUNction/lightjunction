<div align="center">
  <a href="https://gravatar.com/totallytriumph1a8c29e246" target="_blank">
    <img src="https://1.gravatar.com/avatar/1c12c2b9decdd50a37e024c03c80845876d06839aadda34c578a6183fd83c927?s=160&d=identicon" alt="LIghtJUNction" width="128" height="128">
  </a>

# LIghtJUNction

**AI-инструменты / автоматизация Linux / сетевая инфраструктура / практическая безопасность**

Я создаю небольшие, практичные инструменты для сложных реальных систем: agents, bootstrap-скрипты, data pipelines, игровые инструменты и terminal-first workflows.

Сейчас я работаю вокруг agent tooling, proxy-aware bootstrap scripts и практической автоматизации Linux/macOS.

[Website Terminal](https://lightjunction.github.io/lightjunction/) · [Encrypted Message](https://lightjunction.github.io/lightjunction/) · [GitHub](https://github.com/LIghtJUNction) · [Hugging Face](https://huggingface.co/LIghtJUNction) · [Kaggle](https://www.kaggle.com/lightjunction) · [Email](mailto:lightjunction.me@gmail.com)

</div>

**Языки:** [English](README.md) (полная версия, динамически обновляется) · [中文](README.zh.md) · Русский (статическая версия) · [한국어](README.ko.md) · [日本語](README.ja.md)

## Agent Skills

Установить мои личные agent skills глобально:

```bash
npx skills add LIghtJUNction/lightjunction -g
```

Skills находятся в `.agents/skills/` и сохраняют мои переиспользуемые workflows, предпочтения и проектные операционные знания.

## Профиль

У меня не CS-бэкграунд, но я учусь через поставку работающих вещей. Мои проекты обычно начинаются с личной боли: настроить свежую машину в сложной сети, упростить эксплуатацию agents, автоматизировать сбор данных или превратить грубый скрипт в инструмент, который может запустить другой человек.

<details>
<summary>Ранние технические интересы</summary>

Меня всегда притягивали операционные системы, особенно Linux. Раньше я был буквально увлечен прошивками и заменой систем на телефонах и компьютерах; однажды я даже установил ARM-сборку Windows на старый Android-телефон.

Почти все школьные годы у меня не было доступа к инструментам искусственного интеллекта такого уровня, как сегодня. Примерно в выпускном классе я впервые попробовал ChatGPT 3.5 и сразу решил, что искусственный интеллект в будущем фундаментально изменит общество.

</details>

| Снимок | |
|:--|:--|
| Образование | Zhengzhou University |
| Ищу | Remote или hybrid engineering opportunities |
| Сильнейший сигнал | Debugging real systems, not just demos |
| Open-source focus | AstrBot ecosystem, agent tooling, Linux automation |
| Любимая игра | Oxygen Not Included |

Мне интересна работа, где полезны ownership, быстрая итерация, уверенность в Linux и готовность отлаживать реальный путь, а не только happy path.

Мое правило: если инструмент работает только на моей машине, он еще не готов. Хорошая автоматизация объясняет, какую машину видит, делает консервативные выборы и падает явно до того, как может что-то повредить.

| Что мне нравится строить | Доказательства |
|:--|:--|
| AI и agent tooling | Работа в AstrBot ecosystem, MCP tools, automation surfaces, terminal workflows |
| Linux и bootstrap automation | macOS/Linux setup scripts, package-manager detection, proxy-aware installs |
| Network tools | daed/mihomo/Hiddify setup, transparent proxy workflows, fallbacks for difficult networks |
| Data and platform tooling | Python CLIs, API wrappers, collection pipelines, repeatable scripts |
| Security-minded utilities | OpenPGP contact flow, SSH key deployment, explicit permission boundaries |
| Simulation games | Oxygen Not Included, especially systems that reward automation and debugging |

## Стиль работы

| Сигнал | Что это значит на практике |
|:--|:--|
| Сначала воспроизвести | Я ищу реальную failing command, package, network или runtime path. |
| Явные системы | Скрипты печатают диагностику, перечисляют предположения и спрашивают перед рискованными действиями. |
| Поставлять usable surfaces | CLI, README commands, defaults и error messages являются частью продукта. |
| Учиться публично | Репозиторий является workshop: грубые идеи постепенно становятся документированными инструментами. |

## Избранные работы

| Проект | Почему это важно |
|:--|:--|
| [AstrBot](https://github.com/AstrBotDevs/AstrBot) ecosystem | Contributions and packaging/plugin work around real bot framework runtime behavior. |
| [lightjunction](https://github.com/LIghtJUNction/lightjunction) | Personal terminal site, bootstrap scripts, encrypted contact flow, reusable shell helpers. |
| [OniMods](https://github.com/LIghtJUNction/OniMods) | Oxygen Not Included tooling and MCP-style automation experiments for a complex simulation game. |
| [humen-mcp](https://github.com/LIghtJUNction/humen-mcp) | Rust MCP tool for human-in-the-loop interaction, with persistence and agent setup for real workflows. |
| [emailctl](https://github.com/LIghtJUNction/emailctl) | Published Rust crate for terminal email workflows; the package is `emailctl` and the CLI binary remains `email`. |
| [douyin](https://github.com/LIghtJUNction/douyin) | Python package and CLI work around Douyin APIs, auth flows and automation-heavy workflows. |
| [MagicMihomo](https://github.com/LIghtJUNction/MagicMihomo) | Network configuration automation where reliability matters more than cleverness. |

## Инструменты

`Python` · `Rust` · `TypeScript` · `Shell/Bash` · `Linux` · `macOS` · `GitHub Actions` · `OpenPGP` · `MCP` · `Network Debugging` · `CLI Design`

## Bootstrap Lab

Эти скрипты намеренно практичны: сначала печатают диагностику, затем ветвятся по обнаруженной машине и сети, а если автоматизация была бы нечестной, явно завершаются с подсказкой.

### Linux workstation bootstrap

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh | bash
```

Optional non-interactive example:

```bash
BOOTSTRAP_FEATURES=network-daed,fs-bees,shell,cn-desktop bash -c "$(curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh)"
```

Скрипт может устанавливать daed для transparent proxy workflows, настраивать CachyOS repositories на Arch-based systems, использовать `.deb` на Debian/Ubuntu, `.rpm` на Fedora/RHEL/openSUSE, и включать optional modules для shell, filesystem и desktop tooling.

### macOS bootstrap

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-macbook.sh | bash
```

Запускайте от обычного Administrator user, не через `sudo`. Homebrew refuses root. На новом Mac скрипт сначала открывает installer для Xcode Command Line Tools, потому что Homebrew нужен Apple's `git`.

### SSH public key deployment

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash
```

Поддерживает Termux и systemd Linux.

## Shell Modules

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/basic.sh | bash
```

## Безопасный контакт

Используйте [website terminal](https://lightjunction.github.io/lightjunction/) для шифрования сообщения в браузере или импортируйте мой публичный ключ вручную:

```bash
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys EB21B83AB1E982DF66F08387A67178405F7736FD
```

Fingerprint:

```text
EB21B83AB1E982DF66F08387A67178405F7736FD
```

## Поддержка

Если мои проекты полезны, sponsorship welcome: [sponsor and support](https://github.com/LIghtJUNction/lightjunction/tree/master/sponsor). Через website terminal можно отправить заметку о спонсорстве, платежную справку, публичное сообщение или контакты. Не отправляйте приватные ключи, seed-фразы, пароли, access tokens или другие учетные данные.

> Это статическая переводная версия. Английский [README.md](README.md) является полной версией и содержит автоматически обновляемую динамическую информацию.
