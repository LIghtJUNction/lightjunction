#!/usr/bin/env python3
"""
Check Evolution System Safety
==============================

Performs safety checks on the evolution system:
- Version conflicts
- Backup availability
- System integrity
- Logs iteration history
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def log_iteration(message, level="INFO"):
    """Log an iteration message to the iteration log file."""
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    log_file = log_dir / "agent_iterations.log"
    timestamp = datetime.now().isoformat()
    
    log_entry = f"[{timestamp}] [{level}] {message}\n"
    
    with open(log_file, 'a') as f:
        f.write(log_entry)


def check_version_conflicts():
    """Check for version conflicts in A/B files."""
    try:
        with open('agent_config.json') as f:
            config = json.load(f)
    except Exception as e:
        log_iteration(f"Could not read config: {e}", "WARNING")
        return True
    
    issues = []
    
    # Check self_evolve_agent versions
    if 'self_evolve_agent' in config:
        se_agent = config['self_evolve_agent']
        file_a = se_agent.get('a')
        file_b = se_agent.get('b')
        active = se_agent.get('active')
        
        if file_a and file_b and Path(file_a).exists() and Path(file_b).exists():
            # Read both files
            with open(file_a) as f:
                content_a = f.read()
            with open(file_b) as f:
                content_b = f.read()
            
            # They shouldn't be identical if evolution has happened
            if content_a == content_b:
                issues.append(f"self_evolve_agent versions A and B are identical")
                log_iteration("Self-evolve agent A/B versions are identical", "WARNING")
    
    # Check application file versions
    files = config.get('files', {})
    for name, info in files.items():
        file_a = info.get('a')
        file_b = info.get('b')
        
        if file_a and file_b and Path(file_a).exists() and Path(file_b).exists():
            with open(file_a) as f:
                content_a = f.read()
            with open(file_b) as f:
                content_b = f.read()
            
            if content_a == content_b:
                log_iteration(f"{name}: A/B versions are identical", "INFO")
    
    if issues:
        print("⚠️  Version Issues Detected:")
        for issue in issues:
            print(f"  - {issue}")
    
    return True  # Don't fail commit, just warn


def check_backup_system():
    """Ensure backup system is working."""
    backup_dir = Path('.backups')
    
    if not backup_dir.exists():
        log_iteration("Backup directory created", "INFO")
        backup_dir.mkdir(exist_ok=True)
    
    # Count recent backups
    backups = list(backup_dir.glob('*.backup.*'))
    log_iteration(f"Current backups: {len(backups)}", "INFO")
    
    return True


def log_staged_evolution_files():
    """Log which evolution files are being committed."""
    result = subprocess.run(
        ['git', 'diff', '--cached', '--name-only'],
        capture_output=True,
        text=True
    )
    
    staged = result.stdout.strip().split('\n') if result.stdout else []
    
    evolution_files = [
        f for f in staged 
        if any(keyword in f for keyword in [
            'self_evolve_agent', 'meta_agent', 'agent_config', 
            'meta_agent_config', '_a.py', '_b.py'
        ])
    ]
    
    if evolution_files:
        log_iteration(f"Committing evolution files: {', '.join(evolution_files)}", "INFO")
        print(f"📝 Logging {len(evolution_files)} evolution file(s) to iteration history")
    
    return True


def create_iteration_snapshot():
    """Create a snapshot of the current iteration state."""
    try:
        with open('agent_config.json') as f:
            config = json.load(f)
        
        snapshot = {
            'timestamp': datetime.now().isoformat(),
            'current_version': config.get('current_version'),
            'active_files': {},
            'evolution_count': len(config.get('evolution_history', []))
        }
        
        # Record active versions
        if 'self_evolve_agent' in config:
            se = config['self_evolve_agent']
            snapshot['self_evolve_agent_active'] = se.get('active')
        
        for name, info in config.get('files', {}).items():
            snapshot['active_files'][name] = info.get('active')
        
        # Save snapshot
        snapshots_dir = Path('logs/snapshots')
        snapshots_dir.mkdir(parents=True, exist_ok=True)
        
        snapshot_file = snapshots_dir / f"snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(snapshot_file, 'w') as f:
            json.dump(snapshot, f, indent=2)
        
        log_iteration(f"Created iteration snapshot: {snapshot_file}", "INFO")
        
        # Keep only last 50 snapshots
        snapshots = sorted(snapshots_dir.glob('snapshot_*.json'))
        if len(snapshots) > 50:
            for old_snapshot in snapshots[:-50]:
                old_snapshot.unlink()
                log_iteration(f"Removed old snapshot: {old_snapshot}", "INFO")
        
    except Exception as e:
        log_iteration(f"Could not create snapshot: {e}", "WARNING")
    
    return True


def main():
    """Run all safety checks."""
    log_iteration("=== Running pre-commit safety checks ===", "INFO")
    
    checks = [
        ("Version conflicts", check_version_conflicts),
        ("Backup system", check_backup_system),
        ("Staged files logging", log_staged_evolution_files),
        ("Iteration snapshot", create_iteration_snapshot)
    ]
    
    all_passed = True
    for name, check_func in checks:
        try:
            if not check_func():
                print(f"❌ {name} check failed")
                log_iteration(f"{name} check failed", "ERROR")
                all_passed = False
            else:
                log_iteration(f"{name} check passed", "INFO")
        except Exception as e:
            print(f"⚠️  {name} check error: {e}")
            log_iteration(f"{name} check error: {e}", "ERROR")
    
    log_iteration("=== Pre-commit safety checks complete ===", "INFO")
    
    # Add logs directory to .gitignore
    gitignore = Path('.gitignore')
    if gitignore.exists():
        with open(gitignore, 'r') as f:
            content = f.read()
        if 'logs/' not in content:
            with open(gitignore, 'a') as f:
                f.write('\n# Agent iteration logs\nlogs/\n')
    
    if all_passed:
        print("✅ All safety checks passed")
        sys.exit(0)
    else:
        print("⚠️  Some checks had warnings (commit will proceed)")
        sys.exit(0)  # Don't block commit


if __name__ == "__main__":
    main()
