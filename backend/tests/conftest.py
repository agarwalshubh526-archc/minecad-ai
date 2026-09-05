import os
import sys

import pytest
from fastapi.testclient import TestClient

# Make the backend package importable when running pytest from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(app)
