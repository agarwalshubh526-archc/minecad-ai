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


# ─── Parser v2: units, synonyms, multi-step, relative adjectives ────────────

@pytest.mark.parametrize("prompt,expected_type", [
    ("dig a quarry with 4 benches", "open_pit"),
    ("design an opencast coal mine", "open_pit"),
    ("open cut gold mine 300m long", "open_pit"),
    ("bord and pillar coal mine", "room_and_pillar"),
    ("drive a tunnel 500m long", "decline"),
    ("sink a shaft 6m diameter", "decline"),
    ("blast design for the north wall", "blast_pattern"),
    ("draw the topo of the site", "topographic_contours"),
    ("contours of the site", "topographic_contours"),
    ("check the airflow circuit", "ventilation"),
    ("ventilation on level 3", "ventilation"),
    ("a borehole cross section", "borehole_lithology"),
    ("drill hole through the seam", "borehole_lithology"),
    # specific design object beats generic open_pit context word "quarry"
    ("blast pattern for a quarry", "blast_pattern"),
    ("quarry blast design 10m burden", "blast_pattern"),
])
def test_synonym_type_extraction(prompt, expected_type):
    assert parse_prompt_local(prompt)["object_type"] == expected_type


def test_feet_conversion():
    result = parse_prompt_local("opencast mine 40 ft deep")
    # 40 ft = 12.19 m → 12.19 / 10 m benches ≈ 1 bench
    assert result["params"]["num_benches"] == 1
    assert any("ft" in n for n in result["notes"])


def test_explicit_units_metres():
    result = parse_prompt_local("open pit with 6 benches 15 metres high")
    assert result["params"]["num_benches"] == 6
    assert result["params"]["bench_height"] == 15


def test_degrees_and_percent():
    result = parse_prompt_local("open pit with 55 degrees overall slope")
    assert result["params"]["overall_slope"] == 55
    result2 = parse_prompt_local("decline with 12% gradient")
    assert result2["object_type"] == "decline"
    assert result2["params"]["gradient"] == 12


def test_haul_road_ft_conversion():
    result = parse_prompt_local("open pit with an 80 ft haul road")
    assert abs(result["params"]["haul_road_width"] - 24.38) < 0.01


def test_multi_step_haul_road():
    result = parse_prompt_local("create an open pit with 5 benches and add a haul road")
    assert result["object_type"] == "open_pit"
    assert result["params"]["num_benches"] == 5
    assert "haul_road" in result["features"]
    assert any("haul road" in n for n in result["notes"])


def test_multi_step_width_applies():
    result = parse_prompt_local("create an open pit and add a 30 m haul road")
    assert result["params"]["haul_road_width"] == 30


def test_multi_step_unmodelled_feature_noted():
    result = parse_prompt_local("design an open pit with a sump and drainage")
    assert result["object_type"] == "open_pit"
    assert any("drainage" in n for n in result["notes"])


def test_interpretation_open_pit():
    result = parse_prompt_local("open pit with 5 benches 12m high batter 55 degrees")
    interp = result["interpretation"]
    assert "open pit" in interp
    assert "5 benches" in interp
    assert "55°" in interp


def test_interpretation_notes_unit_conversion():
    result = parse_prompt_local("quarry 50 ft deep")
    assert "ft →" in result["interpretation"]


# ─── Relative adjectives (edit commands without numbers) ────────────────────

def test_deeper_open_pit():
    out = parse_edit_command("make it deeper", {"_object_type": "open_pit", "num_benches": 4})
    assert out["num_benches"] == 5  # +25% of 4 = 1


def test_deeper_cut_fill():
    out = parse_edit_command("deeper", {"_object_type": "cut_fill_volume", "pit_depth": 40})
    assert out["pit_depth"] == 50


def test_wider_open_pit():
    out = parse_edit_command("make the pit wider", {"_object_type": "open_pit", "pit_width": 200})
    assert out["pit_width"] == 250


def test_bigger_and_smaller():
    props = {"_object_type": "open_pit", "pit_length": 300, "pit_width": 200}
    out = parse_edit_command("bigger", props)
    assert out["pit_length"] == 375 and out["pit_width"] == 250
    out2 = parse_edit_command("smaller", props)
    assert out2["pit_length"] == 240 and out2["pit_width"] == 160


def test_steeper_and_gentler():
    props = {"_object_type": "open_pit", "batter_angle": 75, "overall_slope": 50}
    out = parse_edit_command("steeper walls", props)
    assert out["batter_angle"] == 80 and out["overall_slope"] == 53
    out2 = parse_edit_command("gentler slope", props)
    assert out2["batter_angle"] == 70 and out2["overall_slope"] == 47


def test_more_fewer_benches():
    props = {"_object_type": "open_pit", "num_benches": 5}
    assert parse_edit_command("more benches", props)["num_benches"] == 7
    assert parse_edit_command("fewer benches", props)["num_benches"] == 3
    # floors at 1
    assert parse_edit_command("fewer benches", {"num_benches": 1})["num_benches"] == 1


def test_more_levels():
    out = parse_edit_command("add more levels", {"_object_type": "decline", "num_levels": 3})
    assert out["num_levels"] == 5


def test_relative_no_match_returns_none():
    assert parse_edit_command("hello world", {"num_benches": 4}) is None


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
