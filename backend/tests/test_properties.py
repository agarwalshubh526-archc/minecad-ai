"""Regression tests for the v2 engineering properties (volumes, tonnages,
fixed extraction formula, gradient/drop fields) across all generators."""

from geometry import generate_geometry
import pytest


def test_open_pit_waste_volume():
    g = generate_geometry("open_pit", {"num_benches": 5, "bench_height": 10,
                                       "pit_length": 300, "pit_width": 200})
    p = g["properties"]
    assert p["total_depth"] == 50
    assert p["waste_volume_m3"] > 0
    assert p["waste_tonnes"] == pytest.approx(p["waste_volume_m3"] * 2.7, rel=0.01)
    # Depth annotation present (dimension primitives carry the label)
    texts = [pr.get("text", "") for pr in g["primitives"] if pr["type"] in ("text", "dimension")]
    assert any("DEPTH 50 m" in t for t in texts)


def test_room_and_pillar_extraction_formula():
    # 1 − (8/14)² ≈ 67.3% — the old (room/cell)² formula gave 18.4%
    g = generate_geometry("room_and_pillar", {"room_width": 6, "pillar_width": 8})
    p = g["properties"]
    assert p["extraction_ratio"] == pytest.approx(67.3, abs=0.1)
    assert p["coal_tonnes_in_situ"] > 0


def test_ventilation_airflow_estimate():
    g = generate_geometry("ventilation", {"shaft_diameter": 6})
    # 5 m/s × π × 3² ≈ 141 m³/s
    assert g["properties"]["estimated_airflow_m3s"] == 141


def test_conveyor_vertical_lift():
    g = generate_geometry("conveyor", {"length": 200, "inclination": 15})
    assert g["properties"]["vertical_lift_m"] == pytest.approx(200 * 0.2679, abs=0.1)


def test_blast_muck_volume():
    g = generate_geometry("blast_pattern", {"burden": 4, "spacing": 5,
                                            "num_rows": 4, "num_holes_per_row": 8,
                                            "hole_depth": 12})
    p = g["properties"]
    assert p["spacing_burden_ratio"] == 1.25
    assert p["rock_volume_m3"] == 4 * 5 * 12 * 32
    assert p["muck_volume_loose_m3"] == round(4 * 5 * 12 * 32 * 1.3)


def test_decline_vertical_drop():
    g = generate_geometry("decline", {"total_length": 500, "gradient": 10})
    assert g["properties"]["vertical_drop_m"] == 50


def test_longwall_recoverable_tonnes():
    g = generate_geometry("longwall_panel", {"face_width": 200, "panel_length": 800,
                                             "seam_height": 3.5})
    assert g["properties"]["recoverable_coal_tonnes"] == round(200 * 800 * 3.5 * 1.4 * 0.95)


def test_borehole_coal_in_place():
    g = generate_geometry("borehole_lithology", {"num_boreholes": 5, "spacing": 50,
                                                 "coal_seam_thickness": 4.5})
    # 4.5 × 4 × 50 × 100 × 1.4
    assert g["properties"]["coal_in_place_tonnes"] == 126000


def test_cut_fill_spoil_volume():
    g = generate_geometry("cut_fill_volume", {})
    assert g["properties"]["spoil_volume_m3"] == 44000


def test_dimensions_layer_present():
    # Generators that draw dimension prims must declare the DIMENSIONS layer
    for otype in ("borehole_lithology", "longwall_panel", "cut_fill_volume"):
        g = generate_geometry(otype, {})
        layer_names = [l["name"] for l in g["layers"]]
        assert "DIMENSIONS" in layer_names, otype


def test_interpretation_via_api(client):
    res = client.post("/api/generate", json={"prompt": "quarry with 6 benches 15m high"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["object_type"] == "open_pit"
    assert body["params"]["num_benches"] == 6
    assert body["params"]["bench_height"] == 15
    assert "Understood" not in body["interpretation"]  # raw summary, UI adds prefix
    assert "6 benches" in body["interpretation"]
