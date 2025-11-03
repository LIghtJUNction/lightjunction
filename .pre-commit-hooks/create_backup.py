#!/usr/bin/env python3
"""
Create Backup Before Evolution Changes
=======================================

Automatically backs up critical files before committing evolution changes.
"""

import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def get_staged_files():
    """Get list of staged files."""
    result = subprocess.run(
        ['git', 'diff', '--cached', '--name-only'],
        capture_output=True,
        text=True
    )
    return result.stdout.strip().split('\n') if result.stdout else []


def create_backups():
    """Create backups of critical evolution files if they're being modified."""
    staged = get_staged_files()
    
    # Critical files that need backup
    critical_files = [
        'self_evolve_agent.py',
        'orchestrator.py',
        'agent_config.json',
        'meta_agent_config.json'
    ]
    
    backup_dir = Path('.backups')
    backup_dir.mkdir(exist_ok=True)
    
    backed_up = []
    
    for file in critical_files:
        if file in staged and Path(file).exists():
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_name = f"{file}.backup.{timestamp}"
            backup_path = backup_dir / backup_name
            
            try:
                shutil.copy2(file, backup_path)
                backed_up.append(f"{file} -> {backup_path}")
            except Exception as e:
                print(f"⚠️  Could not backup {file}: {e}")
    
    if backed_up:
        print(f"💾 Created {len(backed_up)} backup(s):")
        for backup in backed_up:
            print(f"  - {backup}")
        
        # Add .backups to .gitignore if not already there
        gitignore = Path('.gitignore')
        if gitignore.exists():
            with open(gitignore, 'r') as f:
                content = f.read()
            if '.backups/' not in content:
                with open(gitignore, 'a') as f:
                    f.write('\n# Evolution system backups\n.backups/\n')
    
    return True


def main():
    """Main backup creation."""
    try:
        create_backups()
        sys.exit(0)
    except Exception as e:
        print(f"❌ Backup creation failed: {e}")
        # Don't fail the commit, just warn
        sys.exit(0)


if __name__ == "__main__":
    main()
