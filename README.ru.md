<p align="center">
  <a href="https://lightjunction.github.io/lightjunction/"><img src="public/readme-hero.svg" alt="LIghtJUNction — простота, красота, открытость, свобода, шифрование" width="100%" /></a>
</p>

[English](README.md) · [中文](README.zh.md) · Русский · [한국어](README.ko.md) · [日本語](README.ja.md)

# LIghtJUNction

**Простота · Красота · Открытость · Свобода · Шифрование.**

Сооснователь [api.lmm.best](https://api.lmm.best/). Небольшие инструменты для ИИ, Linux и сетей.
Здесь работает и мой цифровой помощник; аккаунты и активы принадлежат мне.

## Код

- [HumanGrant](https://github.com/LIghtJUNction/humangrant) — разрешения человека для ИИ-агентов.
- [LMM Scripts](https://github.com/TokenNotIncluded/lmm-scripts) — установка и обновление ИИ-инструментов.
- [MagicNet](https://github.com/LIghtJUNction/MagicNet) — сетевые инструменты для Android с root.
- [AUL](https://github.com/LIghtJUNction/AUL) — экспериментальная лицензия с обратной связью upstream.

[Все проекты](https://github.com/LIghtJUNction?tab=repositories) · [Код платформы](https://github.com/TokenNotIncluded/api.lmm.best) · [Команды](ONLINE-SCRIPTS.md) · [Участие](CONTRIBUTING.md)

## Зашифрованная связь

[Публичный получатель age](public/age-recipients.txt) · [Публичный ключ OpenPGP](pubkey.asc)

Установите [age](https://github.com/FiloSottile/age) и [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey), скачайте файл получателя и зашифруйте сообщение локально:

```sh
age -R age-recipients.txt -o message.txt.age message.txt
```

Отправьте `message.txt.age` на **lightjunction.me@gmail.com**. YubiKey нужен только получателю для расшифровки.
Не отправляйте приватные ключи, пароли или коды восстановления.

## Ссылки

[Сайт](https://lightjunction.github.io/lightjunction/) · [Заметки](https://msg.lmm.best/@lightjunction) · [Награды за открытые проекты](https://api.lmm.best/) · [Поддержать](https://donate.lmm.best/?project=lightjunction)

[Испытание I — завершено](https://msg.lmm.best/main/184) · [Испытание II — асимметричный сигнал](https://msg.lmm.best/main/185)

## Лицензия

Оригинальные материалы используют [AUL 1.0-draft.1](LICENSE), нестандартный проект лицензии без одобрения OSI. Прежние разрешения MIT и условия третьих сторон остаются в силе; см. [LICENSING.md](LICENSING.md).
