"""
MineCAD AI — File Exporters
DXF, SVG, PDF, OBJ, STL export from geometry primitives and meshes.
"""

import io
import math
import json
from typing import Dict, Any, List
from xml.sax.saxutils import escape

import ezdxf
from ezdxf.enums import TextEntityAlignment


# ─── DXF Export ───────────────────────────────────────────────────────────────

def export_dxf(geometry_data: Dict[str, Any]) -> bytes:
    """Export 2D primitives to DXF format using ezdxf."""
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    # Create layers
    for layer_info in geometry_data.get("layers", []):
        name = layer_info["name"]
        color = layer_info.get("color", 7)
        try:
            doc.layers.add(name, color=color)
        except Exception:
            pass

    # Add primitives
    for prim in geometry_data.get("primitives", []):
        ptype = prim.get("type")
        layer = prim.get("layer", "0")
        color = prim.get("color", 7)

        dxfattribs = {"layer": layer, "color": color}

        if ptype == "line":
            msp.add_line(
                (prim["x1"], prim["y1"]),
                (prim["x2"], prim["y2"]),
                dxfattribs=dxfattribs,
            )

        elif ptype == "polyline":
            points = [(p["x"], p["y"]) for p in prim["points"]]
            if prim.get("closed"):
                points.append(points[0])
            msp.add_lwpolyline(points, dxfattribs=dxfattribs)

        elif ptype == "circle":
            msp.add_circle(
                (prim["cx"], prim["cy"]),
                prim["r"],
                dxfattribs=dxfattribs,
            )

        elif ptype == "arc":
            msp.add_arc(
                (prim["cx"], prim["cy"]),
                prim["r"],
                prim["startAngle"],
                prim["endAngle"],
                dxfattribs=dxfattribs,
            )

        elif ptype == "text":
            msp.add_text(
                prim["text"],
                height=prim.get("height", 2.0),
                dxfattribs={**dxfattribs, "insert": (prim["x"], prim["y"])},
            )

        elif ptype == "dimension":
            # Simplified dimension — draw as line + text
            x1, y1 = prim["x1"], prim["y1"]
            x2, y2 = prim["x2"], prim["y2"]
            msp.add_line((x1, y1), (x2, y2), dxfattribs=dxfattribs)
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2
            msp.add_text(
                prim["text"],
                height=1.5,
                dxfattribs={**dxfattribs, "insert": (mid_x, mid_y + 2)},
            )

    # Write to bytes
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue().encode("utf-8")


# ─── SVG Export ───────────────────────────────────────────────────────────────

DXF_COLORS_TO_SVG = {
    1: "#FF0000",   # Red
    2: "#FFFF00",   # Yellow
    3: "#00FF00",   # Green
    4: "#00FFFF",   # Cyan
    5: "#0000FF",   # Blue
    6: "#FF00FF",   # Magenta
    7: "#FFFFFF",   # White
    8: "#808080",   # Grey
}


def export_svg(geometry_data: Dict[str, Any]) -> str:
    """Export 2D primitives to SVG format."""
    bounds = geometry_data.get("bounds", {"minX": -200, "minY": -200, "maxX": 200, "maxY": 200})
    margin = 20
    vb_x = bounds["minX"] - margin
    vb_y = bounds["minY"] - margin
    vb_w = bounds["maxX"] - bounds["minX"] + 2 * margin
    vb_h = bounds["maxY"] - bounds["minY"] + 2 * margin

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_x} {-bounds["maxY"] - margin} {vb_w} {vb_h}" ',
        f'width="{max(800, int(vb_w * 2))}" height="{max(600, int(vb_h * 2))}" ',
        'style="background:#1a1a2e;">',
    ]

    for prim in geometry_data.get("primitives", []):
        ptype = prim.get("type")
        color = DXF_COLORS_TO_SVG.get(prim.get("color", 7), "#FFFFFF")

        if ptype == "line":
            svg_parts.append(
                f'<line x1="{prim["x1"]}" y1="{-prim["y1"]}" '
                f'x2="{prim["x2"]}" y2="{-prim["y2"]}" '
                f'stroke="{color}" stroke-width="0.5" />'
            )

        elif ptype == "polyline":
            pts = " ".join(f'{p["x"]},{-p["y"]}' for p in prim["points"])
            tag = "polygon" if prim.get("closed") else "polyline"
            fill = "none" if not prim.get("closed") else f"{color}22"
            svg_parts.append(
                f'<{tag} points="{pts}" stroke="{color}" '
                f'stroke-width="0.5" fill="{fill}" />'
            )

        elif ptype == "circle":
            svg_parts.append(
                f'<circle cx="{prim["cx"]}" cy="{-prim["cy"]}" '
                f'r="{prim["r"]}" stroke="{color}" stroke-width="0.5" fill="none" />'
            )

        elif ptype == "text":
            font_size = prim.get("height", 2.0)
            svg_parts.append(
                f'<text x="{prim["x"]}" y="{-prim["y"]}" '
                f'fill="{color}" font-size="{font_size}" font-family="monospace">'
                f'{escape(str(prim["text"]))}</text>'
            )

        elif ptype == "dimension":
            x1, y1 = prim["x1"], -prim["y1"]
            x2, y2 = prim["x2"], -prim["y2"]
            svg_parts.append(
                f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                f'stroke="{color}" stroke-width="0.3" stroke-dasharray="2,1" />'
            )
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2
            svg_parts.append(
                f'<text x="{mid_x}" y="{mid_y - 2}" fill="{color}" '
                f'font-size="2" font-family="monospace" text-anchor="middle">'
                f'{escape(str(prim["text"]))}</text>'
            )

    svg_parts.append("</svg>")
    return "\n".join(svg_parts)


# ─── OBJ Export ───────────────────────────────────────────────────────────────

def export_obj(geometry_data: Dict[str, Any]) -> str:
    """Export 3D meshes to OBJ format."""
    lines = ["# MineCAD AI OBJ Export", "# Mining Engineering CAD Model", ""]
    vertex_offset = 0

    for mesh in geometry_data.get("meshes", []):
        name = mesh.get("name", "object")
        lines.append(f"o {name}")

        for v in mesh["vertices"]:
            lines.append(f"v {v[0]} {v[2]} {v[1]}")  # Swap Y/Z for standard OBJ

        for face in mesh["indices"]:
            # OBJ is 1-indexed
            f_indices = " ".join(str(i + 1 + vertex_offset) for i in face)
            lines.append(f"f {f_indices}")

        vertex_offset += len(mesh["vertices"])
        lines.append("")

    return "\n".join(lines)


# ─── STL Export ───────────────────────────────────────────────────────────────

def export_stl(geometry_data: Dict[str, Any]) -> str:
    """Export 3D meshes to ASCII STL format."""
    lines = ["solid MineCAD_AI"]

    for mesh in geometry_data.get("meshes", []):
        verts = mesh["vertices"]
        for face in mesh["indices"]:
            v0 = verts[face[0]]
            v1 = verts[face[1]]
            v2 = verts[face[2]]

            # Compute face normal
            e1 = [v1[i] - v0[i] for i in range(3)]
            e2 = [v2[i] - v0[i] for i in range(3)]
            n = [
                e1[1]*e2[2] - e1[2]*e2[1],
                e1[2]*e2[0] - e1[0]*e2[2],
                e1[0]*e2[1] - e1[1]*e2[0],
            ]
            length = math.sqrt(sum(x*x for x in n)) or 1
            n = [x / length for x in n]

            lines.append(f"  facet normal {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}")
            lines.append("    outer loop")
            lines.append(f"      vertex {v0[0]:.6f} {v0[2]:.6f} {v0[1]:.6f}")
            lines.append(f"      vertex {v1[0]:.6f} {v1[2]:.6f} {v1[1]:.6f}")
            lines.append(f"      vertex {v2[0]:.6f} {v2[2]:.6f} {v2[1]:.6f}")
            lines.append("    endloop")
            lines.append("  endfacet")

    lines.append("endsolid MineCAD_AI")
    return "\n".join(lines)


# ─── PDF Export (basic vector PDF) ────────────────────────────────────────────

def _pdf_escape_text(text: str) -> str:
    """Escape a string for a PDF literal text object."""
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def export_pdf(geometry_data: Dict[str, Any]) -> bytes:
    """Export 2D primitives to a simple vector PDF."""
    bounds = geometry_data.get("bounds", {"minX": -200, "minY": -200, "maxX": 200, "maxY": 200})
    margin = 50
    min_x = float(bounds.get("minX", -200))
    max_x = float(bounds.get("maxX", 200))
    min_y = float(bounds.get("minY", -200))
    max_y = float(bounds.get("maxY", 200))
    page_w = max_x - min_x + 2 * margin
    page_h = max_y - min_y + 2 * margin

    # Guard against degenerate bounds (zero-size drawing) — without this the
    # scale division below blows up on a zero page width.
    if page_w <= 0:
        page_w = 2 * margin + 1.0
        max_x = min_x + 1.0
    if page_h <= 0:
        page_h = 2 * margin + 1.0
        max_y = min_y + 1.0

    # Scale to fit A3 (1190 x 842 pts)
    scale = min(1190 / page_w, 842 / page_h, 3.0)
    pw = page_w * scale
    ph = page_h * scale

    def tx(x):
        return (x - min_x + margin) * scale

    def ty(y):
        # Flip Y to match the SVG export (SVG negates y); otherwise the same
        # drawing renders mirrored between formats.
        return (max_y - y + margin) * scale

    stream_parts = []
    stream_parts.append("0.1 0.1 0.18 rg")  # Background
    stream_parts.append(f"0 0 {pw:.1f} {ph:.1f} re f")
    stream_parts.append("1 1 1 RG")  # White stroke
    stream_parts.append("0.5 w")  # Line width

    for prim in geometry_data.get("primitives", []):
        ptype = prim.get("type")

        if ptype == "line":
            stream_parts.append(f"{tx(prim['x1']):.2f} {ty(prim['y1']):.2f} m "
                              f"{tx(prim['x2']):.2f} {ty(prim['y2']):.2f} l S")

        elif ptype == "polyline":
            pts = prim["points"]
            if pts:
                stream_parts.append(f"{tx(pts[0]['x']):.2f} {ty(pts[0]['y']):.2f} m")
                for p in pts[1:]:
                    stream_parts.append(f"{tx(p['x']):.2f} {ty(p['y']):.2f} l")
                if prim.get("closed"):
                    stream_parts.append("h")
                stream_parts.append("S")

        elif ptype == "circle":
            # Approximate circle with 4 Bezier curves
            cx_t, cy_t = tx(prim["cx"]), ty(prim["cy"])
            r = prim["r"] * scale
            k = 0.5522847498  # magic number for bezier circle
            stream_parts.append(
                f"{cx_t:.2f} {cy_t + r:.2f} m "
                f"{cx_t + r*k:.2f} {cy_t + r:.2f} {cx_t + r:.2f} {cy_t + r*k:.2f} {cx_t + r:.2f} {cy_t:.2f} c "
                f"{cx_t + r:.2f} {cy_t - r*k:.2f} {cx_t + r*k:.2f} {cy_t - r:.2f} {cx_t:.2f} {cy_t - r:.2f} c "
                f"{cx_t - r*k:.2f} {cy_t - r:.2f} {cx_t - r:.2f} {cy_t - r*k:.2f} {cx_t - r:.2f} {cy_t:.2f} c "
                f"{cx_t - r:.2f} {cy_t + r*k:.2f} {cx_t - r*k:.2f} {cy_t + r:.2f} {cx_t:.2f} {cy_t + r:.2f} c S"
            )

        elif ptype == "text":
            # Render text labels so PDF exports are not unlabeled
            font_size = max(float(prim.get("height", 2.0)) * scale, 1.0)
            stream_parts.append("1 1 1 rg")
            stream_parts.append(
                f"BT /F1 {font_size:.2f} Tf 1 0 0 1 {tx(prim['x']):.2f} {ty(prim['y']):.2f} Tm "
                f"({_pdf_escape_text(prim['text'])}) Tj ET"
            )

        elif ptype == "dimension":
            # Simplified dimension — line + centered label, as in DXF/SVG
            stream_parts.append(
                f"{tx(prim['x1']):.2f} {ty(prim['y1']):.2f} m "
                f"{tx(prim['x2']):.2f} {ty(prim['y2']):.2f} l S"
            )
            mid_x = (prim["x1"] + prim["x2"]) / 2
            mid_y = (prim["y1"] + prim["y2"]) / 2
            font_size = max(1.5 * scale, 1.0)
            stream_parts.append("1 1 1 rg")
            stream_parts.append(
                f"BT /F1 {font_size:.2f} Tf 1 0 0 1 {tx(mid_x):.2f} {ty(mid_y) + 2 * scale:.2f} Tm "
                f"({_pdf_escape_text(prim['text'])}) Tj ET"
            )

    stream_content = "\n".join(stream_parts)
    stream_bytes = stream_content.encode("latin-1", errors="replace")

    # Build minimal PDF
    pdf_objects = []
    pdf_objects.append(b"%PDF-1.4\n")

    # Catalog
    pdf_objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    # Pages
    pdf_objects.append(f"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n".encode())
    # Page
    pdf_objects.append(
        f"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {pw:.1f} {ph:.1f}] "
        f"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n".encode()
    )
    # Content stream
    pdf_objects.append(f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode() + stream_bytes + b"\nendstream\nendobj\n")
    # Font (standard 14 Helvetica — no embedding required)
    pdf_objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

    # Build file
    offsets = []
    output = io.BytesIO()
    output.write(b"%PDF-1.4\n")
    for i, obj in enumerate(pdf_objects[1:], 1):
        offsets.append(output.tell())
        output.write(obj)

    xref_pos = output.tell()
    output.write(f"xref\n0 {len(offsets) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        output.write(f"{off:010d} 00000 n \n".encode())

    output.write(f"trailer\n<< /Size {len(offsets) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode())

    return output.getvalue()
