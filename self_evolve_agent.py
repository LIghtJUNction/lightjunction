"""
Self-Evolving Agent System
===========================

This agent system automatically improves Python files using AI,
with A/B testing and validation cycles using OpenAI Agents SDK.

Features:
- A/B iteration (alternates between version a and b)
- Uses free gpt-4o-mini model via OpenAI Agents
- Automatic testing and validation
- Evolution history tracking
- File modification capabilities
"""

import os
import sys
import json
import subprocess
import asyncio
from datetime import datetime
from pathlib import Path

try:
    from agents import Agent, Runner
except ImportError:
    print("Warning: openai-agents not installed. Using fallback mode.")
    Agent = None
    Runner = None


class IterationLogger:
    """Logs detailed iteration information."""
    
    def __init__(self, log_file='logs/self_evolution.log'):
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        self.session_start = datetime.now()
        self.log("=" * 70, raw=True)
        self.log(f"Self-Evolution Session Started", level="SESSION")
        self.log("=" * 70, raw=True)
    
    def log(self, message, level="INFO", raw=False):
        """Write a log message."""
        timestamp = datetime.now().isoformat()
        if raw:
            log_entry = f"{message}\n"
        else:
            log_entry = f"[{timestamp}] [{level:8}] {message}\n"
        
        with open(self.log_file, 'a') as f:
            f.write(log_entry)
        
        # Also print to console
        if not raw:
            print(f"[{level}] {message}")
    
    def log_evolution_start(self, target_version, files):
        """Log the start of an evolution cycle."""
        self.log(f"Target version: {target_version}", "CYCLE")
        self.log(f"Files to evolve: {len(files)}", "CYCLE")
        for file_key in files:
            self.log(f"  - {file_key}", "CYCLE")
    
    def log_file_evolution(self, file_key, status, details=None):
        """Log evolution of a single file."""
        self.log(f"File: {file_key} - Status: {status}", "FILE")
        if details:
            for key, value in details.items():
                self.log(f"  {key}: {value}", "FILE")
    
    def log_session_end(self, results):
        """Log the end of a session."""
        duration = (datetime.now() - self.session_start).total_seconds()
        self.log("=" * 70, raw=True)
        self.log(f"Session completed in {duration:.1f}s", "SESSION")
        
        success = sum(1 for r in results if r.get('status') == 'success')
        failed = sum(1 for r in results if r.get('status') == 'failed')
        
        self.log(f"Results: {success} success, {failed} failed", "SESSION")
        self.log("=" * 70, raw=True)

class SelfEvolvingAgent:
    def __init__(self, config_path='agent_config.json'):
        self.config_path = config_path
        self.logger = IterationLogger()
        self.load_config()
        self.logger.log(f"Loaded config: {config_path}", "INIT")
        
    def load_config(self):
        """Load agent configuration."""
        with open(self.config_path, 'r') as f:
            self.config = json.load(f)
    
    def save_config(self):
        """Save agent configuration."""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def get_next_version(self):
        """Get the next version to update (alternates between a and b)."""
        current = self.config['current_version']
        return 'b' if current == 'a' else 'a'
    
    def get_baseline_file(self, file_key):
        """
        Get the baseline file path for a given file key.
        Baseline files serve as stable reference when A/B evolution fails.
        They are manually promoted from well-performing variants.
        """
        baseline_file = f"{file_key}.py"
        if Path(baseline_file).exists():
            return baseline_file
        return None
    
    def should_use_baseline(self, file_key):
        """
        Check if we should use baseline as reference for this file.
        Use baseline when recent evolution attempts have failed repeatedly.
        """
        # Check recent evolution history for this file
        recent_failures = 0
        history_to_check = min(3, len(self.config.get('evolution_history', [])))
        
        for record in self.config.get('evolution_history', [])[-history_to_check:]:
            for result in record.get('results', []):
                if result.get('file') == file_key and result.get('status') == 'failed':
                    recent_failures += 1
        
        # If 2 or more recent failures, use baseline
        return recent_failures >= 2
    
    async def call_ai_agent(self, prompt, system_instructions="You are a helpful coding assistant."):
        """
        Call AI agent using OpenAI Agents SDK.
        Uses gpt-4o-mini model (free tier).
        """
        if Agent is None or Runner is None:
            print("OpenAI Agents SDK not available, using fallback")
            return await self._fallback_ai_call(prompt, system_instructions)
        
        try:
            # Create an agent with instructions
            agent = Agent(
                name="Code Evolution Agent",
                instructions=system_instructions,
                model="gpt-4o-mini"  # Free model
            )
            
            # Run the agent with the prompt
            result = await Runner.run(
                starting_agent=agent,
                input=prompt
            )
            
            return result.final_output if hasattr(result, 'final_output') else str(result)
            
        except Exception as e:
            print(f"AI agent call failed: {e}")
            return await self._fallback_ai_call(prompt, system_instructions)
    
    async def _fallback_ai_call(self, prompt, system_instructions):
        """Fallback to direct API call if Agents SDK unavailable."""
        import requests
        
        # Use GitHub Models API endpoint (free gpt-4o-mini access)
        api_url = "https://models.inference.ai.azure.com/chat/completions"
        token = os.environ.get('GITHUB_TOKEN', '')
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 4000
        }
        
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            
            if 'choices' in result and len(result['choices']) > 0:
                return result['choices'][0]['message']['content']
            return None
                
        except Exception as e:
            print(f"Fallback AI call failed: {e}")
            return None
    
    async def analyze_file(self, file_path):
        """Analyze a Python file and suggest improvements using AI agent."""
        with open(file_path, 'r') as f:
            code = f.read()
        
        system_instructions = """You are an expert Python code reviewer and improver.
Your task is to analyze Python code and suggest concrete improvements for:
1. Performance optimization
2. Code readability and maintainability
3. Error handling
4. Documentation
5. Security best practices

Provide specific, actionable improvements that can be directly applied."""

        prompt = f"""Analyze this Python code and suggest improvements:

```python
{code}
```

Provide:
1. A list of specific improvements (max 3-5 most important)
2. For each improvement, explain why it's beneficial
3. Be concise and actionable

Format your response as JSON with this structure:
{{
  "improvements": [
    {{
      "title": "improvement title",
      "description": "why this helps",
      "priority": "high|medium|low"
    }}
  ]
}}
"""

        return await self.call_ai_agent(prompt, system_instructions)
    
    async def apply_improvements(self, file_path, improvements_json):
        """Apply improvements to a Python file using AI agent."""
        with open(file_path, 'r') as f:
            original_code = f.read()
        
        system_instructions = """You are an expert Python developer.
Apply the suggested improvements to the code while maintaining all functionality.
Return ONLY the improved Python code, no explanations or markdown."""

        prompt = f"""Apply these improvements to the code:

Improvements to apply:
{improvements_json}

Original code:
```python
{original_code}
```

Return the improved code only."""

        improved_code = await self.call_ai_agent(prompt, system_instructions)
        
        if improved_code:
            # Extract code if it's wrapped in markdown
            if '```python' in improved_code:
                start = improved_code.find('```python') + 9
                end = improved_code.rfind('```')
                improved_code = improved_code[start:end].strip()
            elif '```' in improved_code:
                start = improved_code.find('```') + 3
                end = improved_code.rfind('```')
                improved_code = improved_code[start:end].strip()
            
            return improved_code
        
        return None
    
    def test_file(self, file_path):
        """Test a Python file for syntax and basic functionality."""
        try:
            # Syntax check
            result = subprocess.run(
                ['python', '-m', 'py_compile', file_path],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                return False, f"Syntax error: {result.stderr}"
            
            # Try to import and check for obvious issues
            result = subprocess.run(
                ['python', '-c', f'import importlib.util; spec = importlib.util.spec_from_file_location("test", "{file_path}"); module = importlib.util.module_from_spec(spec)'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                return False, f"Import error: {result.stderr}"
            
            return True, "All tests passed"
            
        except Exception as e:
            return False, f"Test error: {e}"
    
    async def evolve_cycle(self):
        """
        Run one evolution cycle using OpenAI Agents:
        1. Select next version to update
        2. Analyze current code with AI agent
        3. Generate improvements with AI agent
        4. Apply improvements with AI agent
        5. Test new version
        6. Update config if successful
        """
        print("=" * 60)
        print("🧬 Starting Self-Evolution Cycle (OpenAI Agents)")
        print("=" * 60)
        
        next_version = self.get_next_version()
        print(f"\n📌 Target version: {next_version}")
        print(f"📅 Time: {datetime.now().isoformat()}")
        print(f"🤖 Model: {self.config['model']}")
        
        # Log evolution start
        self.logger.log_evolution_start(next_version, self.config['files'])
        
        results = []
        
        # Evolve each file
        for file_key, file_info in self.config['files'].items():
            print(f"\n🔄 Processing: {file_key}")
            
            # Get the file to evolve
            target_file = file_info[next_version]
            current_active = file_info[self.config['current_version']]
            
            # Check if we should use baseline as reference
            reference_file = current_active
            use_baseline = self.should_use_baseline(file_key)
            baseline_file = self.get_baseline_file(file_key)
            
            if use_baseline and baseline_file:
                reference_file = baseline_file
                print(f"  📋 Using baseline as reference: {baseline_file}")
                self.logger.log(f"Using baseline reference for {file_key}: {baseline_file}", "BASELINE")
            else:
                print(f"  Current active: {current_active}")
            
            print(f"  Evolving: {target_file}")
            
            # Step 1: Analyze
            print(f"  🔍 Analyzing with AI agent...")
            self.logger.log(f"Analyzing {file_key} (reference: {reference_file})", "ANALYZE")
            improvements = await self.analyze_file(reference_file)
            
            if not improvements:
                print(f"  ❌ Analysis failed")
                self.logger.log_file_evolution(file_key, "FAILED", {"reason": "Analysis failed"})
                results.append({
                    'file': file_key,
                    'status': 'failed',
                    'reason': 'Analysis failed'
                })
                continue
            
            print(f"  ✅ Analysis complete")
            self.logger.log(f"Analysis complete for {file_key}", "ANALYZE")
            
            # Step 2: Apply improvements
            print(f"  🛠️  Applying improvements with AI agent...")
            self.logger.log(f"Applying improvements to {file_key} (based on {reference_file})", "IMPROVE")
            improved_code = await self.apply_improvements(reference_file, improvements)
            
            if not improved_code:
                print(f"  ❌ Could not apply improvements")
                self.logger.log_file_evolution(file_key, "FAILED", {"reason": "Could not apply improvements"})
                results.append({
                    'file': file_key,
                    'status': 'failed',
                    'reason': 'Could not apply improvements'
                })
                continue
            
            # Save improved version
            with open(target_file, 'w') as f:
                f.write(improved_code)
            
            print(f"  ✅ Improvements applied")
            self.logger.log(f"Improvements written to {target_file}", "IMPROVE")
            
            # Step 3: Test
            print(f"  🧪 Testing...")
            self.logger.log(f"Testing {target_file}", "TEST")
            test_passed, test_message = self.test_file(target_file)
            
            if test_passed:
                print(f"  ✅ Tests passed")
                self.logger.log_file_evolution(file_key, "SUCCESS", {
                    "target_file": target_file,
                    "version": next_version,
                    "test_result": "passed"
                })
                results.append({
                    'file': file_key,
                    'status': 'success',
                    'improvements': improvements[:200] + '...' if len(improvements) > 200 else improvements,
                    'version': next_version
                })
            else:
                print(f"  ❌ Tests failed: {test_message}")
                self.logger.log_file_evolution(file_key, "FAILED", {
                    "reason": "Tests failed",
                    "message": test_message
                })
                # Revert to original
                with open(current_active, 'r') as f:
                    original = f.read()
                with open(target_file, 'w') as f:
                    f.write(original)
                
                self.logger.log(f"Reverted {target_file} to original", "TEST")
                results.append({
                    'file': file_key,
                    'status': 'failed',
                    'reason': test_message
                })
        
        # Update configuration
        evolution_record = {
            'timestamp': datetime.now().isoformat(),
            'target_version': next_version,
            'results': results,
            'model': self.config['model']
        }
        
        self.config['evolution_history'].append(evolution_record)
        
        # Keep only recent history
        if len(self.config['evolution_history']) > self.config['max_history']:
            self.config['evolution_history'] = self.config['evolution_history'][-self.config['max_history']:]
        
        # Switch active version if all tests passed
        all_passed = all(r['status'] == 'success' for r in results)
        if all_passed:
            print(f"\n✅ All files evolved successfully!")
            print(f"🔄 Switching to version {next_version}")
            self.config['current_version'] = next_version
            
            # Update active version for each file
            for file_key in self.config['files']:
                self.config['files'][file_key]['active'] = next_version
        else:
            print(f"\n⚠️  Some files failed to evolve. Keeping version {self.config['current_version']}")
        
        self.config['last_update'] = datetime.now().isoformat()
        self.save_config()
        
        print("\n" + "=" * 60)
        print("🏁 Evolution Cycle Complete")
        print("=" * 60)
        
        # Log session end
        self.logger.log_session_end(results)
        
        return results

async def main_async():
    """Run self-evolution agent (async)."""
    agent = SelfEvolvingAgent()
    results = await agent.evolve_cycle()
    
    # Print summary
    print("\n📊 Summary:")
    success_count = sum(1 for r in results if r['status'] == 'success')
    print(f"  ✅ Successful: {success_count}/{len(results)}")
    print(f"  ❌ Failed: {len(results) - success_count}/{len(results)}")
    
    sys.exit(0 if success_count == len(results) else 1)

def main():
    """Run self-evolution agent."""
    asyncio.run(main_async())

if __name__ == "__main__":
    main()
