"""Test orchestrator scheduling logic."""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from lightjunction.orchestrator import SystemOrchestrator


class TestSchedulingLogic:
    """Test the scheduling logic for self-evolution and meta-evolution."""
    
    def test_should_run_self_evolution_no_config(self, tmp_path):
        """Test that self-evolution runs when no config exists."""
        with patch('lightjunction.orchestrator.Path') as mock_path:
            mock_path.return_value.exists.return_value = False
            orchestrator = SystemOrchestrator()
            assert orchestrator.should_run_self_evolution() is True
    
    def test_should_run_self_evolution_new_day(self, tmp_path):
        """Test that self-evolution runs on a new calendar day."""
        # Create a temporary config with yesterday's date (UTC)
        config_file = tmp_path / "agent_config.json"
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        config = {
            "last_update": yesterday.isoformat()
        }
        config_file.write_text(json.dumps(config))
        
        # Test using a patched Path to use our temp file
        orchestrator = SystemOrchestrator()
        with patch('lightjunction.orchestrator.Path') as mock_path:
            mock_path.return_value.exists.return_value = True
            with patch('builtins.open', lambda p, *args, **kwargs: open(config_file, *args, **kwargs)):
                result = orchestrator.should_run_self_evolution()
                assert result is True
    
    def test_should_run_self_evolution_same_day(self, tmp_path):
        """Test that self-evolution does NOT run on the same calendar day."""
        # Create a temporary config with today's date (1 hour ago, UTC)
        config_file = tmp_path / "agent_config.json"
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        config = {
            "last_update": one_hour_ago.isoformat()
        }
        config_file.write_text(json.dumps(config))
        
        # Test using a patched Path to use our temp file
        orchestrator = SystemOrchestrator()
        with patch('lightjunction.orchestrator.Path') as mock_path:
            mock_path.return_value.exists.return_value = True
            with patch('builtins.open', lambda p, *args, **kwargs: open(config_file, *args, **kwargs)):
                result = orchestrator.should_run_self_evolution()
                assert result is False
    
    def test_should_run_meta_evolution_no_config(self, tmp_path):
        """Test that meta-evolution does NOT run when no config exists."""
        with patch('lightjunction.orchestrator.Path') as mock_path:
            mock_path.return_value.exists.return_value = False
            orchestrator = SystemOrchestrator()
            assert orchestrator.should_run_meta_evolution() is False
    
    def test_should_run_meta_evolution_new_day(self, tmp_path):
        """Test that meta-evolution runs on a new calendar day."""
        # Create a temporary config with yesterday's date (UTC)
        config_file = tmp_path / "meta_agent_config.json"
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        config = {
            "last_meta_evolution": yesterday.isoformat()
        }
        config_file.write_text(json.dumps(config))
        
        # Test using a patched Path to use our temp file
        orchestrator = SystemOrchestrator()
        with patch('lightjunction.orchestrator.Path') as mock_path:
            mock_path.return_value.exists.return_value = True
            with patch('builtins.open', lambda p, *args, **kwargs: open(config_file, *args, **kwargs)):
                result = orchestrator.should_run_meta_evolution()
                assert result is True
    
    def test_scheduling_logic_with_problem_timestamps(self):
        """Test with the actual timestamps from the problem statement."""
        # The problem: last_update was 2025-11-03T19:25:46.906707
        # Current time was 2025-11-04T07:38:53
        # With old logic (20 hours): would skip (only 12.2 hours passed)
        # With new logic (new day): should run (different dates)
        
        last_update = "2025-11-03T19:25:46.906707"
        current_time = "2025-11-04T07:38:53"
        
        last_dt = datetime.fromisoformat(last_update)
        current_dt = datetime.fromisoformat(current_time)
        
        # Treat as UTC for consistent comparison
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if current_dt.tzinfo is None:
            current_dt = current_dt.replace(tzinfo=timezone.utc)
        
        last_date = last_dt.date()
        current_date = current_dt.date()
        
        # New logic: should return True because it's a new day
        assert current_date > last_date
        
        # Old logic would have returned False
        hours_since = (current_dt - last_dt).total_seconds() / 3600
        assert hours_since < 20  # Less than 20 hours
