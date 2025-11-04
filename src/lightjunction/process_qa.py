"""
Q&A Processor with GitHub Copilot
==================================

This script processes questions from GitHub issues and generates answers
using GitHub Copilot's free model API, then displays them in the README.

Usage:
    python process_qa.py <issue_number>
"""

import requests
import os
import sys
import json
from datetime import datetime

def get_github_token():
    """Get GitHub token from environment variable."""
    return os.environ.get('GITHUB_TOKEN', '')

def fetch_issue_content(owner, repo, issue_number, token=''):
    """Fetch issue content from GitHub API."""
    api_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
    headers = {
        'Accept': 'application/vnd.github.v3+json'
    }
    if token:
        headers['Authorization'] = f'token {token}'
    
    try:
        response = requests.get(api_url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching issue: {e}")
        return None

def generate_answer_with_copilot(question, system_prompt, token=''):
    """
    Generate answer using GitHub Copilot Chat API.
    
    Note: This uses GitHub Models API which provides free access to AI models
    including GPT-4o-mini through GitHub Copilot.
    """
    # GitHub Models API endpoint
    api_url = "https://models.inference.ai.azure.com/chat/completions"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    payload = {
        "model": "gpt-4o-mini",  # Free model through GitHub Copilot
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": question
            }
        ],
        "temperature": 0.7,
        "max_tokens": 2000,
        "top_p": 0.95
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        if 'choices' in result and len(result['choices']) > 0:
            return result['choices'][0]['message']['content']
        else:
            return "抱歉，无法生成回答。"
            
    except requests.exceptions.RequestException as e:
        print(f"Error calling Copilot API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        return f"API 调用失败: {str(e)}"

def get_system_prompt():
    """Get the fixed system prompt for the Q&A assistant."""
    return """你是一个友好、专业的技术助手，专注于帮助开发者解答编程、软件开发和技术相关的问题。

你的特点：
1. 回答简洁明了，突出重点
2. 提供实用的代码示例（如果适用）
3. 使用中文回答，但代码和技术术语使用英文
4. 态度友好，鼓励学习
5. 如果不确定答案，会诚实说明
6. 优先推荐最佳实践和现代化的解决方案

回答格式：
- 先给出简短的直接答案
- 如果需要，提供详细解释
- 如果适用，给出代码示例
- 可以提供相关资源链接（但不要编造）

请用专业但友好的语气回答问题。"""

def generate_qa_markdown(issue_data, answer):
    """Generate markdown for Q&A section."""
    lines = []
    
    # Header
    issue_number = issue_data.get('number', 'N/A')
    issue_title = issue_data.get('title', 'Untitled')
    issue_url = issue_data.get('html_url', '#')
    issue_user = issue_data.get('user', {}).get('login', 'Unknown')
    created_at = issue_data.get('created_at', '')
    question = issue_data.get('body', '').strip()
    
    # Format date
    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            created_at = dt.strftime('%Y-%m-%d %H:%M')
        except:
            pass
    
    lines.append(f"#### 🤔 问题 #{issue_number}: {issue_title}")
    lines.append(f"")
    lines.append(f"**提问者:** @{issue_user} | **时间:** {created_at}")
    lines.append(f"**链接:** [查看原问题]({issue_url})")
    lines.append(f"")
    
    # Question
    lines.append(f"##### 📝 问题描述")
    lines.append(f"")
    lines.append(f"> {question}")
    lines.append(f"")
    
    # Answer
    lines.append(f"##### 💡 AI 回答 (Powered by GitHub Copilot)")
    lines.append(f"")
    lines.append(answer)
    lines.append(f"")
    
    # Footer
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"*💬 想要提问？创建一个带有 `qa` 标签的 [新 Issue](../../issues/new) 即可获得 AI 助手的回答！*")
    lines.append(f"")
    
    return "\n".join(lines)

def main():
    if len(sys.argv) < 2:
        print("Usage: python process_qa.py <issue_number>")
        sys.exit(1)
    
    issue_number = sys.argv[1]
    github_token = get_github_token()
    
    if not github_token:
        print("Error: GITHUB_TOKEN environment variable is required")
        sys.exit(1)
    
    # Repository info
    owner = os.environ.get('GITHUB_REPOSITORY_OWNER', 'LIghtJUNction')
    repo = os.environ.get('GITHUB_REPOSITORY', 'lightjunction').split('/')[-1]
    
    print(f"Processing Q&A issue #{issue_number} from {owner}/{repo}")
    
    # Fetch issue
    issue_data = fetch_issue_content(owner, repo, issue_number, github_token)
    if not issue_data:
        print("Failed to fetch issue data")
        sys.exit(1)
    
    # Get question
    question = issue_data.get('body', '').strip()
    if not question:
        print("Issue has no content")
        sys.exit(1)
    
    print(f"Question: {question[:100]}...")
    
    # Get system prompt
    system_prompt = get_system_prompt()
    
    # Generate answer using Copilot
    print("Generating answer with GitHub Copilot...")
    answer = generate_answer_with_copilot(question, system_prompt, github_token)
    
    if not answer or answer.startswith("API 调用失败"):
        print(f"Failed to generate answer: {answer}")
        # Provide fallback answer
        answer = """抱歉，当前无法连接到 AI 服务生成回答。

请稍后重试，或者直接在 issue 中等待社区成员的回复。"""
    
    print(f"Answer generated: {len(answer)} characters")
    
    # Generate Q&A markdown
    qa_md = generate_qa_markdown(issue_data, answer)
    
    # Output for workflow to capture
    print("---QA_START---")
    print(qa_md)
    print("---QA_END---")
    
    # Save to file for debugging
    with open('qa_output.md', 'w', encoding='utf-8') as f:
        f.write(qa_md)
    
    print(f"\nQ&A markdown generated successfully!")

if __name__ == "__main__":
    main()
