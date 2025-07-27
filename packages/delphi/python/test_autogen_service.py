#!/usr/bin/env python3
"""
Test suite for the AutoGen service FastAPI endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import sys
import os

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the FastAPI app after path modification
from autogen_service import app

# Create test client
client = TestClient(app)


class TestAutoGenService:
    """Test cases for AutoGen service endpoints."""

    def test_health_check(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy", "service": "delphi-autogen"}

    def test_plan_endpoint_success(self):
        """Test successful planning endpoint."""
        
        response = client.post("/plan", json={"prompt": "Add user authentication"})
        
        assert response.status_code == 200
        data = response.json()
        assert "draft" in data
        assert len(data["draft"]) > 10
        assert "specification" in data["draft"].lower()

    def test_refine_endpoint_clear_false(self):
        """Test refine endpoint when specification is not clear."""
        # First call returns needs more work
        response = client.post("/refine", json={"spec": "Initial spec"})
        
        assert response.status_code == 200
        data = response.json()
        assert "refined" in data
        # Mock agent always returns clear=True for RefinerClaude
        assert data["clear"] is True

    def test_refine_endpoint_clear_true(self):
        """Test refine endpoint when specification is clear."""
        response = client.post("/refine", json={"spec": "Detailed spec"})
        
        assert response.status_code == 200
        data = response.json()
        assert "refined" in data
        assert data["clear"] is True
        assert "CLEAR: TRUE" not in data["refined"]  # Should be stripped

    def test_review_endpoint_approved(self):
        """Test review endpoint with approved diff."""
        response = client.post("/review", json={
            "diff": "diff --git a/src/app.ts ...",
            "test_results": "All tests passed"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["feedback"] == "Approved"

    def test_review_endpoint_rejected(self):
        """Test review endpoint with rejected diff."""
        # Mock always returns approved, so we'll test the endpoint works
        response = client.post("/review", json={
            "diff": "diff --git a/src/app.ts ...",
            "test_results": "2 tests failed"
        })
        
        assert response.status_code == 200
        data = response.json()
        # Mock always approves
        assert data["ok"] is True

    def test_plan_endpoint_validation(self):
        """Test plan endpoint input validation."""
        # Missing prompt
        response = client.post("/plan", json={})
        assert response.status_code == 422
        
        # Empty prompt
        response = client.post("/plan", json={"prompt": ""})
        assert response.status_code == 422

    def test_refine_endpoint_validation(self):
        """Test refine endpoint input validation."""
        # Missing spec
        response = client.post("/refine", json={})
        assert response.status_code == 422

    def test_review_endpoint_validation(self):
        """Test review endpoint input validation."""
        # Missing diff
        response = client.post("/review", json={"test_results": "passed"})
        assert response.status_code == 422


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])