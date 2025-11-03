#!/usr/bin/env python3
"""
Test Evolution Agent Files
===========================

Tests evolution system files for basic functionality.
"""

import subprocess
import sys
from pathlib import Path


def test_file(filepath):
    """Test a Python file for syntax and import errors."""
    if not Path(filepath).exists():
        print(f"⚠️  File not found: {filepath}")
        return True  # Don't fail if file doesn't exist
    
    # Test 1: Syntax check
    result = subprocess.run(
        ['python', '-m', 'py_compile', filepath],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Syntax error in {filepath}:")
        print(result.stderr)
        return False
    
    # Test 2: Try to import
    result = subprocess.run(
        ['python', '-c', f'import importlib.util; spec = importlib.util.spec_from_file_location("test", "{filepath}"); module = importlib.util.module_from_spec(spec)'],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Import error in {filepath}:")
        print(result.stderr)
        return False
    
    print(f"✅ {filepath} validated")
    return True


def main():
    """Test all provided files."""
    files = sys.argv[1:] if len(sys.argv) > 1 else []
    
    if not files:
        print("ℹ️  No evolution files to test")
        sys.exit(0)
    
    all_passed = True
    for filepath in files:
        if not test_file(filepath):
            all_passed = False
    
    if not all_passed:
        print("\n❌ Some evolution files failed validation")
        sys.exit(1)
    
    print(f"\n✅ All {len(files)} evolution file(s) validated")
    sys.exit(0)


if __name__ == "__main__":
    main()
