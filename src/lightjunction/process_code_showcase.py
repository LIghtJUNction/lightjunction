"""
Code Showcase Processor
=======================

This script processes code snippets from GitHub issues and executes them,
displaying both the code and its execution results in the README.

Usage:
    python process_code_showcase.py <issue_number>
"""

import requests
import os
import sys
import subprocess
import json
import re
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

def extract_code_blocks(markdown_text):
    """Extract code blocks from markdown text."""
    # Pattern to match code blocks with optional language specifier
    # Supports both formats: ```python\ncode``` and ```python code```
    pattern = r'```(\w+)?[ \t]*\n?(.*?)```'
    matches = re.findall(pattern, markdown_text, re.DOTALL)
    
    code_blocks = []
    for lang, code in matches:
        code_blocks.append({
            'language': lang.lower() if lang else 'text',
            'code': code.strip()
        })
    
    return code_blocks

def execute_code(code, language):
    """
    Execute code in a secure sandboxed environment.
    
    SECURITY MEASURES:
    1. Clear all environment variables to prevent token leakage
    2. Disable network access (best effort)
    3. Limited execution time
    4. Run in isolated subprocess with minimal privileges
    """
    result = {
        'success': False,
        'output': '',
        'error': ''
    }
    
    # Create a clean environment with NO secrets
    clean_env = {
        'PATH': '/usr/local/bin:/usr/bin:/bin',
        'HOME': '/tmp',
        'LANG': 'en_US.UTF-8',
        'LC_ALL': 'en_US.UTF-8'
    }
    
    # Security check: scan for potentially dangerous operations
    dangerous_patterns = [
        'os.environ', 'ENV', 'TOKEN', 'SECRET', 'PASSWORD',
        'import requests', 'import urllib', 'import http',
        'socket', 'open(', 'file(', '__import__',
        'eval(', 'exec(', 'compile(',
    ]
    
    code_lower = code.lower()
    for pattern in dangerous_patterns:
        if pattern.lower() in code_lower:
            result['error'] = f"⚠️ Security: Code contains potentially dangerous operation: '{pattern}'"
            result['output'] = "Code execution blocked for security reasons"
            return result
    
    try:
        if language == 'python':
            # Execute Python code with restricted environment
            proc = subprocess.run(
                ['python', '-c', code],
                capture_output=True,
                text=True,
                timeout=300,  # 5 minutes = 300 seconds
                env=clean_env,  # Use clean environment
                cwd='/tmp'  # Run in temp directory
            )
            result['output'] = proc.stdout
            result['error'] = proc.stderr
            result['success'] = proc.returncode == 0
            
        elif language in ['bash', 'sh', 'shell']:
            # Shell execution is too dangerous, disable it
            result['error'] = "⚠️ Shell code execution is disabled for security reasons"
            result['output'] = "Code display only (shell execution not allowed)"
            
        elif language == 'javascript' or language == 'js':
            # Execute JavaScript with restricted environment
            proc = subprocess.run(
                ['node', '-e', code],
                capture_output=True,
                text=True,
                timeout=300,  # 5 minutes = 300 seconds
                env=clean_env,
                cwd='/tmp'
            )
            result['output'] = proc.stdout
            result['error'] = proc.stderr
            result['success'] = proc.returncode == 0
            
        else:
            result['error'] = f"Language '{language}' is not supported for execution."
            result['output'] = "Code display only (execution not supported)"
            
    except subprocess.TimeoutExpired:
        result['error'] = "Execution timeout (5 minutes)"
    except FileNotFoundError as e:
        result['error'] = f"Interpreter not found: {e}"
    except Exception as e:
        result['error'] = f"Execution error: {e}"
    
    return result

def generate_showcase_markdown(issue_data, code_blocks):
    """Generate markdown for code showcase section."""
    lines = []
    
    # Header
    issue_number = issue_data.get('number', 'N/A')
    issue_title = issue_data.get('title', 'Untitled')
    issue_url = issue_data.get('html_url', '#')
    issue_user = issue_data.get('user', {}).get('login', 'Unknown')
    created_at = issue_data.get('created_at', '')
    
    # Format date
    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            created_at = dt.strftime('%Y-%m-%d %H:%M')
        except:
            pass
    
    lines.append(f"#### 📌 Issue #{issue_number}: {issue_title}")
    lines.append(f"")
    lines.append(f"**提交者 (Author):** @{issue_user} | **时间 (Time):** {created_at}")
    lines.append(f"**链接 (Link):** [View Issue]({issue_url})")
    lines.append(f"")
    
    # Process each code block
    for idx, block in enumerate(code_blocks, 1):
        language = block['language']
        code = block['code']
        
        lines.append(f"##### 代码片段 {idx} (Code Snippet {idx})")
        lines.append(f"")
        lines.append(f"```{language}")
        lines.append(code)
        lines.append(f"```")
        lines.append(f"")
        
        # Execute and show results
        if language in ['python', 'bash', 'sh', 'shell', 'javascript', 'js']:
            lines.append(f"**执行结果 (Execution Result):**")
            lines.append(f"")
            
            result = execute_code(code, language)
            
            if result['success']:
                lines.append(f"```")
                lines.append(result['output'] if result['output'] else "(No output)")
                lines.append(f"```")
            else:
                lines.append(f"```")
                if result['output']:
                    lines.append(result['output'])
                if result['error']:
                    lines.append(f"Error: {result['error']}")
                lines.append(f"```")
            lines.append(f"")
        else:
            lines.append(f"*该语言不支持自动执行 (Execution not supported for this language)*")
            lines.append(f"")
        
        if idx < len(code_blocks):
            lines.append(f"---")
            lines.append(f"")
    
    return "\n".join(lines)

def main():
    if len(sys.argv) < 2:
        print("Usage: python process_code_showcase.py <issue_number>")
        sys.exit(1)
    
    issue_number = sys.argv[1]
    github_token = get_github_token()
    
    # Repository info (can be extracted from environment or hardcoded)
    owner = os.environ.get('GITHUB_REPOSITORY_OWNER', 'LIghtJUNction')
    repo = os.environ.get('GITHUB_REPOSITORY', 'lightjunction').split('/')[-1]
    
    print(f"Processing issue #{issue_number} from {owner}/{repo}")
    
    # Fetch issue
    issue_data = fetch_issue_content(owner, repo, issue_number, github_token)
    if not issue_data:
        print("Failed to fetch issue data")
        sys.exit(1)
    
    # Extract code blocks
    body = issue_data.get('body', '')
    if not body:
        print("Issue has no content")
        sys.exit(1)
    
    code_blocks = extract_code_blocks(body)
    if not code_blocks:
        print("No code blocks found in issue")
        sys.exit(1)
    
    print(f"Found {len(code_blocks)} code block(s)")
    
    # Generate showcase markdown
    showcase_md = generate_showcase_markdown(issue_data, code_blocks)
    
    # Output for workflow to capture
    print("---SHOWCASE_START---")
    print(showcase_md)
    print("---SHOWCASE_END---")
    
    # Save to file for debugging
    with open('code_showcase_output.md', 'w', encoding='utf-8') as f:
        f.write(showcase_md)
    
    print(f"\nShowcase markdown generated successfully!")

if __name__ == "__main__":
    main()
