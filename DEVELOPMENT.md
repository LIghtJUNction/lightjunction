# 🛠️ Development Guide

## Project Setup

### Requirements

- **Python**: >= 3.10
- **Package Manager**: uv
- **OS**: Linux, macOS, Windows

### Installation

```bash
# Clone repository
git clone https://github.com/LIghtJUNction/lightjunction.git
cd lightjunction

# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
make install-dev

# Setup pre-commit hooks
make pre-commit
```

## Code Quality Tools

### Ruff (Linter & Formatter)

Fast Python linter and code formatter.

```bash
# Run linter
make lint

# Auto-format code
make format
```

### MyPy (Type Checker)

Static type checker for Python.

```bash
# Run type checking
make type-check
```

### Pre-commit Hooks

Automatically run checks before each commit.

```bash
# Install hooks
make pre-commit

# Run manually on all files
pre-commit run --all-files
```

## Project Structure

```
lightjunction/
├── orchestrator.py          # Main system orchestrator
├── self_evolve_agent.py     # Self-evolution agent
├── meta_agent.py            # Meta-agent (IMMUTABLE)
├── update_readme_data.py    # README updater
├── process_code_showcase.py # Code showcase processor
├── process_qa.py            # Q&A processor
├── *_a.py / *_b.py         # A/B versions of scripts
├── .github/workflows/
│   ├── main.yml            # Main orchestrator workflow
│   ├── code_showcase.yml   # Code showcase (issue-triggered)
│   └── qa_assistant.yml    # Q&A assistant (issue-triggered)
├── pyproject.toml          # Project configuration
├── .pre-commit-config.yaml # Pre-commit hooks config
└── Makefile                # Development commands
```

## Development Workflow

### 1. Make Changes

Edit code as needed. The pre-commit hooks will run automatically.

### 2. Test Locally

```bash
# Check syntax
make test

# Run type checking
make type-check

# Format code
make format
```

### 3. Test Individual Components

```bash
# Test orchestrator
python orchestrator.py

# Test README update
python update_readme_data.py

# Test self-evolution (if needed)
python self_evolve_agent.py
```

### 4. Commit Changes

```bash
git add .
git commit -m "Your commit message"

# Pre-commit hooks will run automatically
# If checks fail, fix issues and try again
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make install` | Install production dependencies |
| `make install-dev` | Install development dependencies |
| `make lint` | Run ruff linter |
| `make format` | Format code with ruff |
| `make type-check` | Run mypy type checking |
| `make test` | Run syntax checks |
| `make pre-commit` | Setup and run pre-commit hooks |
| `make clean` | Clean temporary files |

## Configuration Files

### pyproject.toml

Main project configuration including:
- Project metadata
- Dependencies
- Ruff configuration
- MyPy configuration

```toml
[project]
name = "lightjunction-ai-evolution"
requires-python = ">=3.10"
dependencies = [
    "requests>=2.31.0",
    "Pillow>=10.0.0",
    "openai-agents>=0.4.0",
]
```

### .pre-commit-config.yaml

Pre-commit hooks configuration:
- Trailing whitespace removal
- End-of-file fixer
- YAML/JSON/TOML validation
- Ruff linting and formatting
- MyPy type checking
- Syntax validation
- Immutable file protection

## Code Standards

### Python Version

- Minimum: Python 3.10
- Target: Python 3.12

### Style Guide

- **Line Length**: 120 characters (ruff)
- **Import Sorting**: isort via ruff
- **Type Hints**: Encouraged but not required
- **Docstrings**: Required for public functions

### Example

```python
def process_data(input_data: str) -> dict:
    """
    Process input data and return results.
    
    Args:
        input_data: Raw input string
        
    Returns:
        Dictionary containing processed results
    """
    # Implementation
    return {"result": "processed"}
```

## Testing

### Syntax Testing

```bash
make test
```

This compiles all Python files to check for syntax errors.

### Type Checking

```bash
make type-check
```

Runs MyPy on all main Python files.

### Pre-commit Testing

```bash
pre-commit run --all-files
```

Runs all pre-commit hooks on all files.

## Debugging

### Orchestrator

```bash
# Run with output
python orchestrator.py

# Check results
cat orchestrator_results.json | python -m json.tool
```

### Self-Evolution

```bash
# Run evolution cycle
python self_evolve_agent.py

# Check config
cat agent_config.json | python -m json.tool
```

### Meta-Agent

```bash
# Run meta-evolution
python meta_agent.py

# Check config
cat meta_agent_config.json | python -m json.tool
```

## Immutable Files

⚠️ **DO NOT MODIFY** these files:

- `meta_agent.py` - Meta-agent core logic
- Files marked with `IMMUTABLE` in comments

The pre-commit hooks will prevent committing changes to these files.

## Troubleshooting

### Pre-commit Hook Failures

If pre-commit hooks fail:

1. Check the error message
2. Fix the issues (often auto-fixable with `make format`)
3. Stage fixed files: `git add .`
4. Try committing again

### Import Errors

If you get import errors:

```bash
# Reinstall dependencies
make install-dev

# Or with uv directly
uv pip install -e ".[dev]"
```

### Type Checking Errors

MyPy is configured to be lenient. Errors are warnings, not blockers.

To ignore MyPy for a line:
```python
result = some_function()  # type: ignore
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following code standards
4. Run tests and quality checks
5. Submit a pull request

## CI/CD

### Main Workflow

`.github/workflows/main.yml` runs daily and includes:
- Self-evolution (if scheduled)
- Meta-evolution (if scheduled)
- README update
- Statistics generation

### Issue-Triggered Workflows

- `code_showcase.yml` - Triggered by `code-showcase` label
- `qa_assistant.yml` - Triggered by `qa` label

## License

See the main README for license information.

## Support

For issues or questions:
- Create an issue in the repository
- Check existing documentation
- Review the code comments
