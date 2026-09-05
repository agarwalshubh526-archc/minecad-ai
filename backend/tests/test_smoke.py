"""Broad smoke test: all 11 generators through all 5 exporters."""

from geometry import generate_geometry
from exporter import export_dxf, export_svg, export_pdf, export_obj, export_stl

GENERATOR_CASES = [
    ("open_pit", {"bench_height": 12, "bench_width": 10, "num_benches": 6}),
    ("room_and_pillar", {"room_width": 6, "pillar_width": 8, "num_rooms_x": 5}),
    ("ventilation", {"num_airways": 5, "airway_length": 120}),
    ("conveyor", {"length": 150, "width": 1.5, "inclination": 12}),
    ("blast_pattern", {"burden": 3.5, "spacing": 4.5, "num_rows": 3}),
    ("decline", {"width": 6, "num_levels": 3}),
    ("mine_survey_traverse", {"num_stations": 6, "starting_easting": 1000,
                              "starting_northing": 2000}),
    ("topographic_contours", {"contour_interval": 5, "grid_size_x": 300,
                              "grid_size_y": 200}),
    ("borehole_lithology", {"num_boreholes": 5, "spacing": 50, "depth": 80}),
    ("longwall_panel", {"face_width": 200, "panel_length": 800}),
    ("cut_fill_volume", {"pit_depth": 40, "surface_width": 180,
                         "bottom_width": 60}),
]

EXPORTERS = [export_dxf, export_svg, export_pdf, export_obj, export_stl]


def test_generators_have_defaults():
    # Every generator must work with no params at all
    for object_type, _ in GENERATOR_CASES:
        data = generate_geometry(object_type, {})
        assert data["primitives"], object_type
        assert data["meshes"], object_type
        assert data["bounds"]["maxX"] > data["bounds"]["minX"], object_type


def test_all_generators_all_exporters():
    for object_type, params in GENERATOR_CASES:
        data = generate_geometry(object_type, params)
        assert data["primitives"], object_type
        for exporter in EXPORTERS:
            output = exporter(data)
            assert output, f"{object_type} via {exporter.__name__}"


def test_divide_by_zero_inputs_clamped():
    # Each of these used to raise ZeroDivisionError or produce NaN/inf geometry
    generate_geometry("open_pit", {"batter_angle": 0})
    generate_geometry("room_and_pillar", {"room_width": 0, "pillar_width": 0})
    generate_geometry("decline", {"num_levels": 0})
    generate_geometry("mine_survey_traverse", {"num_stations": 0})
    generate_geometry("topographic_contours", {"contour_interval": 0})
    generate_geometry("longwall_panel", {"num_supports": 0})
    generate_geometry("borehole_lithology", {"depth": 20, "coal_seam_depth": 100,
                                             "coal_seam_thickness": 10})
