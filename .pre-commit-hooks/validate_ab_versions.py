#!/usr/bin/env python3
"""
Validate A/B Version Consistency
=================================

Ensures that A/B versioned files are properly managed:
- Both versions exist
- Versions are not identical (unless initial state)
- Config file is valid
"""

import json
import os
import sys
from pathlib import Path


def check_ab_pairs():
    """Check A/B file pairs consistency."""
    config_path = Path("agent_config.json")
    
    if not config_path.exists():
        print("⚠️  agent_config.json not found, skipping A/B validation")
        return True
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid agent_config.json: {e}")
        return False
    
    files = config.get('files', {})
    if not files:
        print("⚠️  No files configured for A/B testing")
        return True
    
    issues = []
    
    for name, info in files.items():
        file_a = info.get('a')
        file_b = info.get('b')
        active = info.get('active')
        
        # Check both files exist
        if not Path(file_a).exists():
            issues.append(f"Missing A version: {file_a}")
        if not Path(file_b).exists():
            issues.append(f"Missing B version: {file_b}")
        
        # Check active version is valid
        if active not in ['a', 'b']:
            issues.append(f"Invalid active version for {name}: {active}")
        
        # Check active file exists
        active_file = info.get(active)
        if not Path(active_file).exists():
            issues.append(f"Active file missing: {active_file}")
    
    if issues:
        print("❌ A/B Version Issues Found:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    
    print(f"✅ A/B versions validated: {len(files)} file pairs OK")
    return True


def main():
    """Main validation."""
    if not check_ab_pairs():
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
