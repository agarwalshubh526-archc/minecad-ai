"""Endpoint tests for the MineCAD AI FastAPI backend. No network, no API keys."""

import json
from unittest.mock import Mock, patch

import pytest


# ─── Health & Generators ─────────────────────────────────────────────────────

def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_list_generators(client):
    res = client.get("/api/generators")
    assert res.status_code == 200
    body = res.json()
    assert len(body["generators"]) == 11
    assert "open_pit" in body["generators"]
    assert "decline" in body["generators"]
    assert body["defaults"]["open_pit"]["bench_height"] == 10


# ─── /api/generate-direct ────────────────────────────────────────────────────

def test_generate_direct_ok(client):
    res = client.post("/api/generate-direct", json={
        "object_type": "open_pit",
        "params": {"num_benches": 3, "bench_height": 10},
    })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["object_type"] == "open_pit"
    assert len(body["geometry"]["primitives"]) > 0
    assert len(body["geometry"]["meshes"]) > 0
    assert body["geometry"]["properties"]["_object_type"] == "open_pit"


def test_generate_direct_unknown_type(client):
    res = client.post("/api/generate-direct", json={
        "object_type": "nope", "params": {},
    })
    assert res.status_code == 400
    assert res.json()["success"] is False


def test_generate_direct_nan_rejected(client):
    # Python's json accepts NaN literals — must be rejected with 400
    raw = json.dumps({
        "object_type": "open_pit",
        "params": {"bench_height": float("nan")},
    })
    res = client.post("/api/generate-direct", content=raw,
                      headers={"Content-Type": "application/json"})
    assert res.status_code == 400
    assert res.json()["success"] is False


def test_generate_direct_infinity_rejected(client):
    raw = json.dumps({
        "object_type": "conveyor",
        "params": {"length": float("inf")},
    })
    res = client.post("/api/generate-direct", content=raw,
                      headers={"Content-Type": "application/json"})
    assert res.status_code == 400


def test_generate_direct_degenerate_conveyor(client):
    res = client.post("/api/generate-direct", json={
        "object_type": "conveyor",
        "params": {"start_x": 0, "start_y": 0, "end_x": 0, "end_y": 0, "length": 0},
    })
    assert res.status_code == 400
    assert "degenerate" in res.json()["error"]


def test_generate_direct_count_clamped(client):
    res = client.post("/api/generate-direct", json={
        "object_type": "room_and_pillar",
        "params": {"num_rooms_x": 100000},
    })
    assert res.status_code == 200
    assert res.json()["geometry"]["properties"]["num_rooms_x"] == 500


# ─── /api/generate ───────────────────────────────────────────────────────────

def test_generate_prompt_fallback(client):
    res = client.post("/api/generate", json={
        "prompt": "create an open pit with 5 benches",
        "ai_provider": "local",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["object_type"] == "open_pit"
    assert body["params"]["num_benches"] == 5


def test_generate_llm_failure_falls_back_local(client):
    # Provider unreachable → must fall back to the local parser, not error
    with patch("parser.requests.post", side_effect=ConnectionError("refused")):
        res = client.post("/api/generate", json={
            "prompt": "design a room and pillar mine with 6m rooms",
            "ai_provider": "deepseek",
            "ai_api_key": "sk-test",
        })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["parse_method"] == "local"
    assert body["object_type"] == "room_and_pillar"


def test_generate_ssrf_base_url_rejected(client):
    res = client.post("/api/generate", json={
        "prompt": "open pit",
        "ai_provider": "ollama",
        "ai_base_url": "http://169.254.169.254",
    })
    assert res.status_code == 400
    assert res.json()["success"] is False


# ─── /api/export ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def open_pit_geometry():
    from geometry import generate_geometry
    return generate_geometry("open_pit", {"num_benches": 2})


def test_export_all_formats(client, open_pit_geometry):
    expected_media = {
        "dxf": "application/octet-stream",
        "svg": "image/svg+xml",
        "pdf": "application/pdf",
        "obj": "text/plain",
        "stl": "application/octet-stream",
    }
    for fmt, media in expected_media.items():
        res = client.post("/api/export", json={
            "format": fmt, "geometry_data": open_pit_geometry,
        })
        assert res.status_code == 200, fmt
        assert res.headers["content-type"].startswith(media), fmt
        assert len(res.content) > 0, fmt


def test_export_unsupported_format_is_400(client, open_pit_geometry):
    res = client.post("/api/export", json={
        "format": "exe", "geometry_data": open_pit_geometry,
    })
    assert res.status_code == 400  # not 500 — HTTPException must pass through


def test_export_svg_escapes_script(client):
    evil = {
        "primitives": [{"type": "text", "x": 0, "y": 0,
                        "text": '<script>alert(1)</script>', "height": 2, "color": 7}],
        "bounds": {"minX": -10, "minY": -10, "maxX": 10, "maxY": 10},
    }
    res = client.post("/api/export", json={"format": "svg", "geometry_data": evil})
    assert res.status_code == 200
    assert "<script>" not in res.text
    assert "&lt;script&gt;" in res.text


# ─── /api/deepseek/chat ──────────────────────────────────────────────────────

def test_deepseek_chat_ssrf_rejected(client):
    res = client.post("/api/deepseek/chat", json={
        "prompt": "hi", "base_url": "http://169.254.169.254/",
    })
    assert res.status_code == 400


def test_deepseek_chat_success_mocked(client):
    mock_resp = Mock(status_code=200)
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Hello from DeepSeek"}}]
    }
    with patch("main.requests.post", return_value=mock_resp) as mock_post:
        res = client.post("/api/deepseek/chat", json={
            "prompt": "hello", "api_key": "sk-test",
            "base_url": "https://api.deepseek.com",
        })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["response"] == "Hello from DeepSeek"
    # Timeout must be set on the outbound call
    _, kwargs = mock_post.call_args
    assert kwargs.get("timeout") == 30
