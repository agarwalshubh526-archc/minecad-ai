"""
MineCAD AI — Backend Test Script
Verifies that all mining generators and CAD/mesh exporters are fully operational.
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from geometry import generate_geometry
from exporter import export_dxf, export_svg, export_pdf, export_obj, export_stl

from parser import parse_prompt

def run_tests():
    print("Initializing MineCAD AI Backend tests...")
    
    # Test DeepSeek parser fallback handling
    print("\nTesting DeepSeek Parser Setup:")
    parsed_result = parse_prompt(
        prompt="Design an open pit mine with 15m bench height and 10m bench width",
        ai_provider="deepseek",
        ai_model="deepseek-chat",
        ai_api_key="", # empty key will fall back gracefully to local rule parser
    )
    print(f"  -> DeepSeek parser test returned object_type={parsed_result.get('object_type')}, params={parsed_result.get('params')}, method={parsed_result.get('method')}")
    assert parsed_result.get("object_type") == "open_pit"
    assert parsed_result.get("params", {}).get("bench_height") == 15

    test_generators = [
        ("open_pit", {"bench_height": 12, "bench_width": 10, "num_benches": 6}),
        ("room_and_pillar", {"room_width": 6, "pillar_width": 8, "num_rooms_x": 5}),
        ("ventilation", {"num_airways": 5, "airway_length": 120}),
        ("conveyor", {"length": 150, "width": 1.5, "inclination": 12}),
        ("blast_pattern", {"burden": 3.5, "spacing": 4.5, "num_rows": 3}),
        ("decline", {"width": 6, "num_levels": 3}),
        ("mine_survey_traverse", {"num_stations": 6, "starting_easting": 1000, "starting_northing": 2000}),
        ("topographic_contours", {"contour_interval": 5, "grid_size_x": 300, "grid_size_y": 200}),
        ("borehole_lithology", {"num_boreholes": 5, "spacing": 50, "depth": 80}),
        ("longwall_panel", {"face_width": 200, "panel_length": 800}),
        ("cut_fill_volume", {"pit_depth": 40, "surface_width": 180, "bottom_width": 60}),
    ]

    for gtype, params in test_generators:
        print(f"\nTesting Generator: {gtype}")
        try:
            geometry_data = generate_geometry(gtype, params)
            num_prims = len(geometry_data["primitives"])
            num_meshes = len(geometry_data["meshes"])
            print(f"  -> Generated {num_prims} 2D primitives and {num_meshes} 3D meshes successfully.")

            # Test DXF Export
            dxf_data = export_dxf(geometry_data)
            print(f"  -> DXF Export: OK ({len(dxf_data)} bytes)")

            # Test SVG Export
            svg_data = export_svg(geometry_data)
            print(f"  -> SVG Export: OK ({len(svg_data)} characters)")

            # Test PDF Export
            pdf_data = export_pdf(geometry_data)
            print(f"  -> PDF Export: OK ({len(pdf_data)} bytes)")

            # Test OBJ Export
            obj_data = export_obj(geometry_data)
            print(f"  -> OBJ Export: OK ({len(obj_data)} characters)")

            # Test STL Export
            stl_data = export_stl(geometry_data)
            print(f"  -> STL Export: OK ({len(stl_data)} characters)")

        except Exception as e:
            print(f"  -> Error: {e}")
            sys.exit(1)

    print("\nAll MineCAD AI backend geometry and exporter verification tests PASSED successfully!")

if __name__ == "__main__":
    run_tests()

