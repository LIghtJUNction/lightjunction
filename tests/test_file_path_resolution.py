"""Test file path resolution in self-evolution agents."""

import os
import sys
from pathlib import Path

import pytest

# Add src to path for testing
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


class TestFilePathResolution:
    """Test suite for file path resolution in self-evolution agents."""
    
    def test_resolve_relative_path_agent_a(self):
        """Test that relative paths are resolved correctly in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
        # Test relative path
        result = agent.resolve_file_path("process_code_showcase_a.py")
        assert result == "src/lightjunction/process_code_showcase_a.py"
    
    def test_resolve_already_full_path_agent_a(self):
        """Test that full paths starting with src/ are preserved in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
        # Test path already starting with src/
        result = agent.resolve_file_path("src/lightjunction/process_code_showcase_a.py")
        assert result == "src/lightjunction/process_code_showcase_a.py"
    
    def test_resolve_absolute_path_agent_a(self):
        """Test that absolute paths are preserved in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
        # Test absolute path
        result = agent.resolve_file_path("/absolute/path/file.py")
        assert result == "/absolute/path/file.py"
    
    def test_resolve_relative_path_agent_b(self):
        """Test that relative paths are resolved correctly in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
        # Test relative path
        result = agent.resolve_file_path("process_code_showcase_b.py")
        assert result == "src/lightjunction/process_code_showcase_b.py"
    
    def test_resolve_already_full_path_agent_b(self):
        """Test that full paths starting with src/ are preserved in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
        # Test path already starting with src/
        result = agent.resolve_file_path("src/lightjunction/process_code_showcase_b.py")
        assert result == "src/lightjunction/process_code_showcase_b.py"
    
    def test_resolve_absolute_path_agent_b(self):
        """Test that absolute paths are preserved in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
        # Test absolute path
        result = agent.resolve_file_path("/absolute/path/file.py")
        assert result == "/absolute/path/file.py"
    
    def test_can_open_file_with_resolved_path_agent_a(self):
        """Test that files can be opened using resolved paths in agent_a."""
        from lightjunction.self_evolve_agent_a import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
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
    
    def test_can_open_file_with_resolved_path_agent_b(self):
        """Test that files can be opened using resolved paths in agent_b."""
        from lightjunction.self_evolve_agent_b import SelfEvolvingAgent
        
        agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
        
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
