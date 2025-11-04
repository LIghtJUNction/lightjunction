"""
Meta-Agent System (IMMUTABLE)
==============================

⚠️ WARNING: THIS FILE IS IMMUTABLE AND MUST NOT BE MODIFIED ⚠️

This meta-agent monitors and improves the self_evolve_agent.py itself.
It creates a closed-loop system where:
1. self_evolve_agent.py evolves application code (a/b versions)
2. meta_agent.py evolves self_evolve_agent.py based on its performance

Version: 1.0.0-IMMUTABLE-FINAL
DO NOT MODIFY THIS FILE UNDER ANY CIRCUMSTANCES
"""

import os
import sys
import json
import asyncio
import hashlib
from datetime import datetime
from pathlib import Path

# Immutable constants - These define the system structure
IMMUTABLE_VERSION = "1.0.0"
SELF_EVOLVE_SCRIPT = "self_evolve_agent.py"
META_CONFIG_FILE = "meta_agent_config.json"
EVOLUTION_LOG_FILE = "evolution_log.txt"

try:
    from agents import Agent, Runner
except ImportError:
    print("Warning: openai-agents not installed.")
    Agent = None
    Runner = None


class MetaAgent:
    """
    IMMUTABLE Meta-Agent that improves the self-evolution system itself.
    
    This agent is the top-level supervisor that:
    - Monitors evolution results
    - Analyzes performance patterns
    - Improves the self_evolve_agent.py script
    - Maintains system integrity
    """
    
    def __init__(self):
        self.config_path = META_CONFIG_FILE
        self.load_or_create_config()
        
        # Calculate and verify immutability
        self.verify_immutability()
    
    def verify_immutability(self):
        """Verify this meta-agent script hasn't been modified."""
        # In production, you would check against a hardcoded hash
        # For now, we just log the current state
        script_path = __file__
        with open(script_path, 'rb') as f:
            content = f.read()
            current_hash = hashlib.sha256(content).hexdigest()
        
        if 'immutable_hash' not in self.config:
            self.config['immutable_hash'] = current_hash
            self.save_config()
        else:
            stored_hash = self.config['immutable_hash']
            if current_hash != stored_hash:
                print("⚠️  WARNING: Meta-agent has been modified!")
                print(f"   Expected: {stored_hash}")
                print(f"   Current:  {current_hash}")
                print("   This may affect system stability.")
    
    def load_or_create_config(self):
        """Load or create meta-agent configuration."""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
        else:
            self.config = {
                'version': IMMUTABLE_VERSION,
                'created_at': datetime.now().isoformat(),
                'meta_evolution_history': [],
                'performance_metrics': [],
                'improvement_count': 0,
                'last_meta_evolution': None
            }
            self.save_config()
    
    def save_config(self):
        """Save meta-agent configuration."""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def load_agent_config(self):
        """Load the agent_config.json to analyze performance."""
        try:
            with open('agent_config.json', 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Could not load agent config: {e}")
            return None
    
    def load_evolution_log(self):
        """Load the latest evolution log if available."""
        if os.path.exists(EVOLUTION_LOG_FILE):
            with open(EVOLUTION_LOG_FILE, 'r') as f:
                return f.read()
        return None
    
    def analyze_performance(self, agent_config, evolution_log):
        """
        Analyze the performance of self_evolve_agent.py.
        
        Returns metrics about:
        - Success rate
        - Common failure patterns
        - Performance bottlenecks
        - Improvement opportunities
        """
        if not agent_config:
            return None
        
        history = agent_config.get('evolution_history', [])
        
        if not history:
            return {
                'total_cycles': 0,
                'success_rate': 0.0,
                'common_failures': [],
                'needs_improvement': True,
                'analysis': 'No evolution history available yet.'
            }
        
        # Calculate metrics
        total_cycles = len(history)
        successful_cycles = 0
        failed_files = []
        failure_reasons = {}
        
        for record in history:
            results = record.get('results', [])
            cycle_success = all(r.get('status') == 'success' for r in results)
            
            if cycle_success:
                successful_cycles += 1
            
            for result in results:
                if result.get('status') == 'failed':
                    failed_files.append(result.get('file'))
                    reason = result.get('reason', 'Unknown')
                    failure_reasons[reason] = failure_reasons.get(reason, 0) + 1
        
        success_rate = (successful_cycles / total_cycles * 100) if total_cycles > 0 else 0
        
        # Identify most common failures
        common_failures = sorted(failure_reasons.items(), key=lambda x: x[1], reverse=True)[:3]
        
        return {
            'total_cycles': total_cycles,
            'successful_cycles': successful_cycles,
            'success_rate': success_rate,
            'common_failures': common_failures,
            'failed_files': list(set(failed_files)),
            'needs_improvement': success_rate < 80.0,
            'analysis': f"Success rate: {success_rate:.1f}%. Most common issue: {common_failures[0][0] if common_failures else 'None'}"
        }
    
    async def improve_self_evolve_script(self, performance_metrics):
        """
        Use AI to improve the self_evolve_agent script based on performance.
        
        This is the core meta-learning function.
        Improves the currently ACTIVE version as a baseline.
        """
        if Agent is None or Runner is None:
            print("OpenAI Agents SDK not available, skipping improvement")
            return None
        
        # Read the currently ACTIVE self-evolve script to use as baseline
        try:
            with open('agent_config.json', 'r') as f:
                config = json.load(f)
            self_evolve_info = config.get('self_evolve_agent', {})
            active_version = self_evolve_info.get('active', 'a')
            active_file = self_evolve_info.get(active_version, 'self_evolve_agent_a.py')
            
            with open(active_file, 'r') as f:
                current_code = f.read()
            
            print(f"📖 Using active version {active_version} ({active_file}) as baseline")
        except Exception as e:
            print(f"⚠️  Could not read active version, using fallback: {e}")
            with open('self_evolve_agent_a.py', 'r') as f:
                current_code = f.read()
        
        # Create analysis prompt
        system_instructions = """You are a meta-level AI system architect.
Your task is to improve the self-evolution agent system based on performance metrics.

Focus on:
1. Fixing common failure patterns
2. Improving success rates
3. Enhancing error handling
4. Optimizing the evolution logic
5. Better test validation

Maintain all core functionality and API compatibility."""

        prompt = f"""Analyze and improve the self-evolution agent code based on these performance metrics:

Performance Metrics:
{json.dumps(performance_metrics, indent=2)}

Current Code:
```python
{current_code}
```

Provide:
1. Specific improvements to address the identified issues
2. Updated code that fixes the problems
3. Explanation of changes

Return the improved code wrapped in ```python``` markers."""

        try:
            # Create meta-agent
            meta_agent = Agent(
                name="Meta Evolution Agent",
                instructions=system_instructions,
                model="gpt-4o-mini"
            )
            
            # Run meta-agent
            result = await Runner.run(
                starting_agent=meta_agent,
                input=prompt
            )
            
            response = result.final_output if hasattr(result, 'final_output') else str(result)
            
            # Extract improved code
            if '```python' in response:
                start = response.find('```python') + 9
                end = response.rfind('```')
                improved_code = response[start:end].strip()
                
                return improved_code
            
            return None
            
        except Exception as e:
            print(f"Meta-improvement failed: {e}")
            return None
    
    def validate_improved_script(self, improved_code):
        """
        Validate that the improved script is still functional.
        
        Performs:
        - Syntax check
        - Import verification
        - Structure validation
        """
        # Save to temporary file
        temp_file = f"{SELF_EVOLVE_SCRIPT}.tmp"
        
        try:
            with open(temp_file, 'w') as f:
                f.write(improved_code)
            
            # Syntax check
            import subprocess
            result = subprocess.run(
                ['python', '-m', 'py_compile', temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                return False, f"Syntax error: {result.stderr}"
            
            # Try to import and check for required classes
            result = subprocess.run(
                ['python', '-c', f'import importlib.util; spec = importlib.util.spec_from_file_location("test", "{temp_file}"); module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); assert hasattr(module, "SelfEvolvingAgent")'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                return False, f"Structure validation failed: {result.stderr}"
            
            return True, "Validation passed"
            
        except Exception as e:
            return False, f"Validation error: {e}"
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)
    
    def get_next_self_evolve_version(self):
        """Get the next version of self_evolve_agent to improve (A/B iteration)."""
        try:
            with open('agent_config.json', 'r') as f:
                config = json.load(f)
            
            self_evolve_info = config.get('self_evolve_agent', {})
            current_active = self_evolve_info.get('active', 'a')
            
            # Improve the non-active version
            next_version = 'b' if current_active == 'a' else 'a'
            return next_version, self_evolve_info.get(next_version, f'self_evolve_agent_{next_version}.py')
        except Exception as e:
            print(f"Error getting next version: {e}")
            return 'b', 'self_evolve_agent_b.py'
    
    def apply_improvement(self, improved_code):
        """
        Apply the improved code to the non-active self_evolve_agent version.
        
        Uses A/B iteration: improves the version that's NOT currently active.
        Creates backup before applying.
        """
        # Get the version to improve
        next_version, target_file = self.get_next_self_evolve_version()
        
        print(f"📝 Applying improvement to version {next_version}: {target_file}")
        
        # Create backup
        backup_file = f"{target_file}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # Backup current version
            if os.path.exists(target_file):
                with open(target_file, 'r') as f:
                    current_code = f.read()
                
                with open(backup_file, 'w') as f:
                    f.write(current_code)
            
            # Apply improvement
            with open(target_file, 'w') as f:
                f.write(improved_code)
            
            print(f"✅ Improvement applied successfully to {target_file}")
            print(f"📦 Backup saved: {backup_file}")
            
            # The active version will be switched by self_evolve_agent on next run
            print(f"ℹ️  Active version will switch to {next_version} after validation")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to apply improvement: {e}")
            # Restore from backup if exists
            if os.path.exists(backup_file):
                with open(backup_file, 'r') as f:
                    backup_code = f.read()
                with open(target_file, 'w') as f:
                    f.write(backup_code)
                print(f"🔄 Restored from backup")
            
            return False
    
    async def run_meta_evolution(self):
        """
        Run one meta-evolution cycle.
        
        This improves the self_evolve_agent.py based on its performance.
        """
        print("=" * 70)
        print("🧠 META-AGENT: Self-Evolution System Improvement")
        print("=" * 70)
        print(f"Version: {IMMUTABLE_VERSION} (IMMUTABLE)")
        print(f"Time: {datetime.now().isoformat()}")
        print()
        
        # Step 1: Load and analyze performance
        print("📊 Step 1: Analyzing performance...")
        agent_config = self.load_agent_config()
        evolution_log = self.load_evolution_log()
        
        if not agent_config:
            print("⚠️  No agent configuration found. Skipping meta-evolution.")
            return
        
        performance = self.analyze_performance(agent_config, evolution_log)
        
        print(f"   Total cycles: {performance['total_cycles']}")
        print(f"   Success rate: {performance['success_rate']:.1f}%")
        print(f"   Needs improvement: {performance['needs_improvement']}")
        
        if performance['common_failures']:
            print(f"   Common failures:")
            for reason, count in performance['common_failures']:
                print(f"     - {reason}: {count} times")
        
        # Store metrics
        self.config['performance_metrics'].append({
            'timestamp': datetime.now().isoformat(),
            'metrics': performance
        })
        
        # Step 2: Decide if improvement is needed
        if not performance['needs_improvement'] and performance['total_cycles'] > 0:
            print("\n✅ System performing well. No improvement needed.")
            self.save_config()
            return
        
        if performance['total_cycles'] == 0:
            print("\n⏳ Waiting for more evolution cycles before improving.")
            self.save_config()
            return
        
        # Step 3: Generate improvements
        print("\n🤖 Step 2: Generating improvements with AI...")
        improved_code = await self.improve_self_evolve_script(performance)
        
        if not improved_code:
            print("❌ Could not generate improvements")
            self.save_config()
            return
        
        print("✅ Improvements generated")
        
        # Step 4: Validate
        print("\n🧪 Step 3: Validating improvements...")
        valid, message = self.validate_improved_script(improved_code)
        
        if not valid:
            print(f"❌ Validation failed: {message}")
            self.save_config()
            return
        
        print(f"✅ {message}")
        
        # Step 5: Apply
        print("\n💾 Step 4: Applying improvements...")
        success = self.apply_improvement(improved_code)
        
        if success:
            self.config['improvement_count'] += 1
            self.config['last_meta_evolution'] = datetime.now().isoformat()
            
            # Record meta-evolution
            self.config['meta_evolution_history'].append({
                'timestamp': datetime.now().isoformat(),
                'performance_before': performance,
                'success': True
            })
            
            print("\n" + "=" * 70)
            print("🎉 META-EVOLUTION COMPLETE")
            print("=" * 70)
            print(f"Total improvements made: {self.config['improvement_count']}")
        
        self.save_config()


async def main_async():
    """Run meta-agent (async)."""
    meta = MetaAgent()
    await meta.run_meta_evolution()


def main():
    """
    Main entry point for meta-agent.
    
    ⚠️ THIS FUNCTION IS IMMUTABLE ⚠️
    """
    print(f"\n{'='*70}")
    print(f"META-AGENT v{IMMUTABLE_VERSION} - IMMUTABLE SYSTEM SUPERVISOR")
    print(f"{'='*70}\n")
    
    asyncio.run(main_async())


if __name__ == "__main__":
    # DO NOT MODIFY THIS BLOCK
    main()
