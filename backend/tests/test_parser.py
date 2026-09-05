"""Unit tests for the natural-language parser (local rules + edit commands)."""

from parser import parse_edit_command, parse_prompt_local, validate_provider_url
import pytest


# ─── Type extraction ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("prompt,expected", [
    ("create an open pit mine", "open_pit"),
    ("design a room and pillar mine", "room_and_pillar"),
    ("show me a ventilation network with 6 airways", "ventilation"),
    ("design a conveyor belt system", "conveyor"),
    ("generate a blast pattern layout", "blast_pattern"),
    ("add a decline ramp access", "decline"),
    ("survey traverse control loop", "mine_survey_traverse"),
    ("topographic contour elevation map", "topographic_contours"),
    ("borehole stratigraphy coal seam core", "borehole_lithology"),
    ("longwall panel with shearer and chocks", "longwall_panel"),
    ("cut and fill volume earthwork", "cut_fill_volume"),
])
def test_type_extraction(prompt, expected):
    assert parse_prompt_local(prompt)["object_type"] == expected


def test_param_extraction():
    result = parse_prompt_local(
        "open pit with 15m bench height, 10m bench width and 6 benches")
    params = result["params"]
    assert params["bench_height"] == 15
    assert params["bench_width"] == 10
    assert params["num_benches"] == 6


# ─── Edit commands (relative arithmetic) ─────────────────────────────────────

def test_increase_by():
    out = parse_edit_command("increase bench height by 5", {"bench_height": 10})
    assert out["bench_height"] == 15


def test_decrease_by():
    out = parse_edit_command("decrease bench height by 5", {"bench_height": 10})
    assert out["bench_height"] == 5


def test_set_to():
    out = parse_edit_command("set bench height to 12", {"bench_height": 10})
    assert out["bench_height"] == 12


def test_increase_to():
    out = parse_edit_command("increase bench height to 12", {"bench_height": 10})
    assert out["bench_height"] == 12


def test_increase_by_without_current_sets():
    # No current value available → "by" behaves like "to"
    out = parse_edit_command("increase bench height by 5", {})
    assert out["bench_height"] == 5


def test_add_item():
    out = parse_edit_command("add another bench", {"num_benches": 4})
    assert out["num_benches"] == 5


def test_remove_item_floors_at_one():
    out = parse_edit_command("remove a bench", {"num_benches": 1})
    assert out["num_benches"] == 1


def test_non_edit_returns_none():
    assert parse_edit_command("create an open pit mine", {"bench_height": 10}) is None


# ─── SSRF whitelist helper ───────────────────────────────────────────────────

@pytest.mark.parametrize("url", [
    "https://api.deepseek.com",
    "https://api.deepseek.com/v1",
    "http://api-inference.huggingface.co",
    "http://localhost:11434",
    "http://127.0.0.1:11434/api/generate",
    "http://[::1]:11434",
])
def test_whitelist_allows(url):
    assert validate_provider_url(url) == url


@pytest.mark.parametrize("url", [
    "http://169.254.169.254/latest/meta-data",
    "http://localhost.evil.com",
    "http://10.0.0.1:8080",
    "http://192.168.1.1",
    "https://api.deepseek.com.attacker.io",
    "",
])
def test_whitelist_rejects(url):
    with pytest.raises(ValueError):
        validate_provider_url(url)
