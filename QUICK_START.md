# 🚀 快速开始指南

## 新功能一览

### 1. 📊 增强的每周报告

自动生成详细的开发统计报告：

```
📝 提交统计
  - 14 次提交，3 个仓库
  - 日均 2.0 次提交
  - 代码变更: +856/-234 行

🔥 最活跃仓库
  1. AstrBotCanary: 8 次提交 (57.1%)

📅 活跃时间
  - 最活跃: Wednesday
  - 时段: 晚上 (18:00-24:00)

💻 编程语言分布
  - ██████████ Python: 5 个 (55.6%)
  - ████░░░░░░ Shell: 2 个 (22.2%)

🌟 仓库概况
  - Stars: ⭐ 43 | Forks: 🍴 6
  - 最受欢迎: BFM_config- (⭐ 36)
  - 代码量: 15.6 MB

📈 活跃度分析
  - 活跃度得分: 249
  - ✨ 稳定开发周
```

### 2. 🎨 代码展示功能

在 Issue 中展示和运行代码：

**步骤：**
1. 创建 Issue
2. 添加标签 `code-showcase`
3. 写入代码块：
   ```python
   print("Hello, World!")
   ```
4. 自动执行并展示结果

**安全特性：**
- ✅ 环境变量清空
- ✅ 危险代码检测
- ✅ 5分钟超时

### 3. 🤖 AI 问答助手

向 GitHub Copilot 提问：

**步骤：**
1. 创建 Issue
2. 添加标签 `qa`
3. 写下问题
4. AI 自动生成专业回答

**示例问题：**
- "Python 如何处理大文件？"
- "Git 如何撤销提交？"
- "什么是 Docker？"

**回答包含：**
- 📝 简洁答案
- 💻 代码示例
- 📚 详细解释

### 4. 🛠️ 有趣的工具推荐

精选开发工具：

**开发工具**
- HTTPie - 现代 HTTP 客户端
- jq - JSON 处理器
- fzf - 模糊查找工具

**Python 工具**
- Rich - 终端美化
- Typer - CLI 构建
- httpx - 异步 HTTP

**网络工具**
- Clash Verge - 代理工具
- v2rayA - V2Ray 客户端

## 使用场景

### 场景 1：展示算法实现

创建 `code-showcase` issue：
```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))
```

### 场景 2：技术问答

创建 `qa` issue：
```
标题：JavaScript 的 async/await 最佳实践？

正文：
在什么情况下应该使用 async/await 而不是 Promise.then()？
有哪些常见的错误处理方式？
```

AI 会给出专业回答和代码示例。

### 场景 3：查看统计

每周日自动更新，展示：
- 本周提交趋势
- 代码变更量
- 活跃时间分布
- 语言使用情况

## 工作流触发

| 功能 | 触发方式 | 标签 |
|------|---------|------|
| 每周报告 | 每周日 00:00 UTC | - |
| 代码展示 | Issue 标签 | `code-showcase` |
| AI 问答 | Issue 标签 | `qa` |

所有工作流都支持手动触发！

## 文档链接

- 📘 [代码展示指南](CODE_SHOWCASE_GUIDE.md)
- 📗 [AI 问答指南](QA_GUIDE.md)
- 📊 [功能测试总结](FEATURE_TEST_SUMMARY.md)
- 📋 [主 README](README.md)

## 技术栈

- **Python 3.12** - 主要语言
- **uv** - 依赖管理
- **GitHub Actions** - CI/CD
- **GitHub Copilot** - AI 模型
- **Pillow** - 图像生成

## 注意事项

⚠️ **代码展示安全限制：**
- 不支持网络请求
- 不支持文件操作
- 不支持环境变量访问
- Shell 代码禁用

✅ **AI 问答提示：**
- 问题要具体清晰
- 一次问一个问题
- 适合技术类问题
- 回答是公开的

## 常见问题

**Q: 代码展示支持哪些语言？**
A: Python 和 JavaScript，其他语言仅显示不执行

**Q: AI 回答准确吗？**
A: 使用 GPT-4o-mini，适合大多数技术问题，但可能不包含最新信息

**Q: 如何手动触发工作流？**
A: 访问 Actions 页面，选择工作流，点击 "Run workflow"

**Q: 为什么我的代码被阻止执行？**
A: 代码包含危险操作（如网络请求、文件访问等）

## 开始使用

1. ⭐ Star 本仓库
2. 📖 阅读文档
3. 🎯 创建第一个 Issue
4. 🚀 享受自动化！

---

**贡献者:** LIghtJUNction & GitHub Copilot  
**最后更新:** 2025-11-03
