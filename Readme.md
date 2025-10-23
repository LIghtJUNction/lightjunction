### Hi there 👋   

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LightJunction Code Snippet</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        pre { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 5px; overflow-x: auto; }
        button { margin-top: 10px; padding: 10px 20px; background: #4a5568; color: white; border: none; border-radius: 5px; cursor: pointer; }
        button:hover { background: #2d3748; }
        #output { margin-top: 20px; padding: 10px; background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 5px; white-space: pre-wrap; }
        #clock { margin-top: 20px; font-size: 18px; font-weight: bold; }
    </style>
</head>
<body>
    <h2>LightJunction Code Snippet</h2>
    <div id="clock">当前时间: </div>
    <pre><code class="language-python">
class LightJunction(Human):
    name: str = "lightjunction"
    
    @property
    def age(self):
        from datetime import datetime
        birth_date = datetime(2005, 10, 14)
        current_date = datetime.now()
        age = current_date.year - birth_date.year - ((current_date.month, current_date.day) < (birth_date.month, birth_date.day))
        return age
    </code></pre>
    
    <button id="runBtn">点击运行代码并显示结果</button>
    <div id="output"></div>

    <script>
        let pyodide;
        async function initPyodide() {
            pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            await pyodide.runPython(`
class Human:
    pass

class LightJunction(Human):
    name: str = "lightjunction"
    
    @property
    def age(self):
        from datetime import datetime
        birth_date = datetime(2005, 10, 14)
        current_date = datetime.now()
        age = current_date.year - birth_date.year - ((current_date.month, current_date.day) < (birth_date.month, birth_date.day))
        return age
            `);
        }

        document.getElementById('runBtn').addEventListener('click', async () => {
            if (!pyodide) await initPyodide();
            try {
                const result1 = pyodide.runPython('LightJunction.name');
                const result2 = pyodide.runPython('obj = LightJunction(); obj.age');
                document.getElementById('output').textContent = 
                    `name: ${result1}\nage: ${result2}`;
            } catch (error) {
                document.getElementById('output').textContent = `错误: ${error.message}`;
            }
        });

        function updateClock() {
            const now = new Date();
            const timeString = now.toLocaleString('zh-CN', { timeZone: 'UTC' });
            document.getElementById('clock').textContent = `当前时间 (UTC): ${timeString}`;
        }

        updateClock();
        setInterval(updateClock, 1000);
    </script>
</body>
</html>


<a href="https://steamcommunity.com/id/LIghtJUNction/">
  <img height=200 src="https://github-readme-stats.vercel.app/api?username=lightjunction&show_icons=true&theme=tokyonight" />
</a>
<a href="https://steamcommunity.com/id/LIghtJUNction/">
  <img height=180 src="https://github-readme-stats.vercel.app/api/top-langs?username=lightjunction&layout=compact&langs_count=8&show_icons=true&theme=tokyonight" />
</a>

---


---

### ✨ 最新项目 (Latest Projects)
<!-- START_DYNAMIC_TITLE_IMAGE -->

![最新项目](generated_images/latest_projects_title.png)

<!-- END_DYNAMIC_TITLE_IMAGE -->

<!-- START_DYNAMIC_SUMMARY -->

### 📊 本周活动摘要 (Weekly Activity Summary)

- 📝 本周共有 **9** 次提交分布在 **4** 个仓库中
- 🔥 最活跃的仓库:
  - **AstrBotCanary**: 5 次提交
  - **PromptAssembler**: 2 次提交
  - **WechatPublicAPI**: 1 次提交

- 🔄 最近更新的仓库: **AstrBotCanary**

- 📋 [查看上周报告 (View Last Week's Report)](archives/weekly_reports/weekly_report_20251005_211314_076998.md)

<!-- END_DYNAMIC_SUMMARY -->

---

<!-- START_DYNAMIC_REPO_LIST -->

- **[AstrBotCanary](https://github.com/LIghtJUNction/AstrBotCanary)** - This is an officially supported Astrbot
  - 📊 `⭐ 1 | 🍴 0 | 💻 Python | 🕒 2025-10-18`
- **[BFM_config-](https://github.com/LIghtJUNction/BFM_config-)** - config for clash meta (mihomo ) | clash verge (pc and android) |box for magsik|kernelsu|apatch (need root)(透明proxy)   | DNS 泄露已解决 | 点击下方链接跳转至自定义rule仓库
  - 📊 `⭐ 36 | 🍴 5 | 💻 Shell | 🕒 2025-10-18`
- **[Robyn](https://github.com/LIghtJUNction/Robyn)** - Robyn is a Super Fast Async Python Web Framework with a Rust runtime.
  - 📊 `⭐ 0 | 🍴 0 | 💻 None | 🕒 2025-10-14`
- **[taskiq](https://github.com/LIghtJUNction/taskiq)** - Distributed task queue with full async support
  - 📊 `⭐ 0 | 🍴 0 | 💻 None | 🕒 2025-10-14`
- **[WechatPublicAPI](https://github.com/LIghtJUNction/WechatPublicAPI)** - fuckUhacker
  - 📊 `⭐ 125 | 🍴 8 | 💻 Python | 🕒 2025-10-13`

<!-- END_DYNAMIC_REPO_LIST -->

---

<details>
  <summary>📝 近期提交 (Recent Commits - 最近7天)</summary>

<!-- START_DYNAMIC_COMMITS -->

- **[AstrBotCanary](https://github.com/LIghtJUNction/AstrBotCanary)** - [ee6183e](https://github.com/LIghtJUNction/AstrBotCanary/commit/ee6183e589a7f2c4117a4f7d39dedafaefbdbd56) - 基础工作 `2025-10-18 23:09`
- **[AstrBotCanary](https://github.com/LIghtJUNction/AstrBotCanary)** - [fce6048](https://github.com/LIghtJUNction/AstrBotCanary/commit/fce604800a821b36fa0317e42db0e7d3a24b042b) - 开发消息调度系统 `2025-10-18 22:35`
- **[AstrBotCanary](https://github.com/LIghtJUNction/AstrBotCanary)** - [b14b196](https://github.com/LIghtJUNction/AstrBotCanary/commit/b14b196c5b643e6602c2339c4022f1ee726eb139) - 任务系统！ `2025-10-18 20:01`
- **[AstrBotCanary](https://github.com/LIghtJUNction/AstrBotCanary)** - [933573c](https://github.com/LIghtJUNction/AstrBotCanary/commit/933573c929021785f949ab6c4ae3c9cd13f36447) - 控制台支持 `2025-10-18 17:46`
- **[AstrBotCanary](https://github.com/LIghtJUNction/AstrBotCanary)** - [31fa4a2](https://github.com/LIghtJUNction/AstrBotCanary/commit/31fa4a232d0936240c93a828f452bb0eb0cceb7a) - Update README.md `2025-10-18 14:02`
- **[WechatPublicAPI](https://github.com/LIghtJUNction/WechatPublicAPI)** - [25daa3b](https://github.com/LIghtJUNction/WechatPublicAPI/commit/25daa3bf39044411a8307c905de55cc4b8ad9f70) - 更新 README.md `2025-10-13 20:17`
- **[PromptAssembler](https://github.com/LIghtJUNction/PromptAssembler)** - [01fe26b](https://github.com/LIghtJUNction/PromptAssembler/commit/01fe26bb15d03f58f6dc271e3f8337ce9a70d99e) - 更新 README.md `2025-10-13 20:14`
- **[PromptAssembler](https://github.com/LIghtJUNction/PromptAssembler)** - [743cd08](https://github.com/LIghtJUNction/PromptAssembler/commit/743cd08f9c5280f7e315aca3b8b8b0154a678285) - 更新 README.md `2025-10-13 20:12`
- **[PeakMods](https://github.com/LIghtJUNction/PeakMods)** - [c6553f6](https://github.com/LIghtJUNction/PeakMods/commit/c6553f68133a4ee32f6ad976c337cf6ff0bfddb0) - 更新 README.md `2025-10-13 19:58`

<!-- END_DYNAMIC_COMMITS -->

</details>

---

<details>
  <summary>💬 其他信息 (More Info)</summary>

  - 🎮 问我关于游戏的事情 (Ask me about games) - [My Steam Profile](https://steamcommunity.com/id/LIghtJUNction/)
  - 📫 如何联系我 (How to reach me): lightjunction.me@gmail.com
  - ⚡ 有趣的事实 (Fun fact): ## O(∩_∩)O

</details>

---

- 💰 [赞助 (Sponsor Me)](https://github.com/LIghtJUNction/lightjunction/tree/master/sponsor)
