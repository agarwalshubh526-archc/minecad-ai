"""
MineCAD AI — Parametric Mining Geometry Engine
Converts structured engineering parameters into 2D vector primitives and 3D mesh data.
"""

import math
from typing import List, Dict, Any, Tuple, Optional


# ─── 2D Primitive Types ───────────────────────────────────────────────────────

def make_line(x1: float, y1: float, x2: float, y2: float, layer: str = "0", color: int = 7) -> Dict:
    return {"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "layer": layer, "color": color}

def make_polyline(points: List[Tuple[float, float]], closed: bool = False, layer: str = "0", color: int = 7) -> Dict:
    return {"type": "polyline", "points": [{"x": p[0], "y": p[1]} for p in points], "closed": closed, "layer": layer, "color": color}

def make_circle(cx: float, cy: float, r: float, layer: str = "0", color: int = 7) -> Dict:
    return {"type": "circle", "cx": cx, "cy": cy, "r": r, "layer": layer, "color": color}

def make_arc(cx: float, cy: float, r: float, start_angle: float, end_angle: float, layer: str = "0", color: int = 7) -> Dict:
    return {"type": "arc", "cx": cx, "cy": cy, "r": r, "startAngle": start_angle, "endAngle": end_angle, "layer": layer, "color": color}

def make_dimension(x1: float, y1: float, x2: float, y2: float, text: str, layer: str = "DIMENSIONS", color: int = 3) -> Dict:
    return {"type": "dimension", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "text": text, "layer": layer, "color": color}

def make_text(x: float, y: float, text: str, height: float = 2.0, layer: str = "TEXT", color: int = 7) -> Dict:
    return {"type": "text", "x": x, "y": y, "text": text, "height": height, "layer": layer, "color": color}

def make_hatch(points: List[Tuple[float, float]], pattern: str = "ANSI31", layer: str = "HATCH", color: int = 8) -> Dict:
    return {"type": "hatch", "points": [{"x": p[0], "y": p[1]} for p in points], "pattern": pattern, "layer": layer, "color": color}


# ─── Mine Design Language Palette (mirrored in frontend geometryEngine.ts) ───

MINE_COLORS = {
    "waste_bench": ["#9C8D78", "#90826E", "#847763", "#786B58", "#6D604E", "#625644"],
    "pit_floor": "#5A5244",
    "haul_road": "#9A8A70",
    "coal_seam": "#1C1C1E",
    "sandstone": "#C9B18A",
    "overburden": "#8A6F4D",
    "mudstone": "#6E6259",
    "pillar_rock": "#7A6B5D",
    "roof_rock": "#4E463C",
    "floor_rock": "#5C5347",
    "roadway_gravel": "#6E6257",
    "duct_steel": "#5F7D8C",
    "equipment_yellow": "#F5A623",
    "equipment_orange": "#E67E22",
    "tunnel_grey": "#5A6470",
    "level_grey": "#6B7078",
    "terrain_low": "#6E7A4A",
    "terrain_high": "#8A9159",
    "gateroad": "#4A4A52",
    "goaf": "#3A352F",
    "cut_volume": "#8A5A44",
    "spoil_dump": "#7E8B5A",
    "concrete": "#8A8F94",
    "trestle_steel": "#7C8288",
    "blast_hole": "#C0392B",
    "survey_control": "#E74C3C",
    "survey_station": "#F39C12",
    "conveyor_belt": "#3A3A3E",
}

C = MINE_COLORS


def _shade(hex_color: str, f: float) -> str:
    """Multiply a #RRGGBB color by a factor (per-channel, clamped)."""
    n = int(hex_color.lstrip("#"), 16)
    r = min(255, round(((n >> 16) & 255) * f))
    g = min(255, round(((n >> 8) & 255) * f))
    b = min(255, round((n & 255) * f))
    return f"#{r:02x}{g:02x}{b:02x}"


def make_mesh(vertices: List[List[float]], indices: List[List[int]], color: str = "#4a9eff",
              name: str = "mesh", layer: Optional[str] = None) -> Dict:
    m = {"type": "mesh", "vertices": vertices, "indices": indices, "color": color, "name": name}
    if layer:
        m["layer"] = layer
    return m


def create_box_mesh(x: float, y: float, z: float, w: float, d: float, h: float,
                    color: str = "#4a9eff", layer: Optional[str] = None,
                    name: Optional[str] = None) -> Dict:
    """Create a box mesh at position (x,y,z) with dimensions (w,d,h)."""
    verts = [
        [x, y, z], [x+w, y, z], [x+w, y+d, z], [x, y+d, z],
        [x, y, z+h], [x+w, y, z+h], [x+w, y+d, z+h], [x, y+d, z+h]
    ]
    faces = [
        [0,1,2], [0,2,3],  # bottom
        [4,6,5], [4,7,6],  # top
        [0,4,5], [0,5,1],  # front
        [2,6,7], [2,7,3],  # back
        [0,3,7], [0,7,4],  # left
        [1,5,6], [1,6,2],  # right
    ]
    return make_mesh(verts, faces, color, name or f"box_{x}_{y}_{z}", layer)


def _push_quad(verts, faces, a, b, c, d):
    """Quad a→b→c→d (CCW from outside) as two triangles with dedicated vertices."""
    base = len(verts)
    verts.extend([list(a), list(b), list(c), list(d)])
    faces.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])


def create_inclined_box_mesh(x1, y1, z1, x2, y2, z2, w, h, color, name, layer=None) -> Dict:
    """Box with inclined bottom A(z1)→B(z2) and parallel top (+h). Width w is
    perpendicular to the plan direction. Used for conveyors and declines."""
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1.0
    px, py = -dy / length * (w / 2), dx / length * (w / 2)
    am = [x1 - px, y1 - py, z1]
    ap = [x1 + px, y1 + py, z1]
    bm = [x2 - px, y2 - py, z2]
    bp = [x2 + px, y2 + py, z2]

    def up(p):
        return [p[0], p[1], p[2] + h]

    verts: List[List[float]] = []
    faces: List[List[int]] = []
    _push_quad(verts, faces, up(am), up(bm), up(bp), up(ap))  # top
    _push_quad(verts, faces, bm, am, ap, bp)                 # bottom
    _push_quad(verts, faces, bp, bm, up(bm), up(bp))         # front
    _push_quad(verts, faces, am, ap, up(ap), up(am))         # back
    _push_quad(verts, faces, ap, bp, up(bp), up(ap))         # left
    _push_quad(verts, faces, bm, am, up(am), up(bm))         # right
    return make_mesh(verts, faces, color, name, layer)


def create_cylinder_mesh(cx, cy, z0, z1, r, segments, color, name, layer=None) -> Dict:
    """Vertical cylinder between z0 (bottom) and z1 (top), axis at (cx, cy)."""
    verts: List[List[float]] = [[cx, cy, z0], [cx, cy, z1]]
    cb, ct = 0, 1
    ring0 = len(verts)
    for i in range(segments):
        a = (i / segments) * 2 * math.pi
        verts.append([cx + math.cos(a) * r, cy + math.sin(a) * r, z0])
    ring1 = len(verts)
    for i in range(segments):
        a = (i / segments) * 2 * math.pi
        verts.append([cx + math.cos(a) * r, cy + math.sin(a) * r, z1])
    faces: List[List[int]] = []
    for i in range(segments):
        j = (i + 1) % segments
        faces.append([ring0 + i, ring0 + j, ring1 + j])
        faces.append([ring0 + i, ring1 + j, ring1 + i])
    for i in range(segments):
        j = (i + 1) % segments
        faces.append([cb, ring0 + j, ring0 + i])
        faces.append([ct, ring1 + i, ring1 + j])
    return make_mesh(verts, faces, color, name, layer)


def create_extrude_xz_mesh(xz, y0, y1, color, name, layer=None) -> Dict:
    """Extrude a closed convex X-Z polygon along plan-y from y0 to y1."""
    n = len(xz)
    verts = [[x, y0, z] for x, z in xz] + [[x, y1, z] for x, z in xz]
    faces = []
    for i in range(1, n - 1):
        faces.append([0, i, i + 1])
    for i in range(1, n - 1):
        faces.append([n, n + i + 1, n + i])
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j])
        faces.append([i, n + j, n + i])
    return make_mesh(verts, faces, color, name, layer)


def _rect_corners(r):
    x1, y1, x2, y2 = r
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]


def create_frustum_ring_mesh(outer, z_top, inner, z_bot, color, name, layer=None) -> Dict:
    """Four sloped batter faces from an outer (crest) rectangle at z_top to a
    smaller concentric inner (toe) rectangle at z_bot. Equal rects give a
    vertical ring (pit exterior skirt)."""
    o = _rect_corners(outer)
    i = _rect_corners(inner)
    verts: List[List[float]] = []
    faces: List[List[int]] = []
    for s in range(4):
        t = (s + 1) % 4
        _push_quad(verts, faces,
                   [o[s][0], o[s][1], z_top], [o[t][0], o[t][1], z_top],
                   [i[t][0], i[t][1], z_bot], [i[s][0], i[s][1], z_bot])
    return make_mesh(verts, faces, color, name, layer)


def create_flat_ring_mesh(inner, outer, z, color, name, layer=None) -> Dict:
    """Horizontal band between two concentric rectangles (bench berm)."""
    o = _rect_corners(outer)
    i = _rect_corners(inner)
    verts: List[List[float]] = []
    faces: List[List[int]] = []
    for s in range(4):
        t = (s + 1) % 4
        _push_quad(verts, faces,
                   [o[s][0], o[s][1], z], [o[t][0], o[t][1], z],
                   [i[t][0], i[t][1], z], [i[s][0], i[s][1], z])
    return make_mesh(verts, faces, color, name, layer)


def create_flat_rect_mesh(r, z, color, name, layer=None) -> Dict:
    """Filled horizontal rectangle at a fixed height (pit floor)."""
    c = _rect_corners(r)
    return make_mesh(
        [[p[0], p[1], z] for p in c],
        [[0, 3, 2], [0, 2, 1]],
        color, name, layer,
    )


def create_ramp_ribbon_mesh(stations, skirt, color, name, layer=None) -> Dict:
    """Haul-road ramp ribbon descending between stations, with side skirts."""
    verts: List[List[float]] = []
    faces: List[List[int]] = []
    for i in range(len(stations) - 1):
        s, t = stations[i], stations[i + 1]
        _push_quad(verts, faces,
                   [s["x1"], s["y1"], s["z"]], [t["x1"], t["y1"], t["z"]],
                   [t["x2"], t["y2"], t["z"]], [s["x2"], s["y2"], s["z"]])
        _push_quad(verts, faces,
                   [t["x1"], t["y1"], t["z"]], [s["x1"], s["y1"], s["z"]],
                   [s["x1"], s["y1"], s["z"] - skirt], [t["x1"], t["y1"], t["z"] - skirt])
        _push_quad(verts, faces,
                   [s["x2"], s["y2"], s["z"]], [t["x2"], t["y2"], t["z"]],
                   [t["x2"], t["y2"], t["z"] - skirt], [s["x2"], s["y2"], s["z"] - skirt])
    return make_mesh(verts, faces, color, name, layer)


def create_heightfield_meshes(w, h, nx, ny, height_at, z_split,
                              low_color, high_color, name) -> List[Dict]:
    """Triangulated heightfield split into two tone bands at z_split."""
    verts: List[List[float]] = []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x, y = (i / nx) * w, (j / ny) * h
            verts.append([x, y, height_at(x, y)])

    def idx(i, j):
        return j * (nx + 1) + i

    low_v, low_f, high_v, high_f = [], [], [], []
    low_remap: Dict[int, int] = {}
    high_remap: Dict[int, int] = {}

    def take(target, remap, k):
        if k not in remap:
            remap[k] = len(target)
            target.append(verts[k])
        return remap[k]

    for j in range(ny):
        for i in range(nx):
            a, b, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            for tri in ((a, c, b), (a, d, c)):
                avg = (verts[tri[0]][2] + verts[tri[1]][2] + verts[tri[2]][2]) / 3
                if avg >= z_split:
                    v, f, r = high_v, high_f, high_remap
                else:
                    v, f, r = low_v, low_f, low_remap
                f.append([take(v, r, tri[0]), take(v, r, tri[1]), take(v, r, tri[2])])
    return [
        make_mesh(low_v, low_f, low_color, f"{name}_low", "TERRAIN"),
        make_mesh(high_v, high_f, high_color, f"{name}_high", "TERRAIN"),
    ]


# ─── Open Pit Mine Generator ─────────────────────────────────────────────────

def generate_open_pit(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate an open pit mine with benches, ramp/haul road, and optional crusher/dump.
    
    Parameters:
        bench_height: Height of each bench (m)
        bench_width: Width of each bench berm (m)
        num_benches: Number of benches
        pit_length: Length of pit at surface (m)
        pit_width: Width of pit at surface (m)
        haul_road_width: Width of the haul road / ramp (m)
        overall_slope: Overall slope angle (degrees)
        batter_angle: Face angle of individual bench (degrees, default 75)
    """
    bench_height = params.get("bench_height", 10)
    bench_width = params.get("bench_width", 8)
    num_benches = params.get("num_benches", 5)
    pit_length = params.get("pit_length", 300)
    pit_width = params.get("pit_width", 200)
    haul_road_width = params.get("haul_road_width", 22)
    overall_slope = params.get("overall_slope", 55)
    batter_angle = params.get("batter_angle", 75)
    # Avoid division by zero at 0°/90° in the setback calculation
    batter_angle = min(max(batter_angle, 1.0), 89.0)

    primitives_2d = []
    meshes_3d = []
    layers = []

    # Calculate the horizontal setback per bench
    face_setback = bench_height / math.tan(math.radians(batter_angle))
    total_setback = face_setback + bench_width

    # ── Plan View (2D) — Concentric Bench Outlines ──
    layer_crest = "PIT-CREST"
    layer_toe = "PIT-TOE"
    layer_road = "HAUL-ROAD"
    layer_dims = "DIMENSIONS"
    layer_text = "TEXT"
    layers.extend([
        {"name": layer_crest, "color": 1, "description": "Bench crest lines"},
        {"name": layer_toe, "color": 5, "description": "Bench toe lines"},
        {"name": layer_road, "color": 3, "description": "Haul road"},
        {"name": layer_dims, "color": 2, "description": "Dimensions"},
        {"name": layer_text, "color": 7, "description": "Text annotations"},
    ])

    # Title
    primitives_2d.append(make_text(-pit_length/2, pit_width/2 + 30, f"OPEN PIT MINE — PLAN VIEW", 5.0, layer_text, 7))
    primitives_2d.append(make_text(-pit_length/2, pit_width/2 + 20, 
        f"Benches: {num_benches} × {bench_height}m H × {bench_width}m W  |  Haul Road: {haul_road_width}m  |  Slope: {overall_slope}°", 2.5, layer_text, 8))

    bench_outlines_crest = []
    bench_outlines_toe = []

    for i in range(num_benches):
        offset = i * total_setback
        # Crest rectangle (outer edge of bench)
        cx1 = -pit_length / 2 + offset
        cy1 = -pit_width / 2 + offset
        cx2 = pit_length / 2 - offset
        cy2 = pit_width / 2 - offset

        if cx2 <= cx1 or cy2 <= cy1:
            break

        crest_pts = [(cx1, cy1), (cx2, cy1), (cx2, cy2), (cx1, cy2)]
        primitives_2d.append(make_polyline(crest_pts, closed=True, layer=layer_crest, color=1))
        bench_outlines_crest.append(crest_pts)

        # Toe rectangle (inner edge after face)
        tx1 = cx1 + face_setback
        ty1 = cy1 + face_setback
        tx2 = cx2 - face_setback
        ty2 = cy2 - face_setback

        if tx2 > tx1 and ty2 > ty1:
            toe_pts = [(tx1, ty1), (tx2, ty1), (tx2, ty2), (tx1, ty2)]
            primitives_2d.append(make_polyline(toe_pts, closed=True, layer=layer_toe, color=5))
        bench_outlines_toe.append((tx1, ty1, tx2, ty2))

        # Bench label
        primitives_2d.append(make_text(cx2 + 5, (cy1 + cy2) / 2, f"Bench {i+1}", 2.0, layer_text, 7))

    # ── Haul Road (simplified as a diagonal strip on the east side) ──
    if len(bench_outlines_crest) > 1:
        road_x = pit_length / 2 - 5
        road_pts = []
        for i in range(num_benches):
            offset = i * total_setback
            ry = -pit_width / 2 + offset
            road_pts.append((road_x - offset, ry))
        primitives_2d.append(make_polyline(road_pts, closed=False, layer=layer_road, color=3))
        # Second edge of road
        road_pts2 = [(p[0] - haul_road_width, p[1]) for p in road_pts]
        primitives_2d.append(make_polyline(road_pts2, closed=False, layer=layer_road, color=3))

    # ── Dimensions ──
    if bench_outlines_crest:
        first = bench_outlines_crest[0]
        # Pit length dimension
        primitives_2d.append(make_dimension(first[0][0], first[0][1] - 15, first[1][0], first[1][1] - 15, f"{pit_length} m", layer_dims))
        # Pit width dimension
        primitives_2d.append(make_dimension(first[0][0] - 15, first[0][1], first[3][0] - 15, first[3][1], f"{pit_width} m", layer_dims))

    # ── Cross Section (2D) ──
    section_offset_y = -pit_width / 2 - 80
    primitives_2d.append(make_text(-pit_length/2, section_offset_y + 30, "CROSS SECTION A-A'", 4.0, layer_text, 7))

    # Draw stepped cross section
    section_pts = []
    sx = -pit_length / 2
    sy = section_offset_y
    section_pts.append((sx, sy))  # ground level left

    for i in range(num_benches):
        berm_x = sx + i * total_setback
        # Crest point
        section_pts.append((berm_x, sy - i * bench_height))
        # Face (go down)
        face_bottom_x = berm_x + face_setback
        section_pts.append((face_bottom_x, sy - (i + 1) * bench_height))
        # Bench berm (go right)
        berm_end_x = face_bottom_x + bench_width
        section_pts.append((berm_end_x, sy - (i + 1) * bench_height))

    # Mirror for right side
    center_x = 0
    pit_bottom_y = sy - num_benches * bench_height
    section_pts.append((center_x, pit_bottom_y))  # pit bottom center

    right_pts = []
    for i in range(num_benches - 1, -1, -1):
        berm_x_r = pit_length / 2 - i * total_setback
        right_pts.append((berm_x_r - bench_width, sy - (i + 1) * bench_height))
        right_pts.append((berm_x_r - bench_width + face_setback, sy - (i + 1) * bench_height))
        right_pts.append((berm_x_r, sy - i * bench_height))

    right_pts.append((pit_length / 2, sy))
    section_pts.extend(right_pts)

    primitives_2d.append(make_polyline(section_pts, closed=False, layer=layer_crest, color=1))

    # Bench height dimensions on section
    for i in range(min(3, num_benches)):
        berm_x = sx + i * total_setback
        dim_x = berm_x - 10
        primitives_2d.append(make_dimension(dim_x, sy - i * bench_height, dim_x, sy - (i+1) * bench_height, f"{bench_height} m", layer_dims))

    # ── 3D stepped pit shell ──
    built = len(bench_outlines_crest)
    if built > 0:
        pit_depth = built * bench_height
        for i in range(built):
            z_top = -i * bench_height
            z_bot = -(i + 1) * bench_height
            tone = C["waste_bench"][i % len(C["waste_bench"])]
            c = bench_outlines_crest[i]
            crest_rect = (c[0][0], c[0][1], c[2][0], c[2][1])
            toe_rect = bench_outlines_toe[i]
            meshes_3d.append(create_frustum_ring_mesh(
                crest_rect, z_top, toe_rect, z_bot, _shade(tone, 0.85),
                f"pit_bench_{i + 1}_batter", "PIT-SLOPES"))
            if i + 1 < built:
                n = bench_outlines_crest[i + 1]
                next_crest = (n[0][0], n[0][1], n[2][0], n[2][1])
                meshes_3d.append(create_flat_ring_mesh(
                    toe_rect, next_crest, z_bot, tone,
                    f"pit_bench_{i + 1}_berm", "PIT-BERMS"))
        # Exterior skirt: vertical walls from surface crest down to pit floor
        c0 = bench_outlines_crest[0]
        crest0 = (c0[0][0], c0[0][1], c0[2][0], c0[2][1])
        meshes_3d.append(create_frustum_ring_mesh(
            crest0, 0.0, crest0, -pit_depth,
            _shade(C["waste_bench"][0], 0.8), "pit_exterior_skirt", "PIT-SLOPES"))
        # Pit floor at final toe level
        last_toe = bench_outlines_toe[built - 1]
        if last_toe[2] > last_toe[0] and last_toe[3] > last_toe[1]:
            floor_rect = last_toe
        else:
            floor_rect = crest0
        meshes_3d.append(create_flat_rect_mesh(
            floor_rect, -pit_depth, C["pit_floor"], "pit_floor", "PIT-FLOOR"))

        # Haul-road ramp: ribbon descending the east wall station-to-station
        road_stations = []
        for i in range(built):
            offset = i * total_setback
            road_x = pit_length / 2 - offset - 5
            ry = -pit_width / 2 + offset
            road_stations.append({
                "x1": road_x, "y1": ry,
                "x2": road_x - haul_road_width, "y2": ry,
                "z": -i * bench_height,
            })
        if len(road_stations) > 1:
            meshes_3d.append(create_ramp_ribbon_mesh(
                road_stations, 2.5, C["haul_road"], "haul_road_ramp", "HAUL-ROAD"))

        # Crest markers at the four pit crest corners (site furniture)
        corners = [(crest0[0], crest0[1]), (crest0[2], crest0[1]),
                   (crest0[2], crest0[3]), (crest0[0], crest0[3])]
        for ci, (mx, my) in enumerate(corners):
            meshes_3d.append(create_box_mesh(
                mx - 1, my - 1, 0, 2, 2, 3,
                C["equipment_orange"], "SURVEY-MARKERS", f"crest_marker_{ci}"))

    properties = {
        "name": "Open Pit Mine",
        "bench_height": bench_height,
        "bench_width": bench_width,
        "num_benches": num_benches,
        "pit_length": pit_length,
        "pit_width": pit_width,
        "haul_road_width": haul_road_width,
        "overall_slope": overall_slope,
        "batter_angle": batter_angle,
        "total_depth": num_benches * bench_height,
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {
            "minX": -pit_length/2 - 30,
            "minY": -pit_width/2 - 150,
            "maxX": pit_length/2 + 30,
            "maxY": pit_width/2 + 50,
        }
    }


# ─── Room and Pillar Mine Generator ──────────────────────────────────────────

def generate_room_and_pillar(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a room-and-pillar underground mine layout.
    """
    room_width = params.get("room_width", 6)
    pillar_width = params.get("pillar_width", 8)
    # Keep cell size positive so the extraction-ratio division stays defined
    room_width = max(room_width, 0.1)
    pillar_width = max(pillar_width, 0.1)
    num_rooms_x = params.get("num_rooms_x", 5)
    num_rooms_y = params.get("num_rooms_y", 4)
    room_height = params.get("room_height", 3)
    entry_width = params.get("entry_width", 5)

    primitives_2d = []
    meshes_3d = []

    cell_w = room_width + pillar_width
    cell_h = room_width + pillar_width
    total_w = num_rooms_x * cell_w + pillar_width
    total_h = num_rooms_y * cell_h + pillar_width

    layers = [
        {"name": "PILLARS", "color": 4, "description": "Mine pillars"},
        {"name": "ROOMS", "color": 7, "description": "Mine rooms / entries"},
        {"name": "ENTRY", "color": 3, "description": "Main entries"},
        {"name": "DIMENSIONS", "color": 2, "description": "Dimensions"},
        {"name": "TEXT", "color": 7, "description": "Text annotations"},
    ]

    primitives_2d.append(make_text(0, total_h + 20, "ROOM & PILLAR MINE — PLAN VIEW", 5.0, "TEXT", 7))
    primitives_2d.append(make_text(0, total_h + 10, 
        f"Rooms: {room_width}m × {num_rooms_x}×{num_rooms_y}  |  Pillars: {pillar_width}m  |  Height: {room_height}m", 2.5, "TEXT", 8))

    # Outer boundary
    primitives_2d.append(make_polyline([(0,0), (total_w, 0), (total_w, total_h), (0, total_h)], closed=True, layer="ROOMS", color=7))

    # Draw pillars
    for ix in range(num_rooms_x + 1):
        for iy in range(num_rooms_y + 1):
            px = ix * cell_w
            py = iy * cell_h
            pillar_pts = [
                (px, py), (px + pillar_width, py),
                (px + pillar_width, py + pillar_width), (px, py + pillar_width)
            ]
            primitives_2d.append(make_polyline(pillar_pts, closed=True, layer="PILLARS", color=4))
            primitives_2d.append(make_hatch(pillar_pts, "ANSI31", "PILLARS", 8))

            # 3D pillar
            meshes_3d.append(create_box_mesh(px, py, 0, pillar_width, pillar_width, room_height,
                                             C["pillar_rock"], "PILLARS"))

    # Room labels
    for ix in range(num_rooms_x):
        for iy in range(num_rooms_y):
            rx = ix * cell_w + pillar_width + room_width / 2
            ry = iy * cell_h + pillar_width + room_width / 2
            primitives_2d.append(make_text(rx - 2, ry, f"R{ix+1}-{iy+1}", 1.5, "TEXT", 7))

    # Main entry (corridor along bottom)
    entry_y = -entry_width - 5
    primitives_2d.append(make_polyline(
        [(-10, entry_y), (total_w + 10, entry_y), (total_w + 10, entry_y + entry_width), (-10, entry_y + entry_width)],
        closed=True, layer="ENTRY", color=3
    ))
    primitives_2d.append(make_text(total_w / 2 - 10, entry_y + 1, "MAIN ENTRY", 2.0, "TEXT", 3))
    meshes_3d.append(create_box_mesh(-10, entry_y, 0, total_w + 20, entry_width, room_height,
                                     C["roadway_gravel"], "ENTRY"))

    # Floor and roof planes at consistent z (roof renders translucent in 3D)
    meshes_3d.append(create_box_mesh(-2, entry_y - 2, -0.6, total_w + 4, total_h - entry_y + 4, 0.6,
                                     C["floor_rock"], "FLOOR"))
    meshes_3d.append(create_box_mesh(-2, entry_y - 2, room_height, total_w + 4, total_h - entry_y + 4, 0.5,
                                     C["roof_rock"], "ROOF"))

    # Dimensions
    primitives_2d.append(make_dimension(0, -25, pillar_width, -25, f"{pillar_width} m", "DIMENSIONS"))
    primitives_2d.append(make_dimension(pillar_width, -25, pillar_width + room_width, -25, f"{room_width} m", "DIMENSIONS"))

    properties = {
        "name": "Room & Pillar Mine",
        "room_width": room_width,
        "pillar_width": pillar_width,
        "num_rooms_x": num_rooms_x,
        "num_rooms_y": num_rooms_y,
        "room_height": room_height,
        "entry_width": entry_width,
        "extraction_ratio": round((room_width**2) / ((room_width + pillar_width)**2) * 100, 1),
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -20, "minY": entry_y - 30, "maxX": total_w + 20, "maxY": total_h + 40}
    }


# ─── Ventilation Network Generator ───────────────────────────────────────────

def generate_ventilation_network(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a ventilation network layout."""
    num_airways = params.get("num_airways", 6)
    airway_length = params.get("airway_length", 100)
    shaft_diameter = params.get("shaft_diameter", 6)
    fan_power = params.get("fan_power", 200)

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "AIRWAYS", "color": 6, "description": "Ventilation airways"},
        {"name": "SHAFTS", "color": 1, "description": "Ventilation shafts"},
        {"name": "FANS", "color": 3, "description": "Ventilation fans"},
        {"name": "TEXT", "color": 7, "description": "Text"},
        {"name": "DIMENSIONS", "color": 2, "description": "Dimensions"},
    ]

    primitives_2d.append(make_text(0, 80, "VENTILATION NETWORK", 5.0, "TEXT", 7))

    # Intake shaft
    primitives_2d.append(make_circle(0, 0, shaft_diameter, "SHAFTS", 1))
    primitives_2d.append(make_text(-8, -shaft_diameter - 5, "INTAKE SHAFT", 2.0, "TEXT", 1))

    # Exhaust shaft
    ex_x = airway_length * 2
    primitives_2d.append(make_circle(ex_x, 0, shaft_diameter, "SHAFTS", 1))
    primitives_2d.append(make_text(ex_x - 8, -shaft_diameter - 5, "EXHAUST SHAFT", 2.0, "TEXT", 1))

    # Airways (horizontal and connecting)
    spacing = 30
    for i in range(num_airways):
        y = -spacing * (i + 1)
        # Horizontal airway
        primitives_2d.append(make_line(0, y, ex_x, y, "AIRWAYS", 6))
        primitives_2d.append(make_text(ex_x / 2 - 5, y + 2, f"Airway {i+1}", 1.5, "TEXT", 6))
        # Duct just below surface level
        meshes_3d.append(create_box_mesh(0, y - 1.5, -2.5, ex_x, 3, 3, C["duct_steel"], "AIRWAYS"))

    # Vertical connections
    bottom_y = -spacing * (num_airways + 1)
    primitives_2d.append(make_line(0, 0, 0, bottom_y, "AIRWAYS", 6))
    primitives_2d.append(make_line(ex_x, 0, ex_x, bottom_y, "AIRWAYS", 6))

    # Vertical manifold ducts at each shaft tying the airways into a network
    meshes_3d.append(create_box_mesh(-1.5, bottom_y, -2.5, 3, -bottom_y + 1.5, 3, C["duct_steel"], "AIRWAYS"))
    meshes_3d.append(create_box_mesh(ex_x - 1.5, bottom_y, -2.5, 3, -bottom_y + 1.5, 3, C["duct_steel"], "AIRWAYS"))

    # Shaft collars rising above surface and a main fan on the exhaust shaft
    meshes_3d.append(create_cylinder_mesh(0, 0, 0, 4, shaft_diameter * 0.8, 16,
                                          C["concrete"], "intake_shaft_collar", "SHAFTS"))
    meshes_3d.append(create_cylinder_mesh(ex_x, 0, 0, 4, shaft_diameter * 0.8, 16,
                                          C["concrete"], "exhaust_shaft_collar", "SHAFTS"))

    # Fan symbol at exhaust
    fan_r = shaft_diameter * 1.5
    primitives_2d.append(make_circle(ex_x, shaft_diameter + fan_r + 3, fan_r, "FANS", 3))
    primitives_2d.append(make_text(ex_x - 3, shaft_diameter + fan_r + 2, "FAN", 2.0, "TEXT", 3))
    meshes_3d.append(create_cylinder_mesh(ex_x, 0, 4, 4 + fan_r * 0.9, fan_r * 0.75, 20,
                                          C["equipment_orange"], "main_fan", "FANS"))
    meshes_3d.append(create_cylinder_mesh(ex_x, 0, 4 + fan_r * 0.9, 4 + fan_r * 1.1, fan_r * 0.25, 12,
                                          C["trestle_steel"], "main_fan_hub", "FANS"))

    properties = {
        "name": "Ventilation Network",
        "num_airways": num_airways,
        "airway_length": airway_length,
        "shaft_diameter": shaft_diameter,
        "fan_power_kw": fan_power,
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -30, "minY": bottom_y - 30, "maxX": ex_x + 30, "maxY": 80}
    }


# ─── Conveyor Route Generator ────────────────────────────────────────────────

def generate_conveyor(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a conveyor route."""
    length = params.get("length", 200)
    width = params.get("width", 1.2)
    inclination = params.get("inclination", 15)
    start_x = params.get("start_x", 0)
    start_y = params.get("start_y", 0)
    end_x = params.get("end_x", length)
    end_y = params.get("end_y", 0)
    belt_speed = params.get("belt_speed", 3.5)

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "CONVEYOR", "color": 5, "description": "Conveyor belt"},
        {"name": "STRUCTURE", "color": 8, "description": "Support structure"},
        {"name": "TEXT", "color": 7, "description": "Text"},
        {"name": "DIMENSIONS", "color": 2, "description": "Dimensions"},
    ]

    # Calculate direction vector
    dx = end_x - start_x
    dy = end_y - start_y
    route_length = math.sqrt(dx**2 + dy**2)
    if route_length == 0 and length <= 0:
        raise ValueError(
            "Conveyor route is degenerate: start equals end and length is 0. "
            "Provide distinct start/end points or a positive length."
        )
    actual_length = route_length or length
    # Unit direction along the 2D route; when start == end there is no 2D
    # direction, so both 2D and 3D stay at the start point (no +x drift).
    if route_length > 0:
        ux, uy = dx / route_length, dy / route_length
    else:
        ux, uy = 0.0, 0.0
    # Perpendicular (for belt width); default to +y when the route is a point
    if route_length > 0:
        nx, ny = -uy, ux
    else:
        nx, ny = 0.0, 1.0

    primitives_2d.append(make_text(start_x, start_y + 20, "CONVEYOR ROUTE", 5.0, "TEXT", 7))

    # Belt edges
    hw = width * 5  # Scale up for visibility
    p1 = (start_x + nx * hw, start_y + ny * hw)
    p2 = (end_x + nx * hw, end_y + ny * hw)
    p3 = (end_x - nx * hw, end_y - ny * hw)
    p4 = (start_x - nx * hw, start_y - ny * hw)
    primitives_2d.append(make_polyline([p1, p2, p3, p4], closed=True, layer="CONVEYOR", color=5))

    # Center line
    primitives_2d.append(make_line(start_x, start_y, end_x, end_y, "CONVEYOR", 3))

    # Support structures (every 10m), marching along the actual 2D route
    num_supports = int(actual_length / 10)
    for i in range(num_supports + 1):
        t = i / max(num_supports, 1)
        sx = start_x + ux * route_length * t
        sy = start_y + uy * route_length * t
        s1 = (sx + nx * hw * 1.3, sy + ny * hw * 1.3)
        s2 = (sx - nx * hw * 1.3, sy - ny * hw * 1.3)
        primitives_2d.append(make_line(s1[0], s1[1], s2[0], s2[1], "STRUCTURE", 8))

    # Dimension
    primitives_2d.append(make_dimension(start_x, start_y - 15, end_x, end_y - 15, f"{actual_length:.0f} m", "DIMENSIONS"))

    # 3D: inclined belt following the actual route direction and the declared
    # inclination. Degenerate route (start == end) falls back to +X, matching
    # the frontend engine.
    if route_length > 0:
        route_dx, route_dy = dx, dy
    else:
        route_dx, route_dy = actual_length, 0.0
    route_end_x = start_x + route_dx
    route_end_y = start_y + route_dy
    rise = actual_length * math.tan(math.radians(inclination))

    # Belt: inclined box, carrying surface on top
    meshes_3d.append(create_inclined_box_mesh(
        start_x, start_y, 0, route_end_x, route_end_y, rise,
        width * 10, 2, C["conveyor_belt"], "conveyor_belt", "CONVEYOR"))
    # Gallery rail along the belt edge
    meshes_3d.append(create_inclined_box_mesh(
        start_x, start_y, 2, route_end_x, route_end_y, rise + 2,
        0.8, 1.2, C["trestle_steel"], "conveyor_rail", "STRUCTURE"))

    # Trestle supports marching along the route, ground → belt underside
    for i in range(num_supports + 1):
        t = i / max(num_supports, 1)
        sx = start_x + route_dx * t
        sy = start_y + route_dy * t
        belt_z = rise * t
        post_w = max(1.2, width * 3)
        meshes_3d.append(create_box_mesh(
            sx - post_w / 2, sy - post_w / 2, 0, post_w, post_w, max(belt_z, 0.5),
            C["trestle_steel"], "STRUCTURE"))
        pad_w = width * 10
        meshes_3d.append(create_box_mesh(
            sx - pad_w / 2, sy - pad_w / 2, max(belt_z - 0.5, 0), pad_w, pad_w, 0.5,
            C["trestle_steel"], "STRUCTURE"))

    properties = {
        "name": "Conveyor Route",
        "length": actual_length,
        "width": width,
        "inclination": inclination,
        "belt_speed": belt_speed,
        "start": [start_x, start_y],
        "end": [end_x, end_y],
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": min(start_x, end_x) - 30, "minY": min(start_y, end_y) - 30, 
                   "maxX": max(start_x, end_x) + 30, "maxY": max(start_y, end_y) + 40}
    }


# ─── Blast Pattern Generator ─────────────────────────────────────────────────

def generate_blast_pattern(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a blast hole layout."""
    burden = params.get("burden", 4)
    spacing = params.get("spacing", 5)
    num_rows = params.get("num_rows", 4)
    num_holes_per_row = params.get("num_holes_per_row", 8)
    hole_diameter = params.get("hole_diameter", 0.2)
    hole_depth = params.get("hole_depth", 12)
    pattern = params.get("pattern", "staggered")

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "BLASTHOLES", "color": 1, "description": "Blast holes"},
        {"name": "PATTERN", "color": 5, "description": "Pattern grid"},
        {"name": "FREE-FACE", "color": 3, "description": "Free face"},
        {"name": "TEXT", "color": 7, "description": "Text"},
        {"name": "DIMENSIONS", "color": 2, "description": "Dimensions"},
    ]

    primitives_2d.append(make_text(0, num_rows * burden + 20, "BLAST PATTERN LAYOUT", 5.0, "TEXT", 7))
    primitives_2d.append(make_text(0, num_rows * burden + 10,
        f"Burden: {burden}m  |  Spacing: {spacing}m  |  Depth: {hole_depth}m  |  Pattern: {pattern}", 2.5, "TEXT", 8))

    # Free face line
    total_width = (num_holes_per_row - 1) * spacing + spacing
    primitives_2d.append(make_line(-5, 0, total_width + 5, 0, "FREE-FACE", 3))
    primitives_2d.append(make_text(total_width / 2 - 5, -5, "FREE FACE", 2.0, "TEXT", 3))

    for row in range(num_rows):
        y = (row + 1) * burden
        x_offset = (spacing / 2) if (pattern == "staggered" and row % 2 == 1) else 0
        for col in range(num_holes_per_row):
            x = col * spacing + x_offset + spacing / 2
            # Drill hole circle
            primitives_2d.append(make_circle(x, y, hole_diameter * 5, "BLASTHOLES", 1))
            # 3D drill hole cylinder + collar marker
            r = max(0.25, hole_diameter)
            meshes_3d.append(create_cylinder_mesh(x, y, -hole_depth, 0, r, 8,
                                                  C["blast_hole"], f"blast_hole_{row}_{col}", "BLASTHOLES"))
            meshes_3d.append(create_cylinder_mesh(x, y, 0, 0.5, r * 2, 8,
                                                  C["equipment_orange"], f"blast_hole_{row}_{col}_collar", "BLASTHOLES"))

    # Dimensions
    primitives_2d.append(make_dimension(spacing/2, burden, spacing/2, burden * 2, f"{burden} m", "DIMENSIONS"))
    primitives_2d.append(make_dimension(spacing/2, burden - 3, spacing/2 + spacing, burden - 3, f"{spacing} m", "DIMENSIONS"))

    properties = {
        "name": "Blast Pattern",
        "burden": burden,
        "spacing": spacing,
        "num_rows": num_rows,
        "num_holes_per_row": num_holes_per_row,
        "hole_diameter": hole_diameter,
        "hole_depth": hole_depth,
        "pattern": pattern,
        "total_holes": num_rows * num_holes_per_row,
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -10, "minY": -15, "maxX": total_width + 10, "maxY": num_rows * burden + 30}
    }


# ─── Decline / Shaft Generator ───────────────────────────────────────────────

def generate_decline(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate an underground decline/ramp."""
    width = params.get("width", 5)
    height = params.get("height", 4.5)
    gradient = params.get("gradient", 10)  # percent
    total_length = params.get("total_length", 500)
    num_levels = max(1, int(params.get("num_levels", 4)))
    level_spacing = params.get("level_spacing", 30)

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "DECLINE", "color": 5, "description": "Decline tunnel"},
        {"name": "LEVELS", "color": 3, "description": "Level access"},
        {"name": "TEXT", "color": 7, "description": "Text"},
        {"name": "DIMENSIONS", "color": 2, "description": "Dimensions"},
    ]

    primitives_2d.append(make_text(0, 40, "DECLINE ACCESS", 5.0, "TEXT", 7))

    # Draw zigzag decline in plan view
    segment_length = total_length / (num_levels * 2)
    pts_center = []
    x, y = 0, 0
    direction = 1
    for i in range(num_levels * 2):
        pts_center.append((x, y))
        x += segment_length * direction
        y -= level_spacing / 2
        if i % 2 == 1:
            direction *= -1

    pts_center.append((x, y))

    # Offset for width
    for pt in pts_center:
        primitives_2d.append(make_circle(pt[0], pt[1], 1.5, "DECLINE", 5))

    primitives_2d.append(make_polyline(pts_center, closed=False, layer="DECLINE", color=5))

    # Level access crosscuts — the decline descends continuously (segment i
    # drops from d_i to d_{i+1}), so level k (depth k·level_spacing) is hit
    # exactly at vertex pts_center[2k].
    total_depth = num_levels * level_spacing
    num_segments = num_levels * 2
    for i in range(num_levels):
        ly = -level_spacing * (i + 1)
        attach = pts_center[min(2 * (i + 1), len(pts_center) - 1)]
        lx = attach[0]
        primitives_2d.append(make_line(lx, ly, lx + 40, ly, "LEVELS", 3))
        primitives_2d.append(make_text(lx + 42, ly - 1, f"Level {i+1}", 2.0, "TEXT", 3))
        meshes_3d.append(create_inclined_box_mesh(
            lx, ly, -(i + 1) * level_spacing, lx + 40, ly, -(i + 1) * level_spacing,
            width, height, C["level_grey"], f"level_{i + 1}_drive", "LEVELS"))

    # 3D decline tunnel segments (inclined, continuous depth gradient)
    for i in range(len(pts_center) - 1):
        p1 = pts_center[i]
        p2 = pts_center[i + 1]
        d1 = (i / num_segments) * total_depth
        d2 = ((i + 1) / num_segments) * total_depth
        meshes_3d.append(create_inclined_box_mesh(
            p1[0], p1[1], -d1, p2[0], p2[1], -d2,
            width, height, C["tunnel_grey"], f"decline_segment_{i}", "DECLINE"))

    # Portal frame at the surface entrance
    meshes_3d.append(create_box_mesh(
        pts_center[0][0] - width / 2, pts_center[0][1] - width / 2, 0, width, width, height,
        C["roadway_gravel"], "DECLINE", "decline_portal"))

    properties = {
        "name": "Decline Access",
        "width": width,
        "height": height,
        "gradient": gradient,
        "total_length": total_length,
        "num_levels": num_levels,
        "level_spacing": level_spacing,
    }

    total_depth = num_levels * level_spacing
    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -30, "minY": -total_depth - 30, "maxX": segment_length + 60, "maxY": 60}
    }


# ─── Mine Survey Traverse Generator ──────────────────────────────────────────

def generate_mine_survey_traverse(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate Total Station traverse loop with station coordinates, bearings, and closure error."""
    num_stations = max(1, int(params.get("num_stations", 5)))
    start_e = float(params.get("starting_easting", 1000.0))
    start_n = float(params.get("starting_northing", 2000.0))
    start_z = float(params.get("starting_elevation", 150.0))
    avg_dist = float(params.get("avg_segment_len", 80.0))

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "SURVEY-STATIONS", "color": 1, "description": "Control station points"},
        {"name": "TRAVERSE-LINES", "color": 4, "description": "Traverse sight lines"},
        {"name": "BOUNDARY-FENCE", "color": 3, "description": "Lease boundary"},
        {"name": "TEXT", "color": 7, "description": "Annotations & Coordinates"},
        {"name": "DIMENSIONS", "color": 2, "description": "Bearings & Distances"},
    ]

    primitives_2d.append(make_text(start_e - 40, start_n + 60, "MINE SURVEY TRAVERSE & CONTROL LOOP", 6.0, "TEXT", 7))

    # Calculate traverse station coordinates around a polygon loop
    stations = []
    angle_step = (2 * math.pi) / num_stations
    curr_e, curr_n, curr_z = start_e, start_n, start_z

    for i in range(num_stations):
        stn_id = f"STN-0{i+1}" if i < 9 else f"STN-{i+1}"
        code = "CONTROL" if i == 0 else "TRAVERSE"
        stations.append({
            "station": stn_id,
            "easting": round(curr_e, 3),
            "northing": round(curr_n, 3),
            "elevation": round(curr_z, 3),
            "code": code,
        })

        # Calculate next station point
        bearing = (i * angle_step) + math.radians(25)
        dist = avg_dist * (0.9 + 0.2 * ((i % 3) / 3))
        curr_e += dist * math.sin(bearing)
        curr_n += dist * math.cos(bearing)
        curr_z += (i % 2 == 0) * 1.5 - 0.5

    # Connect back to start for closed loop error check
    closure_error_e = round((curr_e - start_e) * 0.05, 3)
    closure_error_n = round((curr_n - start_n) * 0.05, 3)
    total_len = sum(avg_dist for _ in range(num_stations))
    precision_ratio = f"1 : {int(total_len / (math.sqrt(closure_error_e**2 + closure_error_n**2) + 0.001))}"

    pts_loop = [(s["easting"], s["northing"]) for s in stations]
    primitives_2d.append(make_polyline(pts_loop, closed=True, layer="TRAVERSE-LINES", color=4))

    # Offset boundary fence polygon
    center_e = sum(s["easting"] for s in stations) / num_stations
    center_n = sum(s["northing"] for s in stations) / num_stations
    fence_pts = []
    for s in stations:
        de = s["easting"] - center_e
        dn = s["northing"] - center_n
        fence_pts.append((s["easting"] + de * 0.25, s["northing"] + dn * 0.25))

    primitives_2d.append(make_polyline(fence_pts, closed=True, layer="BOUNDARY-FENCE", color=3))

    # Draw station markers and text
    for i, s in enumerate(stations):
        e, n, z = s["easting"], s["northing"], s["elevation"]
        # Double circle marker for survey control point
        primitives_2d.append(make_circle(e, n, 4.0, "SURVEY-STATIONS", 1))
        primitives_2d.append(make_circle(e, n, 1.5, "SURVEY-STATIONS", 2))

        # Station text info block
        primitives_2d.append(make_text(e + 5, n + 6, f"{s['station']} ({s['code']})", 3.0, "TEXT", 1))
        primitives_2d.append(make_text(e + 5, n + 1, f"E: {e:.2f} m", 2.2, "TEXT", 7))
        primitives_2d.append(make_text(e + 5, n - 4, f"N: {n:.2f} m", 2.2, "TEXT", 7))
        primitives_2d.append(make_text(e + 5, n - 9, f"Z: {z:.2f} m", 2.2, "TEXT", 3))

        # 3D Survey pillar monument
        meshes_3d.append(create_box_mesh(e - 1.0, n - 1.0, 0, 2.0, 2.0, 3.5, "#E74C3C" if i == 0 else "#F39C12"))

        # Bearing & Distance along line
        next_s = stations[(i + 1) % num_stations]
        mid_e = (e + next_s["easting"]) / 2
        mid_n = (n + next_s["northing"]) / 2
        dx = next_s["easting"] - e
        dy = next_s["northing"] - n
        seg_dist = math.sqrt(dx**2 + dy**2)
        bearing_deg = (math.degrees(math.atan2(dx, dy)) + 360) % 360
        primitives_2d.append(make_text(mid_e, mid_n + 3, f"{bearing_deg:.1f}° | {seg_dist:.2f}m", 2.0, "DIMENSIONS", 2))

    properties = {
        "name": "Mine Survey Traverse",
        "num_stations": num_stations,
        "starting_easting": start_e,
        "starting_northing": start_n,
        "starting_elevation": start_z,
        "total_perimeter": round(total_len, 2),
        "misclosure_easting": closure_error_e,
        "misclosure_northing": closure_error_n,
        "precision": precision_ratio,
        "survey_stations": stations,
    }

    min_e = min(s["easting"] for s in stations) - 60
    max_e = max(s["easting"] for s in stations) + 60
    min_n = min(s["northing"] for s in stations) - 60
    max_n = max(s["northing"] for s in stations) + 80

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": min_e, "minY": min_n, "maxX": max_e, "maxY": max_n}
    }


# ─── Topographic Contours Generator ───────────────────────────────────────────

def generate_topographic_contours(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate DTM topographic contour map with major/minor contours and spot heights."""
    interval = float(params.get("contour_interval", 5.0))
    # Keep the step count defined: (max_z - min_z) / interval must not blow up
    interval = max(interval, 0.1)
    grid_w = float(params.get("grid_size_x", 300.0))
    grid_h = float(params.get("grid_size_y", 200.0))
    min_z = float(params.get("min_elevation", 100.0))
    max_z = float(params.get("max_elevation", 160.0))
    if max_z <= min_z:
        max_z = min_z + interval

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "MAJOR-CONTOURS", "color": 1, "description": "Index contours (every 25m)"},
        {"name": "MINOR-CONTOURS", "color": 8, "description": "Intermediate contours"},
        {"name": "SPOT-HEIGHTS", "color": 3, "description": "Survey elevation benchmarks"},
        {"name": "TEXT", "color": 7, "description": "Elevation labels"},
        {"name": "GRID", "color": 7, "description": "Coordinate grid ticks"},
    ]

    primitives_2d.append(make_text(0, grid_h / 2 + 25, "TOPOGRAPHIC SURFACE & DTM CONTOUR MAP", 5.0, "TEXT", 7))

    # Generate synthetic hill contours
    center_x, center_y = grid_w * 0.4, grid_h * 0.5
    num_steps = int((max_z - min_z) / interval)

    for i in range(num_steps + 1):
        elev = min_z + i * interval
        is_major = (int(elev) % 25 == 0)
        layer = "MAJOR-CONTOURS" if is_major else "MINOR-CONTOURS"
        color = 1 if is_major else 8

        # Elliptical contour rings around hill center
        rx = (max_z - elev) * 3.5 + 20
        ry = (max_z - elev) * 2.2 + 15

        pts = []
        for a in range(0, 360, 10):
            rad = math.radians(a)
            # Add subtle terrain noise perturbation
            wobble = 1.0 + 0.08 * math.sin(3 * rad) + 0.05 * math.cos(5 * rad)
            px = center_x + rx * math.cos(rad) * wobble
            py = center_y + ry * math.sin(rad) * wobble
            pts.append((px, py))

        primitives_2d.append(make_polyline(pts, closed=True, layer=layer, color=color))

        # Add elevation text along contour
        if len(pts) > 10:
            lbl_pt = pts[0]
            primitives_2d.append(make_text(lbl_pt[0], lbl_pt[1] + 1.5, f"{int(elev)}m", 2.2 if is_major else 1.6, "TEXT", color))

    # 3D terrain surface: triangulated heightfield from the same ring math as
    # the contours (inverting radius → elevation), split into two tone bands.
    def terrain_height(x, y):
        nx_, ny_ = (x - center_x) / 3.5, (y - center_y) / 2.2
        raw = math.hypot(nx_, ny_)
        a = math.atan2(ny_, nx_)
        wobble = 1.0 + 0.08 * math.sin(3 * a) + 0.05 * math.cos(5 * a)
        h = max_z - raw / wobble
        return min(max_z, max(min_z, h)) - min_z

    meshes_3d.extend(create_heightfield_meshes(
        grid_w, grid_h, 56, 38, terrain_height, (max_z - min_z) / 2,
        C["terrain_low"], C["terrain_high"], "terrain"))

    # Spot height benchmarks
    spot_benchmarks = [
        (center_x, center_y, max_z, "BM-TOP"),
        (center_x - 80, center_y + 40, min_z + 12, "BM-WEST"),
        (center_x + 90, center_y - 30, min_z + 18, "BM-EAST"),
        (center_x + 20, center_y + 60, min_z + 32, "BM-NORTH"),
    ]

    survey_stations = []
    for x, y, z, label in spot_benchmarks:
        primitives_2d.append(make_circle(x, y, 2.5, "SPOT-HEIGHTS", 3))
        primitives_2d.append(make_line(x - 3, y, x + 3, y, "SPOT-HEIGHTS", 3))
        primitives_2d.append(make_line(x, y - 3, x, y + 3, "SPOT-HEIGHTS", 3))
        primitives_2d.append(make_text(x + 3, y + 2, f"{label} ({z:.1f}m)", 2.4, "TEXT", 3))
        meshes_3d.append(create_cylinder_mesh(
            x, y, z - min_z, z - min_z + 3, 1.2, 10,
            C["equipment_yellow"], f"bm_{label.lower()}", "SPOT-HEIGHTS"))
        survey_stations.append({"station": label, "easting": round(x + 1000, 2), "northing": round(y + 2000, 2), "elevation": z, "code": "BENCHMARK"})

    properties = {
        "name": "Topographic Contours",
        "contour_interval": interval,
        "min_elevation": min_z,
        "max_elevation": max_z,
        "grid_size_x": grid_w,
        "grid_size_y": grid_h,
        "total_area_ha": round((grid_w * grid_h) / 10000.0, 2),
        "survey_stations": survey_stations,
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -40, "minY": -40, "maxX": grid_w + 40, "maxY": grid_h + 50}
    }


# ─── Borehole Stratigraphy Generator ─────────────────────────────────────────

def generate_borehole_lithology(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate geological drillhole collars, stratigraphy section, and coal seam seam dip."""
    num_holes = max(1, int(params.get("num_boreholes", 5)))
    spacing = float(params.get("spacing", 50.0))
    total_depth = max(float(params.get("depth", 80.0)), 1.0)
    seam_thick = float(params.get("coal_seam_thickness", 4.5))
    seam_depth = float(params.get("coal_seam_depth", 35.0))
    dip_angle = float(params.get("dip_angle", 8.0))
    if not (0.0 < dip_angle < 85.0):
        raise ValueError(f"dip_angle must be between 0 and 85 degrees, got {dip_angle}")
    # Clamp the seam so it always fits inside the borehole column — otherwise
    # the stratigraphy mesh boxes get negative heights.
    seam_thick = max(0.1, min(seam_thick, total_depth - 0.1))
    seam_depth = max(0.1, min(seam_depth, total_depth - seam_thick))

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "BOREHOLE-COLLARS", "color": 1, "description": "Drillhole collar locations"},
        {"name": "OVERBURDEN", "color": 2, "description": "Soil & weathered clay layer"},
        {"name": "SANDSTONE", "color": 3, "description": "Sandstone strata"},
        {"name": "COAL-SEAM", "color": 7, "description": "Economic coal seam"},
        {"name": "MUDSTONE-FLOOR", "color": 5, "description": "Seam floor mudstone"},
        {"name": "TEXT", "color": 7, "description": "Labels and depths"},
    ]

    primitives_2d.append(make_text(-20, 50, "GEOLOGICAL BOREHOLE & STRATIGRAPHY CROSS SECTION", 5.0, "TEXT", 7))

    tan_dip = math.tan(math.radians(dip_angle))
    seam_top_pts = []
    seam_bot_pts = []
    borehole_data = []

    for i in range(num_holes):
        hx = i * spacing
        hy = 0.0  # Collar elevation ground level
        # Dip increases seam depth from west to east; keep the dipped seam
        # within the total borehole depth so mesh heights stay positive.
        curr_seam_depth = min(seam_depth + hx * tan_dip, total_depth - seam_thick)
        seam_top_y = hy - curr_seam_depth
        seam_bot_y = seam_top_y - seam_thick
        bottom_y = hy - total_depth

        bh_name = f"BH-0{i+1}"
        borehole_data.append({
            "station": bh_name,
            "easting": round(1000 + hx, 2),
            "northing": round(2500, 2),
            "elevation": 120.0,
            "coal_depth_m": round(curr_seam_depth, 2),
            "coal_thickness_m": seam_thick,
            "code": "DRILLHOLE",
        })

        # Borehole vertical centerline
        primitives_2d.append(make_line(hx, hy, hx, bottom_y, "BOREHOLE-COLLARS", 1))
        # Collar triangle symbol
        primitives_2d.append(make_polyline([(hx - 3, hy), (hx + 3, hy), (hx, hy + 5)], closed=True, layer="BOREHOLE-COLLARS", color=1))
        primitives_2d.append(make_text(hx - 8, hy + 8, f"{bh_name} (Collar 0.0m)", 2.4, "TEXT", 1))

        # Lithology boundary ticks
        primitives_2d.append(make_line(hx - 4, hy - 10, hx + 4, hy - 10, "OVERBURDEN", 2))
        primitives_2d.append(make_line(hx - 4, seam_top_y, hx + 4, seam_top_y, "COAL-SEAM", 7))
        primitives_2d.append(make_line(hx - 4, seam_bot_y, hx + 4, seam_bot_y, "COAL-SEAM", 7))

        primitives_2d.append(make_text(hx + 5, seam_top_y, f"Coal Top: -{curr_seam_depth:.1f}m", 1.8, "TEXT", 7))
        primitives_2d.append(make_text(hx + 5, seam_bot_y - 2, f"Thick: {seam_thick}m", 1.8, "TEXT", 2))

        seam_top_pts.append((hx, seam_top_y))
        seam_bot_pts.append((hx, seam_bot_y))

        # 3D drillhole column: overburden → sandstone → coal seam → mudstone
        meshes_3d.append(create_cylinder_mesh(hx, hy, -10, 0, 1, 10,
                                              C["overburden"], f"bh_{i + 1}_overburden", "OVERBURDEN"))
        meshes_3d.append(create_cylinder_mesh(hx, hy, seam_top_y, -10, 1, 10,
                                              C["sandstone"], f"bh_{i + 1}_sandstone", "SANDSTONE"))
        meshes_3d.append(create_cylinder_mesh(hx, hy, seam_bot_y, seam_top_y, 1.3, 10,
                                              C["coal_seam"], f"bh_{i + 1}_coal", "COAL-SEAM"))
        meshes_3d.append(create_cylinder_mesh(hx, hy, bottom_y, seam_bot_y, 1, 10,
                                              C["mudstone"], f"bh_{i + 1}_mudstone", "MUDSTONE-FLOOR"))
        # Collar marker at surface + seam intercept flag
        meshes_3d.append(create_cylinder_mesh(hx, hy, 0, 1, 1.6, 10,
                                              C["equipment_orange"], f"bh_{i + 1}_collar", "BOREHOLE-COLLARS"))
        meshes_3d.append(create_cylinder_mesh(hx, hy, seam_top_y - 0.25, seam_top_y + 0.25, 1.8, 12,
                                              C["equipment_yellow"], f"bh_{i + 1}_seam_marker", "COAL-SEAM"))

    # Draw continuous Coal Seam horizon lines
    primitives_2d.append(make_polyline(seam_top_pts, closed=False, layer="COAL-SEAM", color=7))
    primitives_2d.append(make_polyline(seam_bot_pts, closed=False, layer="COAL-SEAM", color=7))
    # Coal seam shaded block polygon
    coal_poly = seam_top_pts + list(reversed(seam_bot_pts))
    primitives_2d.append(make_hatch(coal_poly, pattern="ANSI31", layer="COAL-SEAM", color=7))

    properties = {
        "name": "Borehole Lithology",
        "num_boreholes": num_holes,
        "spacing": spacing,
        "total_depth": total_depth,
        "coal_seam_thickness": seam_thick,
        "coal_seam_depth": seam_depth,
        "dip_angle_deg": dip_angle,
        "survey_stations": borehole_data,
    }

    max_x = (num_holes - 1) * spacing + 40
    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -40, "minY": -total_depth - 20, "maxX": max_x, "maxY": 60}
    }


# ─── Longwall Panel Generator ────────────────────────────────────────────────

def generate_longwall_panel(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate underground longwall panel with chocks, shearer, headgate, and tailgate."""
    face_w = float(params.get("face_width", 200.0))
    panel_l = float(params.get("panel_length", 800.0))
    seam_h = float(params.get("seam_height", 3.5))
    num_supports = max(1, int(params.get("num_supports", 100)))
    shearer_pos = float(params.get("shearer_position", 80.0))

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "LONGWALL-FACE", "color": 1, "description": "Longwall coal face line"},
        {"name": "POWERED-SUPPORTS", "color": 3, "description": "Hydraulic roof chocks"},
        {"name": "GATEROADS", "color": 5, "description": "Headgate & Tailgate roadways"},
        {"name": "SHEARER", "color": 2, "description": "Coal shearer machine"},
        {"name": "GOAF", "color": 8, "description": "Caved goaf area"},
        {"name": "TEXT", "color": 7, "description": "Annotations"},
    ]

    primitives_2d.append(make_text(-20, face_w + 30, "UNDERGROUND LONGWALL MINING PANEL", 5.0, "TEXT", 7))

    gate_w = 5.5
    # Headgate (bottom roadway) and Tailgate (top roadway)
    primitives_2d.append(make_polyline([(0, -gate_w), (panel_l, -gate_w), (panel_l, 0), (0, 0)], closed=True, layer="GATEROADS", color=5))
    primitives_2d.append(make_polyline([(0, face_w), (panel_l, face_w), (panel_l, face_w + gate_w), (0, face_w + gate_w)], closed=True, layer="GATEROADS", color=5))

    primitives_2d.append(make_text(panel_l / 2, -12, "HEADGATE ROADWAY & BELT CONVEYOR", 2.2, "TEXT", 5))
    primitives_2d.append(make_text(panel_l / 2, face_w + 10, "TAILGATE AIRWAY & RETURN", 2.2, "TEXT", 5))

    # Current face position (mirrors the frontend: capped at 350 m)
    face_x = min(350.0, panel_l * 0.5)
    primitives_2d.append(make_line(face_x, 0, face_x, face_w, "LONGWALL-FACE", 1))

    # Goaf caved area behind face
    goaf_poly = [(0, 0), (face_x - 10, 0), (face_x - 10, face_w), (0, face_w)]
    primitives_2d.append(make_hatch(goaf_poly, pattern="ANSI31", layer="GOAF", color=8))
    primitives_2d.append(make_text(face_x / 2, face_w / 2, "CAVED GOAF AREA", 4.0, "TEXT", 8))

    # Powered roof support chocks along face
    support_spacing = face_w / num_supports
    for i in range(0, num_supports, 4):
        sy = i * support_spacing
        primitives_2d.append(make_polyline([
            (face_x - 6, sy), (face_x - 1, sy), (face_x - 1, sy + support_spacing * 3), (face_x - 6, sy + support_spacing * 3)
        ], closed=True, layer="POWERED-SUPPORTS", color=3))

    # Shearer drum machine symbol
    sp_y = min(max(shearer_pos, 10.0), face_w - 10.0)
    primitives_2d.append(make_circle(face_x, sp_y, 4.0, "SHEARER", 2))
    primitives_2d.append(make_circle(face_x, sp_y, 2.0, "SHEARER", 1))
    primitives_2d.append(make_text(face_x + 6, sp_y, f"Double-Drum Shearer ({sp_y:.1f}m)", 2.0, "TEXT", 2))

    # 3D: gate roads, caved goaf, coal face, powered supports, shearer
    meshes_3d.append(create_box_mesh(0, -gate_w, 0, panel_l, gate_w, seam_h, C["gateroad"], "GATEROADS", "headgate_roadway"))
    meshes_3d.append(create_box_mesh(0, face_w, 0, panel_l, gate_w, seam_h, C["gateroad"], "GATEROADS", "tailgate_roadway"))
    # Caved goaf floor behind the face
    meshes_3d.append(create_box_mesh(0, 0, 0, max(face_x - 10, 1), face_w, 0.4,
                                     C["goaf"], "GOAF", "caved_goaf"))
    # Coal face block (uncut coal ahead of the supports)
    meshes_3d.append(create_box_mesh(face_x - 1.5, 0, 0, 1.5, face_w, seam_h,
                                     C["coal_seam"], "LONGWALL-FACE", "longwall_face"))
    # Powered roof supports along the face (every 4th, matching 2D symbols)
    support_spacing = face_w / num_supports
    for i in range(0, num_supports, 4):
        sy = i * support_spacing
        meshes_3d.append(create_box_mesh(
            face_x - 4.5, sy, 0, 3.5, support_spacing * 3 * 0.9, seam_h * 0.92,
            C["equipment_yellow"], "POWERED-SUPPORTS", f"powered_support_{i}"))
    # Double-drum shearer riding the face at the declared position
    sp_y = min(max(shearer_pos, 10.0), face_w - 10.0)
    meshes_3d.append(create_box_mesh(face_x - 3.2, sp_y - 4, 0, 4.2, 8, seam_h * 0.85,
                                     C["equipment_orange"], "SHEARER", "coal_shearer"))
    meshes_3d.append(create_cylinder_mesh(face_x - 1, sp_y - 4, 0, seam_h * 0.85, 1.4, 10,
                                          C["trestle_steel"], "SHEARER", "shearer_drum_near"))
    meshes_3d.append(create_cylinder_mesh(face_x - 1, sp_y + 4, 0, seam_h * 0.85, 1.4, 10,
                                          C["trestle_steel"], "SHEARER", "shearer_drum_far"))

    properties = {
        "name": "Longwall Panel",
        "face_width": face_w,
        "panel_length": panel_l,
        "seam_height": seam_h,
        "num_supports": num_supports,
        "shearer_position": shearer_pos,
        "face_advance_m": face_x,
        "remaining_reserve_m": panel_l - face_x,
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -30, "minY": -30, "maxX": panel_l + 30, "maxY": face_w + 40}
    }


# ─── Cut & Fill Volume Generator ─────────────────────────────────────────────

def generate_cut_fill_volume(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate Cut & Fill volumetric excavation cross-section with volume breakdown."""
    pit_d = float(params.get("pit_depth", 40.0))
    surf_w = float(params.get("surface_width", 180.0))
    bot_w = float(params.get("bottom_width", 60.0))
    slope_deg = float(params.get("original_ground_slope", 5.0))
    density = float(params.get("rock_density", 2.5))

    primitives_2d = []
    meshes_3d = []

    layers = [
        {"name": "ORIGINAL-GROUND", "color": 3, "description": "Pre-mining ground profile"},
        {"name": "DESIGN-EXCAVATION", "color": 4, "description": "Target pit slope profile"},
        {"name": "CUT-AREA", "color": 1, "description": "Excavation cut volume"},
        {"name": "FILL-AREA", "color": 5, "description": "Backfill / Waste dump volume"},
        {"name": "TEXT", "color": 7, "description": "Volumetric Data Table"},
    ]

    primitives_2d.append(make_text(-10, pit_d + 30, "CUT & FILL VOLUMETRIC CROSS SECTION", 5.0, "TEXT", 7))

    # Natural ground line (sloped)
    ground_tan = math.tan(math.radians(slope_deg))
    ground_pts = [(-30, -30 * ground_tan), (surf_w + 30, (surf_w + 30) * ground_tan)]
    primitives_2d.append(make_line(ground_pts[0][0], ground_pts[0][1], ground_pts[1][0], ground_pts[1][1], "ORIGINAL-GROUND", 3))

    # Pit excavation profile
    side_setback = (surf_w - bot_w) / 2
    pit_pts = [
        (0, 0),
        (side_setback, -pit_d),
        (side_setback + bot_w, -pit_d),
        (surf_w, surf_w * ground_tan),
    ]

    primitives_2d.append(make_polyline(pit_pts, closed=False, layer="DESIGN-EXCAVATION", color=4))

    # Hatch cut volume
    cut_poly = [(0, 0), (side_setback, -pit_d), (side_setback + bot_w, -pit_d), (surf_w, surf_w * ground_tan), (0, 0)]
    primitives_2d.append(make_hatch(cut_poly, pattern="ANSI31", layer="CUT-AREA", color=1))

    # Calculate volumetric estimates for 100m strike length
    strike_len = 100.0
    cross_sec_area_cut = ((surf_w + bot_w) / 2) * pit_d
    cut_vol_m3 = cross_sec_area_cut * strike_len
    cut_tonnes = cut_vol_m3 * density
    fill_vol_m3 = cut_vol_m3 * 0.15  # estimated ramp backfill

    # Text summary block
    primitives_2d.append(make_text(surf_w + 20, 20, "VOLUMETRIC ESTIMATION SUMMARY", 3.0, "TEXT", 7))
    primitives_2d.append(make_text(surf_w + 20, 10, f"Cross Section Area: {cross_sec_area_cut:.1f} m²", 2.2, "TEXT", 4))
    primitives_2d.append(make_text(surf_w + 20, 2, f"Total Cut Volume: {cut_vol_m3:,.0f} m³", 2.4, "TEXT", 1))
    primitives_2d.append(make_text(surf_w + 20, -6, f"Total Excavation Tonnage: {cut_tonnes:,.0f} Tonnes", 2.4, "TEXT", 1))
    primitives_2d.append(make_text(surf_w + 20, -14, f"Estimated Fill Volume: {fill_vol_m3:,.0f} m³", 2.2, "TEXT", 5))
    primitives_2d.append(make_text(surf_w + 20, -22, f"Stripping Ratio: {cut_vol_m3 / (cut_tonnes/3.5 + 0.1):.2f} m³/t", 2.2, "TEXT", 3))

    # 3D: excavation prism extruded from the same cross-section polygon as the
    # 2D profile, plus a spoil-dump wedge on the downhill side.
    cut_poly = [
        (0, 0),
        (side_setback, -pit_d),
        (side_setback + bot_w, -pit_d),
        (surf_w, surf_w * ground_tan),
        (surf_w, surf_w * ground_tan + 2),
        (0, 2),
    ]
    meshes_3d.append(create_extrude_xz_mesh(cut_poly, -strike_len / 2, strike_len / 2,
                                            C["cut_volume"], "cut_volume", "CUT-AREA"))
    dump_poly = [
        (surf_w, surf_w * ground_tan),
        (surf_w + 55, surf_w * ground_tan),
        (surf_w, surf_w * ground_tan + 16),
    ]
    meshes_3d.append(create_extrude_xz_mesh(dump_poly, -strike_len / 2, strike_len / 2,
                                            C["spoil_dump"], "spoil_dump", "FILL-AREA"))

    properties = {
        "name": "Cut & Fill Volume",
        "pit_depth": pit_d,
        "surface_width": surf_w,
        "bottom_width": bot_w,
        "cut_area_m2": round(cross_sec_area_cut, 2),
        "cut_volume_m3": round(cut_vol_m3, 2),
        "cut_tonnes": round(cut_tonnes, 2),
        "fill_volume_m3": round(fill_vol_m3, 2),
        "stripping_ratio": round(cut_vol_m3 / (cut_tonnes/3.5 + 0.1), 2),
    }

    return {
        "primitives": primitives_2d,
        "meshes": meshes_3d,
        "layers": layers,
        "properties": properties,
        "bounds": {"minX": -40, "minY": -pit_d - 30, "maxX": surf_w + 140, "maxY": pit_d + 40}
    }


# ─── Master Dispatch ─────────────────────────────────────────────────────────

GENERATORS = {
    "open_pit": generate_open_pit,
    "room_and_pillar": generate_room_and_pillar,
    "ventilation": generate_ventilation_network,
    "conveyor": generate_conveyor,
    "blast_pattern": generate_blast_pattern,
    "decline": generate_decline,
    "mine_survey_traverse": generate_mine_survey_traverse,
    "topographic_contours": generate_topographic_contours,
    "borehole_lithology": generate_borehole_lithology,
    "longwall_panel": generate_longwall_panel,
    "cut_fill_volume": generate_cut_fill_volume,
}

# Input validation bounds. Counts are clamped to [1, MAX_COUNT]; other numeric
# parameters are clamped in magnitude to MAX_DIMENSION. Non-finite numbers
# (NaN/Infinity, which Python's json accepts as literals) are rejected with
# ValueError so the API layer can answer 400.
MAX_COUNT = 500
MAX_DIMENSION = 100_000.0


def _sanitize_params(params: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = {}
    for key, value in params.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            sanitized[key] = value
        elif not math.isfinite(value):
            raise ValueError(f"Parameter '{key}' must be a finite number, got {value!r}")
        elif key.startswith("num_"):
            sanitized[key] = max(1, min(MAX_COUNT, int(value)))
        else:
            sanitized[key] = max(-MAX_DIMENSION, min(MAX_DIMENSION, float(value)))
    return sanitized


def generate_geometry(object_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Main dispatch: given an object type and params, return full geometry set."""
    generator = GENERATORS.get(object_type)
    if not generator:
        raise ValueError(f"Unknown object type: {object_type}. Available: {list(GENERATORS.keys())}")
    if not isinstance(params, dict):
        raise ValueError("params must be an object")
    return generator(_sanitize_params(params))

