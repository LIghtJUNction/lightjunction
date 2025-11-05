"""
System Orchestrator - Unified Task Scheduler
=============================================

This orchestrator manages all system tasks in the correct order:
1. Self-evolution (if scheduled)
2. Meta-evolution (if scheduled)  
3. README update
4. Weekly report generation

All logic is in Python, triggered by a single workflow.
"""

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


class SystemOrchestrator:
    """Orchestrates all system tasks in proper order."""
    
    def __init__(self):
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'tasks': {}
        }
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️",
            "RUNNING": "🔄"
        }.get(level, "ℹ️")
        print(f"[{timestamp}] {prefix} {message}")
    
    def should_run_self_evolution(self) -> bool:
        """Check if self-evolution should run (daily at 00:00)."""
        # Check if it's a new day since last run
        config_path = Path("agent_config.json")
        if not config_path.exists():
            return True
        
        try:
            with open(config_path) as f:
                config = json.load(f)
            
            last_update = config.get('last_update')
            if not last_update:
                return True
            
            from datetime import datetime, timezone
            # Parse timestamps and compare dates (UTC)
            last_dt = datetime.fromisoformat(last_update)
            
            # Use UTC for consistent date comparison across timezones
            # If timestamp is naive, treat it as UTC
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            
            current_dt = datetime.now(timezone.utc)
            
            # Check if it's a different calendar day (UTC)
            last_date = last_dt.date()
            current_date = current_dt.date()
            
            return current_date > last_date  # Run if it's a new day
        except Exception as e:
            self.log(f"Could not check last update: {e}", "WARNING")
            return False
    
    def should_run_meta_evolution(self) -> bool:
        """Check if meta-evolution should run (daily at 02:00, after self-evolution)."""
        config_path = Path("meta_agent_config.json")
        if not config_path.exists():
            return False  # Don't run on first execution
        
        try:
            with open(config_path) as f:
                config = json.load(f)
            
            last_update = config.get('last_meta_evolution')
            if not last_update:
                return True
            
            from datetime import datetime, timezone
            # Parse timestamps and compare dates (UTC)
            last_dt = datetime.fromisoformat(last_update)
            
            # Use UTC for consistent date comparison across timezones
            # If timestamp is naive, treat it as UTC
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            
            current_dt = datetime.now(timezone.utc)
            
            # Check if it's a different calendar day (UTC)
            last_date = last_dt.date()
            current_date = current_dt.date()
            
            return current_date > last_date  # Run if it's a new day
        except Exception as e:
            self.log(f"Could not check last meta update: {e}", "WARNING")
            return False
    
    def get_active_self_evolve_agent(self) -> str:
        """Get the currently active self-evolution agent module."""
        try:
            config_path = Path("agent_config.json")
            if config_path.exists():
                with open(config_path) as f:
                    config = json.load(f)
                
                self_evolve_info = config.get('self_evolve_agent', {})
                active = self_evolve_info.get('active', 'a')
                
                # Return module name instead of file path
                if active == 'b':
                    return 'lightjunction.self_evolve_agent_b'
                else:
                    return 'lightjunction.self_evolve_agent_a'
            
            # Fallback to version a
            return 'lightjunction.self_evolve_agent_a'
        except Exception as e:
            self.log(f"Error getting active agent: {e}", "WARNING")
            return 'lightjunction.self_evolve_agent_a'
    
    async def run_self_evolution(self) -> bool:
        """Run self-evolution cycle using the active agent version."""
        active_agent = self.get_active_self_evolve_agent()
        self.log(f"🧬 Starting Self-Evolution (using {active_agent})", "RUNNING")
        
        try:
            # Import and run self-evolution
            result = subprocess.run(
                [sys.executable, "-m", active_agent],
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes max
            )
            
            if result.returncode == 0:
                self.log("Self-Evolution completed successfully", "SUCCESS")
                self.results['tasks']['self_evolution'] = {
                    'status': 'success',
                    'output': result.stdout[-500:] if len(result.stdout) > 500 else result.stdout
                }
                return True
            else:
                self.log(f"Self-Evolution failed: {result.stderr}", "ERROR")
                self.results['tasks']['self_evolution'] = {
                    'status': 'failed',
                    'error': result.stderr[-500:] if len(result.stderr) > 500 else result.stderr
                }
                return False
                
        except subprocess.TimeoutExpired:
            self.log("Self-Evolution timeout", "ERROR")
            self.results['tasks']['self_evolution'] = {
                'status': 'timeout',
                'error': 'Execution exceeded 10 minutes'
            }
            return False
        except Exception as e:
            self.log(f"Self-Evolution error: {e}", "ERROR")
            self.results['tasks']['self_evolution'] = {
                'status': 'error',
                'error': str(e)
            }
            return False
    
    async def run_meta_evolution(self) -> bool:
        """Run meta-evolution cycle."""
        self.log("🧠 Starting Meta-Evolution", "RUNNING")
        
        try:
            result = subprocess.run(
                [sys.executable, "-m", "lightjunction.meta_agent"],
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes max
            )
            
            if result.returncode == 0:
                self.log("Meta-Evolution completed successfully", "SUCCESS")
                self.results['tasks']['meta_evolution'] = {
                    'status': 'success',
                    'output': result.stdout[-500:] if len(result.stdout) > 500 else result.stdout
                }
                return True
            else:
                self.log(f"Meta-Evolution failed: {result.stderr}", "WARNING")
                self.results['tasks']['meta_evolution'] = {
                    'status': 'failed',
                    'error': result.stderr[-500:] if len(result.stderr) > 500 else result.stderr
                }
                return False
                
        except subprocess.TimeoutExpired:
            self.log("Meta-Evolution timeout", "WARNING")
            self.results['tasks']['meta_evolution'] = {
                'status': 'timeout',
                'error': 'Execution exceeded 10 minutes'
            }
            return False
        except Exception as e:
            self.log(f"Meta-Evolution error: {e}", "WARNING")
            self.results['tasks']['meta_evolution'] = {
                'status': 'error',
                'error': str(e)
            }
            return False
    
    def run_readme_update(self) -> bool:
        """Run README update with weekly statistics."""
        self.log("📊 Updating README and Weekly Report", "RUNNING")
        
        try:
            result = subprocess.run(
                [sys.executable, "-m", "lightjunction.update_readme_data"],
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes max
            )
            
            # Capture output for workflow processing
            output = result.stdout
            
            # Extract key outputs
            title_ascii = None
            repo_list = None
            commits = None
            summary = None
            
            # Extract ASCII title
            if 'TITLE_ASCII:' in output:
                ascii_start = output.find('TITLE_ASCII:')
                ascii_end = output.find('Fetching latest repositories...', ascii_start)
                if ascii_start != -1 and ascii_end != -1:
                    title_ascii = output[ascii_start+len('TITLE_ASCII:'):ascii_end].strip()
            
            # Extract other sections
            if '---REPO_LIST_START---' in output:
                start_idx = output.find('---REPO_LIST_START---')
                end_idx = output.find('---REPO_LIST_END---')
                if start_idx != -1 and end_idx != -1:
                    repo_list = output[start_idx+len('---REPO_LIST_START---'):end_idx].strip()
            
            if '---COMMITS_START---' in output:
                start_idx = output.find('---COMMITS_START---')
                end_idx = output.find('---COMMITS_END---')
                if start_idx != -1 and end_idx != -1:
                    commits = output[start_idx+len('---COMMITS_START---'):end_idx].strip()
            
            if '---SUMMARY_START---' in output:
                start_idx = output.find('---SUMMARY_START---')
                end_idx = output.find('---SUMMARY_END---')
                if start_idx != -1 and end_idx != -1:
                    summary = output[start_idx+len('---SUMMARY_START---'):end_idx].strip()
            
            if result.returncode == 0 or title_ascii:  # Success if we got outputs
                self.log("README update completed", "SUCCESS")
                self.results['tasks']['readme_update'] = {
                    'status': 'success',
                    'title_ascii': title_ascii,
                    'has_repo_list': repo_list is not None,
                    'has_commits': commits is not None,
                    'has_summary': summary is not None
                }
                
                # Save outputs for workflow to use
                with open('orchestrator_output.txt', 'w') as f:
                    f.write(output)
                
                return True
            else:
                self.log(f"README update had issues: {result.stderr}", "WARNING")
                self.results['tasks']['readme_update'] = {
                    'status': 'partial',
                    'error': result.stderr[-300:] if result.stderr else None
                }
                return True  # Continue anyway
                
        except subprocess.TimeoutExpired:
            self.log("README update timeout", "ERROR")
            self.results['tasks']['readme_update'] = {
                'status': 'timeout'
            }
            return False
        except Exception as e:
            self.log(f"README update error: {e}", "ERROR")
            self.results['tasks']['readme_update'] = {
                'status': 'error',
                'error': str(e)
            }
            return False
    
    async def run_all(self):
        """Run all tasks in proper order."""
        self.log("=" * 60)
        self.log("🚀 System Orchestrator Starting")
        self.log("=" * 60)
        
        # Task 1: Self-Evolution (if scheduled)
        if self.should_run_self_evolution():
            self.log("Self-evolution is scheduled", "INFO")
            await self.run_self_evolution()
            # Wait a bit for any file writes to complete
            await asyncio.sleep(2)
        else:
            self.log("Self-evolution skipped (not scheduled)", "INFO")
            self.results['tasks']['self_evolution'] = {'status': 'skipped'}
        
        # Task 2: Meta-Evolution (if scheduled and after self-evolution)
        if self.should_run_meta_evolution():
            self.log("Meta-evolution is scheduled", "INFO")
            await self.run_meta_evolution()
            await asyncio.sleep(2)
        else:
            self.log("Meta-evolution skipped (not scheduled)", "INFO")
            self.results['tasks']['meta_evolution'] = {'status': 'skipped'}
        
        # Task 3: README Update (always run)
        self.log("README update is scheduled", "INFO")
        self.run_readme_update()
        
        # Summary
        self.log("=" * 60)
        self.log("📊 Orchestration Summary")
        self.log("=" * 60)
        
        for task, result in self.results['tasks'].items():
            status = result.get('status', 'unknown')
            status_emoji = {
                'success': '✅',
                'failed': '❌',
                'error': '❌',
                'timeout': '⏱️',
                'skipped': '⏭️',
                'partial': '⚠️'
            }.get(status, '❓')
            
            self.log(f"{task}: {status_emoji} {status}")
        
        # Save results
        with open('orchestrator_results.json', 'w') as f:
            json.dump(self.results, f, indent=2)
        
        self.log("=" * 60)
        self.log("🏁 Orchestration Complete")
        self.log("=" * 60)
        
        # Return success if critical tasks succeeded
        readme_ok = self.results['tasks'].get('readme_update', {}).get('status') in ['success', 'partial']
        return readme_ok


async def main():
    """Main entry point."""
    orchestrator = SystemOrchestrator()
    success = await orchestrator.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
