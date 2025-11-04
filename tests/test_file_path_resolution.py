"""Test file path resolution in self-evolution agents."""

import json
import os
import sys
from pathlib import Path

import pytest

# Add src to path for testing
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


@pytest.fixture
def temp_config_file(tmp_path):
    """Create a temporary config file for agent initialization."""
    config = {
        "current_version": "a",
        "model": "gpt-4o-mini",
        "files": {},
        "evolution_history": [],
        "max_history": 10,
        "last_update": "2025-01-01T00:00:00"
    }
    config_file = tmp_path / "agent_config.json"
    with open(config_file, 'w') as f:
        json.dump(config, f)
    return str(config_file)


class TestFilePathResolution:
    """Test suite for file path resolution in self-evolution agents."""

    def test_resolve_relative_path_agent_a(self, temp_config_file):
        """Test that relative paths are resolved correctly in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)

        # Test relative path
        result = agent.resolve_file_path("process_code_showcase_a.py")
        assert result == "src/lightjunction/process_code_showcase_a.py"

    def test_resolve_already_full_path_agent_a(self, temp_config_file):
        """Test that full paths starting with src/ are preserved in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)

        # Test path already starting with src/
        result = agent.resolve_file_path("src/lightjunction/process_code_showcase_a.py")
        assert result == "src/lightjunction/process_code_showcase_a.py"

    def test_resolve_absolute_path_agent_a(self, temp_config_file):
        """Test that absolute paths are preserved in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)

        # Test absolute path
        result = agent.resolve_file_path("/absolute/path/file.py")
        assert result == "/absolute/path/file.py"

    def test_resolve_relative_path_agent_b(self, temp_config_file):
        """Test that relative paths are resolved correctly in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)

        # Test relative path
        result = agent.resolve_file_path("process_code_showcase_b.py")
        assert result == "src/lightjunction/process_code_showcase_b.py"

    def test_resolve_already_full_path_agent_b(self, temp_config_file):
        """Test that full paths starting with src/ are preserved in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)

        # Test path already starting with src/
        result = agent.resolve_file_path("src/lightjunction/process_code_showcase_b.py")
        assert result == "src/lightjunction/process_code_showcase_b.py"

    def test_resolve_absolute_path_agent_b(self, temp_config_file):
        """Test that absolute paths are preserved in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)

        # Test absolute path
        result = agent.resolve_file_path("/absolute/path/file.py")
        assert result == "/absolute/path/file.py"

    def test_can_open_file_with_resolved_path_agent_a(self, temp_config_file):
        """Test that files can be opened using resolved paths in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)
        
        # Change to repo root for testing
        original_dir = os.getcwd()
        try:
            repo_root = Path(__file__).parent.parent
            os.chdir(repo_root)
            
            # Test opening a file with resolved path
            resolved = agent.resolve_file_path("process_code_showcase_a.py")
            with open(resolved, 'r') as f:
                content = f.read()
            
            assert len(content) > 0
            assert "def" in content  # Should contain Python code
        finally:
            os.chdir(original_dir)
    
    def test_can_open_file_with_resolved_path_agent_b(self, temp_config_file):
        """Test that files can be opened using resolved paths in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent

        agent = SelfEvolvingAgent(temp_config_file)
        
        # Change to repo root for testing
        original_dir = os.getcwd()
        try:
            repo_root = Path(__file__).parent.parent
            os.chdir(repo_root)
            
            # Test opening a file with resolved path
            resolved = agent.resolve_file_path("process_code_showcase_b.py")
            with open(resolved, 'r') as f:
                content = f.read()
            
            assert len(content) > 0
            assert "def" in content  # Should contain Python code
        finally:
            os.chdir(original_dir)
