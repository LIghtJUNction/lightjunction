# LightJunction Project

This is a simplified GitHub profile automation project with two main workflows:

## Workflows

### 1. Daily README Update (`daily-readme-update.yml`)
- **Trigger**: Daily at 00:00 UTC (can also be manually triggered)
- **Purpose**: Automatically updates the GitHub profile README with:
  - Latest repositories
  - Recent commits from the last 7 days
  - Weekly activity summary
- **Technology**: Uses inline Python script with `uv run` for dependency management

### 2. Code Executor (`code-executor.yml`)
- **Trigger**: When an issue is opened/edited or a comment is created
- **Purpose**: Extracts and executes Python code blocks from issue body
- **Features**:
  - Automatically detects code blocks in markdown format
  - Executes Python code safely with timeout
  - Comments back the execution results on the issue
  - Can optionally update README based on code output
- **Technology**: Uses inline Python script with `uv run` for dependency management

## Repository Structure

```
.
├── .github/
│   └── workflows/
│       ├── daily-readme-update.yml   # Daily README update workflow
│       └── code-executor.yml         # Issue-based code executor
├── sponsor/
│   └── readme.md                     # Sponsor information
├── README.md                         # GitHub profile README
├── pyproject.toml                    # Minimal project configuration
└── PROJECT.md                        # This file
```

## How to Use

### Daily README Update
The workflow runs automatically every day. You can also manually trigger it from the Actions tab.

### Code Executor
Create an issue with Python code in markdown code blocks:

\`\`\`python
# Your Python code here
print("Hello from issue!")
\`\`\`

The workflow will:
1. Extract the code
2. Execute it safely
3. Comment the results back to the issue

## Requirements
- GitHub Actions enabled
- `uv` for Python dependency management (automatically installed in workflows)

## Notes
- All Python scripts are inline in the workflow files using PEP 723 dependency specification
- No external Python files are needed
- The workflows use `uv run --no-project` for zero-configuration execution
