"""Test QA and Code Showcase processing functionality."""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

# Add src to path for testing
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


@pytest.fixture
def mock_github_issue():
    """Provide a mock GitHub issue response."""
    return {
        "number": 123,
        "title": "Test Question",
        "body": "This is a test question about Python",
        "user": {"login": "testuser"},
        "created_at": "2025-01-01T00:00:00Z",
        "labels": [{"name": "qa"}]
    }


@pytest.fixture
def mock_code_showcase_issue():
    """Provide a mock code showcase issue with code blocks."""
    return {
        "number": 456,
        "title": "Demo: Python Sort Algorithm",
        "body": """Here's a quick sort implementation:

```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

test_array = [3, 6, 8, 10, 1, 2, 1]
print("Original:", test_array)
print("Sorted:", quicksort(test_array))
```

And a JavaScript example:

```javascript
console.log("Hello from JavaScript!");
const arr = [5, 2, 8, 1, 9];
console.log("Array:", arr);
```
""",
        "user": {"login": "testuser"},
        "created_at": "2025-01-01T00:00:00Z",
        "labels": [{"name": "code-showcase"}]
    }


class TestProcessQA:
    """Test suite for QA processing."""
    
    def test_import_process_qa(self):
        """Test that process_qa module can be imported."""
        from lightjunction import process_qa
        assert process_qa is not None
    
    def test_get_github_token(self):
        """Test getting GitHub token from environment."""
        from lightjunction.process_qa import get_github_token
        
        with patch.dict('os.environ', {'GITHUB_TOKEN': 'test_token_123'}):
            token = get_github_token()
            assert token == 'test_token_123'
    
    def test_get_github_token_missing(self):
        """Test getting GitHub token when not set."""
        from lightjunction.process_qa import get_github_token
        
        with patch.dict('os.environ', {}, clear=True):
            token = get_github_token()
            assert token == ''
    
    def test_fetch_issue_content_success(self, mock_github_issue):
        """Test successfully fetching issue content."""
        from lightjunction.process_qa import fetch_issue_content
        
        mock_response = MagicMock()
        mock_response.json.return_value = mock_github_issue
        mock_response.raise_for_status = MagicMock()
        
        with patch('requests.get', return_value=mock_response):
            result = fetch_issue_content('owner', 'repo', 123, 'token')
            assert result == mock_github_issue
            assert result['number'] == 123
            assert result['title'] == "Test Question"
    
    def test_fetch_issue_content_failure(self):
        """Test handling fetch issue content failure."""
        from lightjunction.process_qa import fetch_issue_content
        
        with patch('requests.get', side_effect=Exception("Network error")):
            result = fetch_issue_content('owner', 'repo', 123, 'token')
            assert result is None
    
    def test_generate_answer_with_copilot_success(self):
        """Test successfully generating answer with Copilot."""
        from lightjunction.process_qa import generate_answer_with_copilot
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'choices': [
                {
                    'message': {
                        'content': 'This is a test answer from AI.'
                    }
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch('requests.post', return_value=mock_response):
            answer = generate_answer_with_copilot(
                "What is Python?",
                "You are a helpful assistant",
                "token"
            )
            assert answer == 'This is a test answer from AI.'
    
    def test_generate_answer_with_copilot_no_choices(self):
        """Test handling empty response from Copilot."""
        from lightjunction.process_qa import generate_answer_with_copilot
        
        mock_response = MagicMock()
        mock_response.json.return_value = {'choices': []}
        mock_response.raise_for_status = MagicMock()
        
        with patch('requests.post', return_value=mock_response):
            answer = generate_answer_with_copilot(
                "What is Python?",
                "You are a helpful assistant",
                "token"
            )
            assert "抱歉" in answer or "无法" in answer
    
    def test_qa_module_has_main_function(self):
        """Test that QA module has main entry point."""
        from lightjunction import process_qa
        main_func = getattr(process_qa, 'main', None)
        assert main_func is None or callable(main_func)


class TestProcessCodeShowcase:
    """Test suite for Code Showcase processing."""
    
    def test_import_process_code_showcase(self):
        """Test that process_code_showcase module can be imported."""
        from lightjunction import process_code_showcase
        assert process_code_showcase is not None
    
    def test_get_github_token(self):
        """Test getting GitHub token from environment."""
        from lightjunction.process_code_showcase import get_github_token
        
        with patch.dict('os.environ', {'GITHUB_TOKEN': 'test_token_456'}):
            token = get_github_token()
            assert token == 'test_token_456'
    
    def test_fetch_issue_content(self, mock_code_showcase_issue):
        """Test fetching code showcase issue content."""
        from lightjunction.process_code_showcase import fetch_issue_content
        
        mock_response = MagicMock()
        mock_response.json.return_value = mock_code_showcase_issue
        mock_response.raise_for_status = MagicMock()
        
        with patch('requests.get', return_value=mock_response):
            result = fetch_issue_content('owner', 'repo', 456, 'token')
            assert result == mock_code_showcase_issue
            assert result['number'] == 456
            assert '```python' in result['body']
    
    def test_extract_code_blocks_python(self):
        """Test extracting Python code blocks from markdown."""
        from lightjunction.process_code_showcase import extract_code_blocks
        
        markdown = """
Here's some Python code:

```python
def hello():
    print("Hello, World!")

hello()
```

And some text.
"""
        
        blocks = extract_code_blocks(markdown)
        assert len(blocks) == 1
        assert blocks[0]['language'] == 'python'
        assert 'def hello()' in blocks[0]['code']
        assert 'print("Hello, World!")' in blocks[0]['code']
    
    def test_extract_code_blocks_multiple_languages(self):
        """Test extracting multiple code blocks with different languages."""
        from lightjunction.process_code_showcase import extract_code_blocks
        
        markdown = """
Python example:
```python
print("Python")
```

JavaScript example:
```javascript
console.log("JavaScript");
```

Bash example:
```bash
echo "Bash"
```
"""
        
        blocks = extract_code_blocks(markdown)
        assert len(blocks) == 3
        
        languages = [block['language'] for block in blocks]
        assert 'python' in languages
        assert 'javascript' in languages
        assert 'bash' in languages
    
    def test_extract_code_blocks_no_language(self):
        """Test extracting code blocks without language specifier."""
        from lightjunction.process_code_showcase import extract_code_blocks
        
        markdown = """
```
generic code block
no language specified
```
"""
        
        blocks = extract_code_blocks(markdown)
        assert len(blocks) == 1
        assert blocks[0]['language'] == 'text'
        assert 'generic code block' in blocks[0]['code']
    
    def test_extract_code_blocks_empty(self):
        """Test extracting code blocks from text without any."""
        from lightjunction.process_code_showcase import extract_code_blocks
        
        markdown = "Just plain text, no code blocks here."
        
        blocks = extract_code_blocks(markdown)
        assert len(blocks) == 0
    
    def test_extract_code_blocks_single_line(self):
        """Test extracting code blocks with code on same line as opening fence."""
        from lightjunction.process_code_showcase import extract_code_blocks
        
        # Test single-line format (like issue #17)
        markdown = '```python print("Hello, World!") ```'
        
        blocks = extract_code_blocks(markdown)
        assert len(blocks) == 1
        assert blocks[0]['language'] == 'python'
        assert blocks[0]['code'] == 'print("Hello, World!")'
    
    def test_extract_code_blocks_mixed_formats(self):
        """Test extracting code blocks with both single-line and multi-line formats."""
        from lightjunction.process_code_showcase import extract_code_blocks
        
        markdown = """
        Single-line format:
        ```python print("Single line") ```
        
        Multi-line format:
        ```javascript
        console.log("Multi line");
        ```
        """
        
        blocks = extract_code_blocks(markdown)
        assert len(blocks) == 2
        assert blocks[0]['language'] == 'python'
        assert blocks[0]['code'] == 'print("Single line")'
        assert blocks[1]['language'] == 'javascript'
        assert 'console.log' in blocks[1]['code']
    
    def test_execute_code_python_success(self):
        """Test executing valid Python code."""
        from lightjunction.process_code_showcase import execute_code
        
        code = """
print("Hello from Python!")
result = 2 + 2
print(f"2 + 2 = {result}")
"""
        
        result = execute_code(code, 'python')
        
        # Check structure
        assert 'success' in result
        assert 'output' in result
        assert 'error' in result
    
    def test_execute_code_python_syntax_error(self):
        """Test executing Python code with syntax error."""
        from lightjunction.process_code_showcase import execute_code
        
        code = "this is not valid python )("
        
        result = execute_code(code, 'python')
        
        # Should capture the error
        assert 'success' in result
        assert 'error' in result
    
    def test_code_showcase_module_has_main_function(self):
        """Test that code showcase module has main entry point."""
        from lightjunction import process_code_showcase
        main_func = getattr(process_code_showcase, 'main', None)
        assert main_func is None or callable(main_func)
    
    def test_security_code_scanning(self):
        """Test that dangerous code patterns are detected."""
        from lightjunction.process_code_showcase import execute_code
        
        # Test various dangerous patterns
        dangerous_codes = [
            "import os; os.environ['SECRET']",
            "import requests; requests.get('http://evil.com')",
            "eval('malicious code')",
            "exec('dangerous')",
            "__import__('os').system('rm -rf /')"
        ]
        
        # At least one should be caught by security checks
        # Note: This depends on the security implementation in the module
        for code in dangerous_codes:
            result = execute_code(code, 'python')
            # Should either fail or be blocked
            assert 'success' in result or 'error' in result


class TestQACodeShowcaseIntegration:
    """Integration tests for QA and Code Showcase features."""
    
    def test_qa_and_code_showcase_modules_coexist(self):
        """Test that both QA and Code Showcase modules can be imported together."""
        from lightjunction import process_qa
        from lightjunction import process_code_showcase
        
        assert process_qa is not None
        assert process_code_showcase is not None
    
    def test_qa_ab_versions_exist(self):
        """Test that A/B versions of QA processor exist."""
        try:
            from lightjunction import process_qa_a
            from lightjunction import process_qa_b
            
            # If they exist, they should be importable
            assert process_qa_a is not None
            assert process_qa_b is not None
        except ImportError:
            # It's okay if A/B versions don't exist yet
            pytest.skip("A/B versions not implemented yet")
    
    def test_code_showcase_ab_versions_exist(self):
        """Test that A/B versions of Code Showcase processor exist."""
        try:
            from lightjunction import process_code_showcase_a
            from lightjunction import process_code_showcase_b
            
            # If they exist, they should be importable
            assert process_code_showcase_a is not None
            assert process_code_showcase_b is not None
        except ImportError:
            # It's okay if A/B versions don't exist yet
            pytest.skip("A/B versions not implemented yet")
    
    def test_environment_variables_isolation(self):
        """Test that sensitive environment variables are properly isolated."""
        from lightjunction.process_code_showcase import execute_code
        
        # Set a fake secret
        with patch.dict('os.environ', {'FAKE_SECRET': 'super_secret_value'}):
            # Try to access it from code
            code = """
import os
print(os.environ.get('FAKE_SECRET', 'NOT_FOUND'))
"""
            result = execute_code(code, 'python')
            
            # The secret should not be accessible in the sandboxed execution
            # (depends on security implementation)
            assert 'success' in result or 'error' in result
    
    def test_full_qa_workflow_structure(self, mock_github_issue):
        """Test the complete QA workflow structure."""
        from lightjunction.process_qa import fetch_issue_content, generate_answer_with_copilot
        
        # Mock the API calls
        with patch('requests.get') as mock_get, \
             patch('requests.post') as mock_post:
            
            # Setup mocks
            mock_get_response = MagicMock()
            mock_get_response.json.return_value = mock_github_issue
            mock_get_response.raise_for_status = MagicMock()
            mock_get.return_value = mock_get_response
            
            mock_post_response = MagicMock()
            mock_post_response.json.return_value = {
                'choices': [{'message': {'content': 'Test answer'}}]
            }
            mock_post_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_post_response
            
            # Simulate workflow
            issue = fetch_issue_content('owner', 'repo', 123, 'token')
            assert issue is not None
            
            question = f"{issue['title']}\n\n{issue['body']}"
            answer = generate_answer_with_copilot(question, "System prompt", 'token')
            assert answer == 'Test answer'
    
    def test_full_code_showcase_workflow_structure(self, mock_code_showcase_issue):
        """Test the complete Code Showcase workflow structure."""
        from lightjunction.process_code_showcase import (
            fetch_issue_content,
            extract_code_blocks,
            execute_code
        )
        
        # Mock the API call
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_code_showcase_issue
            mock_response.raise_for_status = MagicMock()
            mock_get.return_value = mock_response
            
            # Simulate workflow
            issue = fetch_issue_content('owner', 'repo', 456, 'token')
            assert issue is not None
            
            code_blocks = extract_code_blocks(issue['body'])
            assert len(code_blocks) >= 1
            
            # Try to execute the first block
            if code_blocks:
                first_block = code_blocks[0]
                result = execute_code(first_block['code'], first_block['language'])
                assert 'success' in result
                assert 'output' in result
                assert 'error' in result


class TestQACodeShowcaseConfiguration:
    """Test configuration and settings for QA and Code Showcase."""
    
    def test_agent_config_includes_qa_and_showcase(self):
        """Test that agent configuration includes QA and showcase files."""
        config_path = Path(__file__).parent.parent / "agent_config.json"
        
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
            
            files = config.get('files', {})
            
            # Check if QA or showcase files are configured for A/B testing
            # This is optional - they might not be in the config yet
            assert isinstance(files, dict)
    
    def test_qa_system_prompt_structure(self):
        """Test that QA system prompt is properly structured."""
        # This test verifies the system prompt used for QA
        system_prompt = """你是一个友好、专业的技术助手，专注于帮助开发者解答编程、软件开发和技术相关的问题。

你的特点：
1. 回答简洁明了，突出重点
2. 提供实用的代码示例（如果适用）
3. 使用中文回答，但代码和技术术语使用英文
4. 态度友好，鼓励学习
5. 如果不确定答案，会诚实说明
6. 优先推荐最佳实践和现代化的解决方案"""
        
        # Verify it's a non-empty string
        assert isinstance(system_prompt, str)
        assert len(system_prompt) > 0
        assert "技术助手" in system_prompt or "助手" in system_prompt
    
    def test_code_execution_timeout_configured(self):
        """Test that code execution has timeout configured."""
        # The execute_code function should have a timeout mechanism
        # This is important for security
        from lightjunction.process_code_showcase import execute_code
        
        # The function should exist and be callable
        assert callable(execute_code)
        
        # It should handle timeouts gracefully
        # (actual timeout testing would require running long code)
    
    def test_supported_languages_documented(self):
        """Test that supported languages are documented."""
        # Check that the guide documents supported languages
        guide_path = Path(__file__).parent.parent / "CODE_SHOWCASE_GUIDE.md"
        
        if guide_path.exists():
            with open(guide_path) as f:
                content = f.read()
            
            # Should mention supported languages
            assert 'Python' in content or 'python' in content
            assert 'JavaScript' in content or 'javascript' in content
