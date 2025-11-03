#!/usr/bin/env python3
"""
Validate Configuration JSON Files
==================================

Validates agent configuration files for correctness.
"""

import json
import sys
from pathlib import Path


def validate_agent_config(filepath):
    """Validate agent_config.json structure."""
    try:
        with open(filepath) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {filepath}: {e}")
        return False
    
    # Check required fields
    required = ['version', 'iteration_cycle', 'current_version', 'files']
    missing = [field for field in required if field not in config]
    
    if missing:
        print(f"❌ Missing required fields in {filepath}: {', '.join(missing)}")
        return False
    
    # Validate self_evolve_agent section
    if 'self_evolve_agent' in config:
        se_agent = config['self_evolve_agent']
        if 'a' not in se_agent or 'b' not in se_agent or 'active' not in se_agent:
            print(f"❌ Invalid self_evolve_agent structure in {filepath}")
            return False
        
        # Check files exist
        for version in ['a', 'b']:
            file = se_agent[version]
            if not Path(file).exists():
                print(f"⚠️  Self-evolve agent file not found: {file}")
    
    # Validate files section
    files = config['files']
    for name, info in files.items():
        if 'a' not in info or 'b' not in info or 'active' not in info:
            print(f"❌ Invalid structure for file '{name}' in {filepath}")
            return False
        
        # Check active is valid
        if info['active'] not in ['a', 'b']:
            print(f"❌ Invalid active version for '{name}': {info['active']}")
            return False
    
    print(f"✅ {filepath} is valid")
    return True


def validate_meta_config(filepath):
    """Validate meta_agent_config.json structure."""
    try:
        with open(filepath) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {filepath}: {e}")
        return False
    
    # Check required fields
    required = ['version']
    missing = [field for field in required if field not in config]
    
    if missing:
        print(f"❌ Missing required fields in {filepath}: {', '.join(missing)}")
        return False
    
    print(f"✅ {filepath} is valid")
    return True


def main():
    """Validate all provided config files."""
    files = sys.argv[1:] if len(sys.argv) > 1 else []
    
    if not files:
        print("ℹ️  No config files to validate")
        sys.exit(0)
    
    all_valid = True
    for filepath in files:
        if not Path(filepath).exists():
            print(f"⚠️  File not found: {filepath}")
            continue
        
        if 'agent_config.json' in filepath:
            if not validate_agent_config(filepath):
                all_valid = False
        elif 'meta_agent_config.json' in filepath:
            if not validate_meta_config(filepath):
                all_valid = False
    
    if not all_valid:
        print("\n❌ Some config files are invalid")
        sys.exit(1)
    
    print(f"\n✅ All config files validated")
    sys.exit(0)


if __name__ == "__main__":
    main()
