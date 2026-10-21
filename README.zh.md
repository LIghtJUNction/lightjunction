<p align="center">
  <a href="https://lightjunction.github.io/lightjunction/"><img src="public/readme-hero.svg" alt="LIghtJUNction — 简洁、优美、开源、自由、加密" width="100%" /></a>
</p>

[English](README.md) · 中文 · [Русский](README.ru.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

# LIghtJUNction

**简洁 · 优美 · 开源 · 自由 · 加密。**

[api.lmm.best](https://api.lmm.best/) 联合创始人。做一些 AI、Linux 和网络相关的小工具。
这里也是我的数字助手的工作空间；账号和资产由我持有。

## 代码

- [HumanGrant](https://github.com/LIghtJUNction/humangrant) — 让 AI Agent 获得人的授权。
- [LMM Scripts](https://github.com/TokenNotIncluded/lmm-scripts) — 安装和更新 AI 工具。
- [MagicNet](https://github.com/LIghtJUNction/MagicNet) — Android root 设备的网络工具。
- [AUL](https://github.com/LIghtJUNction/AUL) — 一项关于上游反馈的许可证实验。

[全部项目](https://github.com/LIghtJUNction?tab=repositories) · [平台源码](https://github.com/TokenNotIncluded/api.lmm.best) · [脚本命令](ONLINE-SCRIPTS.md) · [参与贡献](CONTRIBUTING.md)

## 加密联系

[age 公开接收密钥](public/age-recipients.txt) · [OpenPGP 公钥](pubkey.asc)

```text
age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n
```

安装 [age](https://github.com/FiloSottile/age) 和 [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey)，下载接收密钥文件，在本地加密：

```sh
age -R age-recipients.txt -o message.txt.age message.txt
```

将 `message.txt.age` 发到 **lightjunction.me@gmail.com**。只有收件人解密时需要 YubiKey。
请不要发送私钥、密码或恢复码。

## 其他

[网站](https://lightjunction.github.io/lightjunction/) · [动态](https://msg.lmm.best/@lightjunction) · [开源悬赏](https://api.lmm.best/) · [支持](https://donate.lmm.best/?project=lightjunction)

[挑战 I — 已领取](https://msg.lmm.best/main/184) · [挑战 II — 非对称信号](https://msg.lmm.best/main/185)

## 许可

原创内容采用 [AUL 1.0-draft.1](LICENSE)，这是未经 OSI 批准的自定义草案。此前的 MIT 授权和第三方许可继续有效，详见 [LICENSING.md](LICENSING.md)。
