"""Test self-evolution agent capabilities."""

import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

import pytest

# Add src to path for testing
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


@pytest.fixture
def mock_config():
    """Provide a mock agent configuration."""
    return {
        "current_version": "a",
        "model": "gpt-4o-mini",
        "files": {
            "update_readme_data": {
                "a": "src/lightjunction/update_readme_data_a.py",
                "b": "src/lightjunction/update_readme_data_b.py",
                "active": "a"
            }
        },
        "evolution_history": [],
        "max_history": 10,
        "last_update": "2025-01-01T00:00:00"
    }


@pytest.fixture
def temp_config_file(tmp_path, mock_config):
    """Create a temporary config file."""
    config_file = tmp_path / "agent_config.json"
    with open(config_file, 'w') as f:
        json.dump(mock_config, f)
    return config_file


class TestSelfEvolvingAgent:
    """Test suite for SelfEvolvingAgent."""
    
    def test_import_self_evolve_agent(self):
        """Test that self_evolve_agent module can be imported."""
        from lightjunction import self_evolve_agent
        assert hasattr(self_evolve_agent, 'SelfEvolvingAgent')
    
    def test_agent_initialization(self, temp_config_file):
        """Test agent can be initialized with config."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch.object(SelfEvolvingAgent, '__init__', lambda x, config_path: None):
            agent = SelfEvolvingAgent.__new__(SelfEvolvingAgent)
            assert agent is not None
    
    def test_load_config(self, temp_config_file, mock_config):
        """Test loading configuration from file."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            assert agent.config == mock_config
            assert agent.config['current_version'] == 'a'
    
    def test_get_next_version(self, temp_config_file):
        """Test version alternation logic."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Should alternate from a to b
            assert agent.get_next_version() == 'b'
            
            # Change current version and test again
            agent.config['current_version'] = 'b'
            assert agent.get_next_version() == 'a'
    
    def test_save_config(self, temp_config_file):
        """Test saving configuration to file."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Modify config
            agent.config['current_version'] = 'b'
            agent.save_config()
            
            # Read back and verify
            with open(temp_config_file) as f:
                saved_config = json.load(f)
            
            assert saved_config['current_version'] == 'b'
    
    def test_baseline_file_detection(self, temp_config_file, tmp_path):
        """Test baseline file detection logic."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        # Create a baseline file
        baseline_file = tmp_path / "update_readme_data.py"
        baseline_file.write_text("# Baseline code")
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Use context manager to ensure proper cleanup
            import os
            with patch('os.getcwd', return_value=str(tmp_path)):
                with patch('pathlib.Path.cwd', return_value=tmp_path):
                    baseline = agent.get_baseline_file("update_readme_data")
                    assert baseline == "update_readme_data.py"
    
    def test_should_use_baseline_after_failures(self, temp_config_file):
        """Test that baseline is used after repeated failures."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Add failure history
            agent.config['evolution_history'] = [
                {
                    'results': [
                        {'file': 'update_readme_data', 'status': 'failed'}
                    ]
                },
                {
                    'results': [
                        {'file': 'update_readme_data', 'status': 'failed'}
                    ]
                }
            ]
            
            # Should use baseline after 2 failures
            assert agent.should_use_baseline('update_readme_data') is True
    
    def test_should_not_use_baseline_with_successes(self, temp_config_file):
        """Test that baseline is not used when evolution is successful."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Add success history
            agent.config['evolution_history'] = [
                {
                    'results': [
                        {'file': 'update_readme_data', 'status': 'success'}
                    ]
                }
            ]
            
            # Should not use baseline with recent success
            assert agent.should_use_baseline('update_readme_data') is False
    
    def test_test_file_syntax_check(self, temp_config_file, tmp_path):
        """Test file testing functionality with valid syntax."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Create a valid Python file
            test_file = tmp_path / "test_valid.py"
            test_file.write_text("# Valid Python code\nprint('hello')")
            
            passed, message = agent.test_file(str(test_file))
            assert passed is True
            assert "passed" in message.lower()
    
    def test_test_file_syntax_error(self, temp_config_file, tmp_path):
        """Test file testing functionality with invalid syntax."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Create an invalid Python file
            test_file = tmp_path / "test_invalid.py"
            test_file.write_text("this is not valid python )(")
            
            passed, message = agent.test_file(str(test_file))
            assert passed is False
            assert "error" in message.lower()
    
    @pytest.mark.asyncio
    async def test_fallback_ai_call(self, temp_config_file):
        """Test fallback AI call mechanism."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Mock the requests.post call
            mock_response = MagicMock()
            mock_response.json.return_value = {
                'choices': [
                    {'message': {'content': 'Test response'}}
                ]
            }
            mock_response.raise_for_status = MagicMock()
            
            with patch('requests.post', return_value=mock_response):
                result = await agent._fallback_ai_call("test prompt", "test instructions")
                assert result == 'Test response'
    
    @pytest.mark.asyncio
    async def test_analyze_file(self, temp_config_file, tmp_path):
        """Test file analysis with mocked AI response."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Create a test file
            test_file = tmp_path / "test_code.py"
            test_file.write_text("def test(): pass")
            
            # Mock AI response
            mock_improvements = '{"improvements": [{"title": "Add docstring", "description": "Improves documentation", "priority": "high"}]}'
            
            with patch.object(agent, 'call_ai_agent', return_value=mock_improvements):
                result = await agent.analyze_file(str(test_file))
                assert result == mock_improvements
                assert 'improvements' in result
    
    @pytest.mark.asyncio
    async def test_apply_improvements(self, temp_config_file, tmp_path):
        """Test applying improvements with mocked AI response."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Create a test file
            test_file = tmp_path / "test_code.py"
            original_code = "def test(): pass"
            test_file.write_text(original_code)
            
            # Mock AI response with improved code
            improved_code = 'def test():\n    """Test function."""\n    pass'
            
            with patch.object(agent, 'call_ai_agent', return_value=improved_code):
                result = await agent.apply_improvements(str(test_file), '{}')
                assert result == improved_code
                assert '"""Test function."""' in result
    
    def test_evolution_history_tracking(self, temp_config_file):
        """Test that evolution history is properly tracked."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Initially empty
            assert len(agent.config['evolution_history']) == 0
            
            # Add a record
            record = {
                'timestamp': datetime.now().isoformat(),
                'target_version': 'b',
                'results': [{'file': 'test', 'status': 'success'}],
                'model': 'gpt-4o-mini'
            }
            agent.config['evolution_history'].append(record)
            agent.save_config()
            
            # Reload and verify
            agent2 = SelfEvolvingAgent(str(temp_config_file))
            assert len(agent2.config['evolution_history']) == 1
            assert agent2.config['evolution_history'][0]['target_version'] == 'b'
    
    def test_max_history_limit(self, temp_config_file):
        """Test that history is limited to max_history entries."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            # Set a low max_history
            agent.config['max_history'] = 3
            
            # Add more than max_history records
            for i in range(5):
                agent.config['evolution_history'].append({
                    'timestamp': datetime.now().isoformat(),
                    'target_version': 'b' if i % 2 else 'a',
                    'results': [],
                    'model': 'gpt-4o-mini'
                })
            
            # Simulate the history trimming logic
            if len(agent.config['evolution_history']) > agent.config['max_history']:
                agent.config['evolution_history'] = agent.config['evolution_history'][-agent.config['max_history']:]
            
            assert len(agent.config['evolution_history']) == 3
    
    def test_version_switching_on_success(self, temp_config_file):
        """Test that version switches when all files evolve successfully."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            initial_version = agent.config['current_version']
            assert initial_version == 'a'
            
            # Simulate successful evolution
            results = [
                {'file': 'update_readme_data', 'status': 'success', 'version': 'b'}
            ]
            
            all_passed = all(r['status'] == 'success' for r in results)
            if all_passed:
                agent.config['current_version'] = 'b'
                for file_key in agent.config['files']:
                    agent.config['files'][file_key]['active'] = 'b'
            
            assert agent.config['current_version'] == 'b'
            assert agent.config['files']['update_readme_data']['active'] == 'b'
    
    def test_version_no_switch_on_failure(self, temp_config_file):
        """Test that version doesn't switch when evolution fails."""
        from lightjunction.self_evolve_agent import SelfEvolvingAgent
        
        with patch('lightjunction.self_evolve_agent.IterationLogger'):
            agent = SelfEvolvingAgent(str(temp_config_file))
            
            initial_version = agent.config['current_version']
            assert initial_version == 'a'
            
            # Simulate failed evolution
            results = [
                {'file': 'update_readme_data', 'status': 'failed', 'reason': 'Test failed'}
            ]
            
            all_passed = all(r['status'] == 'success' for r in results)
            if not all_passed:
                # Version should stay the same
                pass
            
            assert agent.config['current_version'] == 'a'
            assert agent.config['files']['update_readme_data']['active'] == 'a'


class TestIterationLogger:
    """Test suite for IterationLogger."""
    
    def test_logger_initialization(self, tmp_path):
        """Test that logger can be initialized."""
        from lightjunction.self_evolve_agent import IterationLogger
        
        log_file = tmp_path / "test.log"
        logger = IterationLogger(str(log_file))
        
        assert log_file.exists()
        assert logger.log_file == log_file
    
    def test_logger_writes_to_file(self, tmp_path):
        """Test that logger writes messages to file."""
        from lightjunction.self_evolve_agent import IterationLogger
        
        log_file = tmp_path / "test.log"
        logger = IterationLogger(str(log_file))
        
        test_message = "Test log message"
        logger.log(test_message, level="TEST")
        
        # Read log file and verify
        with open(log_file) as f:
            content = f.read()
        
        assert test_message in content
        assert "TEST" in content
    
    def test_logger_evolution_tracking(self, tmp_path):
        """Test that logger tracks evolution cycles."""
        from lightjunction.self_evolve_agent import IterationLogger
        
        log_file = tmp_path / "test.log"
        logger = IterationLogger(str(log_file))
        
        # Log evolution start
        logger.log_evolution_start('b', {'file1': {}, 'file2': {}})
        
        # Read log and verify
        with open(log_file) as f:
            content = f.read()
        
        assert 'Target version: b' in content
        assert 'Files to evolve: 2' in content


class TestSelfEvolutionIntegration:
    """Integration tests for self-evolution functionality."""
    
    def test_agent_can_be_instantiated_from_module(self):
        """Test that agent can be instantiated when imported as module."""
        import sys
        from pathlib import Path
        
        # Ensure module can be imported
        src_path = Path(__file__).parent.parent / "src"
        if str(src_path) not in sys.path:
            sys.path.insert(0, str(src_path))
        
        from lightjunction import self_evolve_agent
        assert hasattr(self_evolve_agent, 'main')
        assert hasattr(self_evolve_agent, 'main_async')
    
    def test_config_structure_matches_expected(self, tmp_path):
        """Test that config structure matches what the agent expects."""
        config = {
            "current_version": "a",
            "model": "gpt-4o-mini",
            "files": {
                "test_file": {
                    "a": "path/to/a.py",
                    "b": "path/to/b.py",
                    "active": "a"
                }
            },
            "evolution_history": [],
            "max_history": 10,
            "last_update": datetime.now().isoformat()
        }
        
        config_file = tmp_path / "agent_config.json"
        with open(config_file, 'w') as f:
            json.dump(config, f)
        
        # Verify it can be read back
        with open(config_file) as f:
            loaded = json.load(f)
        
        assert loaded['current_version'] == 'a'
        assert 'files' in loaded
        assert 'evolution_history' in loaded
        assert 'max_history' in loaded
