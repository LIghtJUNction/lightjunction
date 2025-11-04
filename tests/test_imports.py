"""Test basic imports and module structure."""

import pytest


def test_import_lightjunction():
    """Test that the main package can be imported."""
    import lightjunction
    assert lightjunction.__version__ == "1.0.0"


def test_import_orchestrator():
    """Test that orchestrator module can be imported."""
    from lightjunction import orchestrator
    assert hasattr(orchestrator, 'SystemOrchestrator')


def test_import_meta_agent():
    """Test that meta_agent module can be imported."""
    from lightjunction import meta_agent
    assert hasattr(meta_agent, 'MetaAgent')


def test_import_self_evolve_agent():
    """Test that self_evolve_agent module can be imported."""
    from lightjunction import self_evolve_agent
    assert hasattr(self_evolve_agent, 'SelfEvolvingAgent')


def test_import_update_readme_data():
    """Test that update_readme_data module can be imported."""
    from lightjunction import update_readme_data
    # Module should be importable
    assert update_readme_data is not None


def test_import_process_code_showcase():
    """Test that process_code_showcase module can be imported."""
    from lightjunction import process_code_showcase
    # Module should be importable
    assert process_code_showcase is not None


def test_import_process_qa():
    """Test that process_qa module can be imported."""
    from lightjunction import process_qa
    # Module should be importable
    assert process_qa is not None


def test_package_all():
    """Test that __all__ is properly defined."""
    import lightjunction
    assert hasattr(lightjunction, '__all__')
    assert 'orchestrator' in lightjunction.__all__
    assert 'meta_agent' in lightjunction.__all__
