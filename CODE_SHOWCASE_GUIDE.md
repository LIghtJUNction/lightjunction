# 🎨 代码展示使用指南 (Code Showcase Guide)

## 简介

代码展示功能允许你通过 GitHub Issue 提交代码片段，自动执行并在 README 中展示结果。

## 使用方法

### 1. 创建 Issue

访问 [Issues 页面](../../issues/new) 创建新 issue。

### 2. 添加标签

为 issue 添加 `code-showcase` 标签。这个标签会触发自动化工作流。

### 3. 编写代码

在 issue 正文中使用代码块格式：

\`\`\`python
# Python 示例
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print("斐波那契数列前10项:")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
\`\`\`

\`\`\`javascript
// JavaScript 示例
const greeting = "Hello from JavaScript!";
console.log(greeting);
console.log("Current date:", new Date().toISOString());
\`\`\`

\`\`\`bash
# Bash 示例
echo "System information:"
echo "Current directory: $(pwd)"
echo "Date: $(date)"
\`\`\`

### 4. 提交 Issue

提交后，GitHub Actions 工作流会自动：
1. 读取 issue 内容
2. 提取代码块
3. 执行代码（如果支持）
4. 更新 README 显示代码和执行结果
5. 在 issue 中添加评论确认更新

## 支持的语言

- ✅ **Python** - 完整支持，自动执行
- ✅ **JavaScript/Node.js** - 完整支持，自动执行
- ✅ **Bash/Shell** - 完整支持，自动执行
- 📝 **其他语言** - 仅显示代码，不执行

## 安全限制

为了安全起见，我们实施了严格的安全措施：

### 执行限制
- ⏱️ **代码执行有 5 分钟超时限制**
- 🔒 **所有环境变量被清空**（无法访问 GITHUB_TOKEN 等敏感信息）
- 📁 **在隔离的临时目录中运行**
- 🚫 **Shell/Bash 代码执行已禁用**（安全风险太高）

### 代码检查
代码在执行前会被扫描，以下操作将被阻止：
- 访问环境变量 (`os.environ`, `ENV`, `TOKEN`, `SECRET`)
- 网络请求 (`requests`, `urllib`, `http`, `socket`)
- 文件操作 (`open()`, `file()`)
- 危险函数 (`eval()`, `exec()`, `compile()`, `__import__`)

### 建议用途
✅ **适合**: 展示算法、数据处理、数学计算、简单演示
❌ **不适合**: 需要网络、文件IO、系统调用的代码

## 示例 Issue

### 标题
```
展示 Python 排序算法
```

### 正文
\`\`\`
演示快速排序算法的实现：

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

# 测试
test_array = [3, 6, 8, 10, 1, 2, 1]
print("原数组:", test_array)
print("排序后:", quicksort(test_array))
\`\`\`
\`\`\`

### 标签
- `code-showcase`

## 手动触发

如果需要重新处理某个 issue，可以在 [Actions 页面](../../actions/workflows/code_showcase.yml) 手动触发工作流，并输入 issue 编号。

## 注意事项

1. 每次更新 issue 会覆盖 README 中的代码展示区域
2. 如果想展示多个代码片段，建议在一个 issue 中包含多个代码块
3. 代码执行失败时会显示错误信息
4. README 更新后，旧的展示内容会被替换

## 问题反馈

如果遇到问题，请创建新的 issue（不要添加 `code-showcase` 标签）描述问题详情。
