.PHONY: help install install-dev lint format type-check test test-compile test-cov pre-commit clean

help:
	@echo "🧬 LightJunction AI Evolution System"
	@echo ""
	@echo "Available commands:"
	@echo "  make install      - Install production dependencies"
	@echo "  make install-dev  - Install development dependencies"
	@echo "  make lint         - Run ruff linter"
	@echo "  make format       - Format code with ruff"
	@echo "  make type-check   - Run mypy type checking"
	@echo "  make test         - Run pytest with coverage"
	@echo "  make test-compile - Run basic syntax compilation tests"
	@echo "  make test-cov     - Run tests and open coverage report"
	@echo "  make pre-commit   - Install and run pre-commit hooks"
	@echo "  make clean        - Clean temporary files"

install:
	@echo "📦 Installing production dependencies..."
	uv sync --no-dev

install-dev:
	@echo "📦 Installing development dependencies..."
	uv sync
	pre-commit install

lint:
	@echo "🔍 Running ruff linter..."
	uv run ruff check .

format:
	@echo "✨ Formatting code with ruff..."
	uv run ruff format .
	uv run ruff check --fix .

type-check:
	@echo "🔎 Running mypy type checking..."
	uv run mypy src/lightjunction/ || true

test:
	@echo "🧪 Running pytest with coverage..."
	uv run pytest

test-compile:
	@echo "🧪 Running basic compilation tests..."
	@uv run python -m py_compile src/lightjunction/update_readme_data.py
	@uv run python -m py_compile src/lightjunction/update_readme_data_a.py
	@uv run python -m py_compile src/lightjunction/update_readme_data_b.py
	@uv run python -m py_compile src/lightjunction/process_code_showcase.py
	@uv run python -m py_compile src/lightjunction/process_code_showcase_a.py
	@uv run python -m py_compile src/lightjunction/process_code_showcase_b.py
	@uv run python -m py_compile src/lightjunction/process_qa.py
	@uv run python -m py_compile src/lightjunction/process_qa_a.py
	@uv run python -m py_compile src/lightjunction/process_qa_b.py
	@uv run python -m py_compile src/lightjunction/self_evolve_agent.py
	@uv run python -m py_compile src/lightjunction/meta_agent.py
	@echo "✅ All files compile successfully!"

test-cov:
	@echo "🧪 Running tests and generating coverage report..."
	uv run pytest
	@echo ""
	@echo "📊 Opening coverage report..."
	@which xdg-open > /dev/null 2>&1 && xdg-open htmlcov/index.html || \
	 which open > /dev/null 2>&1 && open htmlcov/index.html || \
	 echo "Coverage report generated in htmlcov/index.html"

pre-commit:
	@echo "🔧 Setting up pre-commit hooks..."
	pre-commit install
	@echo "✅ Pre-commit hooks installed!"
	@echo ""
	@echo "Running pre-commit on all files..."
	pre-commit run --all-files || true

clean:
	@echo "🧹 Cleaning temporary files..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.log" -delete
	find . -type f -name ".DS_Store" -delete
	rm -rf .mypy_cache .ruff_cache .pytest_cache .coverage htmlcov coverage.xml
	@echo "✅ Cleanup complete!"
