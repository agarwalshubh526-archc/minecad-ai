// MineCAD AI — Client-Side Geometry Engine
// Mirrors backend geometry generators for instant client-side preview

import type { CadPrimitive, MeshData, GeometryData } from '@/types';

function line(x1: number, y1: number, x2: number, y2: number, layer = '0', color = 7): CadPrimitive {
  return { type: 'line', x1, y1, x2, y2, layer, color };
}

function polyline(points: [number, number][], closed = false, layer = '0', color = 7): CadPrimitive {
  return { type: 'polyline', points: points.map(([x, y]) => ({ x, y })), closed, layer, color };
}

function circle(cx: number, cy: number, r: number, layer = '0', color = 7): CadPrimitive {
  return { type: 'circle', cx, cy, r, layer, color };
}

function text(x: number, y: number, t: string, height = 2, layer = 'TEXT', color = 7): CadPrimitive {
  return { type: 'text', x, y, text: t, height, layer, color };
}

function dimension(x1: number, y1: number, x2: number, y2: number, t: string, layer = 'DIMENSIONS', color = 3): CadPrimitive {
  return { type: 'dimension', x1, y1, x2, y2, text: t, layer, color };
}

function boxMesh(x: number, y: number, z: number, w: number, d: number, h: number, color: string, layer?: string, name?: string): MeshData {
  const verts = [
    [x, y, z], [x+w, y, z], [x+w, y+d, z], [x, y+d, z],
    [x, y, z+h], [x+w, y, z+h], [x+w, y+d, z+h], [x, y+d, z+h],
  ];
  const faces = [
    [0,1,2],[0,2,3],[4,6,5],[4,7,6],
    [0,4,5],[0,5,1],[2,6,7],[2,7,3],
    [0,3,7],[0,7,4],[1,5,6],[1,6,2],
  ];
  return makeMesh(verts, faces, color, name ?? `box_${x}_${y}_${z}`, layer);
}

// ─── Mine Design Language Palette (mirrored in backend/geometry.py) ──────────

export const MINE_COLORS = {
  wasteBench: ['#9C8D78', '#90826E', '#847763', '#786B58', '#6D604E', '#625644'],
  pitFloor: '#5A5244',
  haulRoad: '#9A8A70',
  coalSeam: '#1C1C1E',
  sandstone: '#C9B18A',
  overburden: '#8A6F4D',
  mudstone: '#6E6259',
  pillarRock: '#7A6B5D',
  roofRock: '#4E463C',
  floorRock: '#5C5347',
  roadwayGravel: '#6E6257',
  ductSteel: '#5F7D8C',
  equipmentYellow: '#F5A623',
  equipmentOrange: '#E67E22',
  tunnelGrey: '#5A6470',
  levelGrey: '#6B7078',
  terrainLow: '#6E7A4A',
  terrainHigh: '#8A9159',
  gateroad: '#4A4A52',
  goaf: '#3A352F',
  cutVolume: '#8A5A44',
  spoilDump: '#7E8B5A',
  concrete: '#8A8F94',
  trestleSteel: '#7C8288',
  blastHole: '#C0392B',
  surveyControl: '#E74C3C',
  surveyStation: '#F39C12',
  conveyorBelt: '#3A3A3E',
} as const;

// Multiply a #RRGGBB color by a factor (per-channel, clamped) so derived
// surfaces (batter faces, exterior skirt) read darker than bench berms.
function shadeColor(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Axis-aligned rectangle in plan view (mesh space: x = east, y = north-plan,
// z = height — the renderer maps vertices to Three.js as [x, z, -y]).
interface PlanRect { x1: number; y1: number; x2: number; y2: number }

function makeMesh(verts: number[][], faces: number[][], color: string, name: string, layer?: string): MeshData {
  const m: MeshData = { type: 'mesh', vertices: verts, indices: faces, color, name };
  if (layer) m.layer = layer;
  return m;
}

// Append a quad (a→b→c→d counter-clockwise seen from outside) as two triangles,
// with its own vertices so flat shading keeps crisp face normals.
function pushQuad(verts: number[][], faces: number[][], a: number[], b: number[], c: number[], d: number[]) {
  const base = verts.length;
  verts.push(a, b, c, d);
  faces.push([base, base + 1, base + 2], [base, base + 2, base + 3]);
}

// Box spanning two plan points with an inclined bottom and parallel top:
// bottom runs A(z1)→B(z2), top is the same run raised by h. Width w is measured
// perpendicular to the plan direction. Used for conveyor belts and declines.
function inclinedBoxMesh(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  w: number, h: number,
  color: string, name: string, layer?: string,
): MeshData {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len * (w / 2), py = dx / len * (w / 2);
  // corners: A/B ends, +/- perpendicular half-width
  const Am = [x1 - px, y1 - py, z1], Ap = [x1 + px, y1 + py, z1];
  const Bm = [x2 - px, y2 - py, z2], Bp = [x2 + px, y2 + py, z2];
  const up = (p: number[]) => [p[0], p[1], p[2] + h];
  const verts: number[][] = [];
  const faces: number[][] = [];
  pushQuad(verts, faces, up(Am), up(Bm), up(Bp), up(Ap));      // top
  pushQuad(verts, faces, Bm, Am, Ap, Bp);                     // bottom
  pushQuad(verts, faces, Bp, Bm, up(Bm), up(Bp));             // front (+dir)
  pushQuad(verts, faces, Am, Ap, up(Ap), up(Am));             // back
  pushQuad(verts, faces, Ap, Bp, up(Bp), up(Ap));             // left (+perp)
  pushQuad(verts, faces, Bm, Am, up(Am), up(Bm));             // right
  return makeMesh(verts, faces, color, name, layer);
}

// Vertical cylinder between z0 (bottom) and z1 (top), axis at (cx, cy).
function cylinderMesh(
  cx: number, cy: number, z0: number, z1: number, r: number, segments: number,
  color: string, name: string, layer?: string,
): MeshData {
  const verts: number[][] = [];
  const faces: number[][] = [];
  const cb = verts.length;
  verts.push([cx, cy, z0]);
  const ct = verts.length;
  verts.push([cx, cy, z1]);
  const ring0 = verts.length;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    verts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0]);
  }
  const ring1 = verts.length;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    verts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z1]);
  }
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    faces.push([ring0 + i, ring0 + j, ring1 + j]);
    faces.push([ring0 + i, ring1 + j, ring1 + i]);
  }
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    faces.push([cb, ring0 + j, ring0 + i]);
    faces.push([ct, ring1 + i, ring1 + j]);
  }
  return makeMesh(verts, faces, color, name, layer);
}

// Extrude a closed convex X-Z polygon along plan-y from y0 to y1 (cut & fill).
function extrudeXZMesh(
  xz: [number, number][], y0: number, y1: number,
  color: string, name: string, layer?: string,
): MeshData {
  const verts: number[][] = [];
  const faces: number[][] = [];
  const n = xz.length;
  for (const [x, z] of xz) verts.push([x, y0, z]);
  for (const [x, z] of xz) verts.push([x, y1, z]);
  for (let i = 1; i < n - 1; i++) faces.push([0, i, i + 1]);
  for (let i = 1; i < n - 1; i++) faces.push([n, n + i + 1, n + i]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j]);
    faces.push([i, n + j, n + i]);
  }
  return makeMesh(verts, faces, color, name, layer);
}

// Four sloped batter faces connecting an outer (crest) rectangle at zTop to a
// smaller concentric inner (toe) rectangle at zBot. When the rects are equal
// this degenerates to a vertical ring (pit exterior skirt).
function frustumRingMesh(
  outer: PlanRect, zTop: number, inner: PlanRect, zBot: number,
  color: string, name: string, layer?: string,
): MeshData {
  const verts: number[][] = [];
  const faces: number[][] = [];
  const O = [
    [outer.x1, outer.y1, zTop], [outer.x2, outer.y1, zTop],
    [outer.x2, outer.y2, zTop], [outer.x1, outer.y2, zTop],
  ];
  const I = [
    [inner.x1, inner.y1, zBot], [inner.x2, inner.y1, zBot],
    [inner.x2, inner.y2, zBot], [inner.x1, inner.y2, zBot],
  ];
  for (let s = 0; s < 4; s++) {
    const t = (s + 1) % 4;
    // inner faces viewed from inside the ring → reversed winding
    pushQuad(verts, faces, O[s], O[t], I[t], I[s]);
  }
  return makeMesh(verts, faces, color, name, layer);
}

// Horizontal band between two concentric rectangles at a fixed height
// (bench berm / pit floor ring).
function flatRingMesh(
  inner: PlanRect, outer: PlanRect, z: number,
  color: string, name: string, layer?: string,
): MeshData {
  const verts: number[][] = [];
  const faces: number[][] = [];
  const O = [
    [outer.x1, outer.y1, z], [outer.x2, outer.y1, z],
    [outer.x2, outer.y2, z], [outer.x1, outer.y2, z],
  ];
  const I = [
    [inner.x1, inner.y1, z], [inner.x2, inner.y1, z],
    [inner.x2, inner.y2, z], [inner.x1, inner.y2, z],
  ];
  for (let s = 0; s < 4; s++) {
    const t = (s + 1) % 4;
    pushQuad(verts, faces, O[s], O[t], I[t], I[s]);
  }
  return makeMesh(verts, faces, color, name, layer);
}

// Filled horizontal rectangle at a fixed height (pit floor).
function flatRectMesh(
  r: PlanRect, z: number, color: string, name: string, layer?: string,
): MeshData {
  return makeMesh(
    [[r.x1, r.y1, z], [r.x2, r.y1, z], [r.x2, r.y2, z], [r.x1, r.y2, z]],
    [[0, 3, 2], [0, 2, 1]],
    color, name, layer,
  );
}

// Haul-road ramp: a ribbon following the 2D road edge stations, descending
// between consecutive stations, with short side skirts for thickness.
function rampRibbonMesh(
  stations: { x1: number; y1: number; x2: number; y2: number; z: number }[],
  skirt: number, color: string, name: string, layer?: string,
): MeshData {
  const verts: number[][] = [];
  const faces: number[][] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const s = stations[i], t = stations[i + 1];
    // top surface
    pushQuad(verts, faces,
      [s.x1, s.y1, s.z], [t.x1, t.y1, t.z],
      [t.x2, t.y2, t.z], [s.x2, s.y2, s.z]);
    // inner skirt (x1/y1 edge)
    pushQuad(verts, faces,
      [t.x1, t.y1, t.z], [s.x1, s.y1, s.z],
      [s.x1, s.y1, s.z - skirt], [t.x1, t.y1, t.z - skirt]);
    // outer skirt (x2/y2 edge)
    pushQuad(verts, faces,
      [s.x2, s.y2, s.z], [t.x2, t.y2, t.z],
      [t.x2, t.y2, t.z - skirt], [s.x2, s.y2, s.z - skirt]);
  }
  return makeMesh(verts, faces, color, name, layer);
}

// Regular triangulated heightfield over [0..w]×[0..h] with per-vertex heights.// Triangles at or above zSplit go to `high`, the rest to `low` (two meshes so
// the terrain can carry two tones).
function heightfieldMeshes(
  w: number, h: number, nx: number, ny: number,
  heightAt: (x: number, y: number) => number,
  zSplit: number, lowColor: string, highColor: string, name: string,
): MeshData[] {
  const verts: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx) * w, y = (j / ny) * h;
      verts.push([x, y, heightAt(x, y)]);
    }
  }
  const idx = (i: number, j: number) => j * (nx + 1) + i;
  const lowV: number[][] = [], lowF: number[][] = [], highV: number[][] = [], highF: number[][] = [];
  const lowRemap = new Map<number, number>(), highRemap = new Map<number, number>();
  const take = (target: number[][], remap: Map<number, number>, k: number) => {
    let r = remap.get(k);
    if (r === undefined) { r = target.length; target.push(verts[k]); remap.set(k, r); }
    return r;
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
      const tris: [number, number, number][] = [[a, c, b], [a, d, c]];
      for (const t of tris) {
        const avg = (verts[t[0]][2] + verts[t[1]][2] + verts[t[2]][2]) / 3;
        const hi = avg >= zSplit;
        const V = hi ? highV : lowV;
        const F = hi ? highF : lowF;
        const R = hi ? highRemap : lowRemap;
        F.push([take(V, R, t[0]), take(V, R, t[1]), take(V, R, t[2])]);
      }
    }
  }
  return [
    makeMesh(lowV, lowF, lowColor, `${name}_low`, 'TERRAIN'),
    makeMesh(highV, highF, highColor, `${name}_high`, 'TERRAIN'),
  ];
}

// ─── Open Pit Generator ──────────────────────────────────────────────────────

export function generateOpenPit(params: Record<string, number>): GeometryData {
  const benchHeight = params.bench_height ?? 10;
  const benchWidth = params.bench_width ?? 8;
  const numBenches = params.num_benches ?? 5;
  const pitLength = params.pit_length ?? 300;
  const pitWidth = params.pit_width ?? 200;
  const haulRoadWidth = params.haul_road_width ?? 22;
  const overallSlope = params.overall_slope ?? 55;
  const batterAngle = params.batter_angle ?? 75;

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];
  const faceSetback = benchHeight / Math.tan(batterAngle * Math.PI / 180);
  const totalSetback = faceSetback + benchWidth;

  const layers = [
    { name: 'PIT-CREST', color: 1, description: 'Bench crest lines' },
    { name: 'PIT-TOE', color: 5, description: 'Bench toe lines' },
    { name: 'HAUL-ROAD', color: 3, description: 'Haul road' },
    { name: 'DIMENSIONS', color: 2, description: 'Dimensions' },
    { name: 'TEXT', color: 7, description: 'Text annotations' },
  ];

  prims.push(text(-pitLength/2, pitWidth/2 + 30, `OPEN PIT MINE — PLAN VIEW`, 5, 'TEXT', 7));
  prims.push(text(-pitLength/2, pitWidth/2 + 20,
    `Benches: ${numBenches} × ${benchHeight}m H × ${benchWidth}m W  |  Haul Road: ${haulRoadWidth}m  |  Slope: ${overallSlope}°`, 2.5, 'TEXT', 8));

  // Collect crest (outer) and toe (after batter) rectangles per bench — the
  // same rectangles drive the 2D outlines and the 3D stepped shell.
  const crestRects: PlanRect[] = [];
  const toeRects: PlanRect[] = [];

  for (let i = 0; i < numBenches; i++) {
    const offset = i * totalSetback;
    const cx1 = -pitLength / 2 + offset;
    const cy1 = -pitWidth / 2 + offset;
    const cx2 = pitLength / 2 - offset;
    const cy2 = pitWidth / 2 - offset;
    if (cx2 <= cx1 || cy2 <= cy1) break;

    prims.push(polyline([[cx1, cy1], [cx2, cy1], [cx2, cy2], [cx1, cy2]], true, 'PIT-CREST', 1));
    crestRects.push({ x1: cx1, y1: cy1, x2: cx2, y2: cy2 });

    const tx1 = cx1 + faceSetback;
    const ty1 = cy1 + faceSetback;
    const tx2 = cx2 - faceSetback;
    const ty2 = cy2 - faceSetback;
    if (tx2 > tx1 && ty2 > ty1) {
      prims.push(polyline([[tx1, ty1], [tx2, ty1], [tx2, ty2], [tx1, ty2]], true, 'PIT-TOE', 5));
    }
    toeRects.push({ x1: tx1, y1: ty1, x2: tx2, y2: ty2 });

    // Stagger each label into the corridor just above the ring's top-left
    // corner — the top-right holds the sheet's north arrow, and stacked on
    // the centreline the labels overlap into an unreadable blob.
    prims.push(text(cx1 - 12, cy2 + 4, `Bench ${i+1}`, 2, 'TEXT', 7));
  }

  const builtBenches = crestRects.length;

  // Haul road (plan view)
  const roadPts: [number, number][] = [];
  const roadPts2: [number, number][] = [];
  for (let i = 0; i < builtBenches; i++) {
    const offset = i * totalSetback;
    const roadX = pitLength / 2 - offset - 5;
    const ry = -pitWidth / 2 + offset;
    roadPts.push([roadX, ry]);
    roadPts2.push([roadX - haulRoadWidth, ry]);
  }
  if (roadPts.length > 1) {
    prims.push(polyline(roadPts, false, 'HAUL-ROAD', 3));
    prims.push(polyline(roadPts2, false, 'HAUL-ROAD', 3));
    // Key-quantity annotation: haul-road width + typical grade, placed at the
    // bottom of the road where there is open space (top bench collides with
    // the "Bench N" labels).
    const rw = roadPts[0];
    const rw2 = roadPts2[0];
    prims.push(dimension(rw2[0], rw2[1] - 6, rw[0], rw[1] - 6, `HAUL ROAD ${haulRoadWidth} m`));
    prims.push(text(rw[0] + 7, rw[1] + 5, 'GRADE ≈10%', 2, 'TEXT', 8));
  }

  // ── 3D stepped pit shell ──
  // Bench i contributes sloped batter faces (crest_i at -i·H → toe_i at
  // -(i+1)·H) plus a horizontal berm ring from its toe out to the next crest.
  // Bench 0 additionally gets a vertical exterior skirt down to pit bottom so
  // the pit reads as carved into a solid mass, and the last toe ring is
  // capped with the pit floor.
  if (builtBenches > 0) {
    const pitDepth = builtBenches * benchHeight;
    for (let i = 0; i < builtBenches; i++) {
      const zTop = -i * benchHeight;
      const zBot = -(i + 1) * benchHeight;
      const tone = MINE_COLORS.wasteBench[i % MINE_COLORS.wasteBench.length];
      meshes.push(frustumRingMesh(crestRects[i], zTop, toeRects[i], zBot, shadeColor(tone, 0.85), `pit_bench_${i + 1}_batter`, 'PIT-SLOPES'));
      if (i + 1 < builtBenches) {
        meshes.push(flatRingMesh(toeRects[i], crestRects[i + 1], zBot, tone, `pit_bench_${i + 1}_berm`, 'PIT-BERMS'));
      }
    }
    // Exterior skirt: vertical walls from surface crest down to pit floor.
    meshes.push(frustumRingMesh(crestRects[0], 0, crestRects[0], -pitDepth,
      shadeColor(MINE_COLORS.wasteBench[0], 0.8), 'pit_exterior_skirt', 'PIT-SLOPES'));
    // Pit floor at final toe level.
    const lastToe = toeRects[builtBenches - 1];
    if (lastToe.x2 > lastToe.x1 && lastToe.y2 > lastToe.y1) {
      meshes.push(flatRectMesh(lastToe, -pitDepth, MINE_COLORS.pitFloor, 'pit_floor', 'PIT-FLOOR'));
    } else {
      meshes.push(flatRectMesh(crestRects[builtBenches - 1], -pitDepth, MINE_COLORS.pitFloor, 'pit_floor', 'PIT-FLOOR'));
    }

    // Haul-road ramp: ribbon descending the east wall station-to-station,
    // mirroring the 2D road polylines.
    if (roadPts.length > 1) {
      const stations = roadPts.map(([x1, y1], i) => ({ x1, y1, x2: roadPts2[i][0], y2: roadPts2[i][1], z: -i * benchHeight }));
      meshes.push(rampRibbonMesh(stations, 2.5, MINE_COLORS.haulRoad, 'haul_road_ramp', 'HAUL-ROAD'));
    }

    // Crest markers at the four pit crest corners (site furniture).
    for (let c = 0; c < 4; c++) {
      const corner = [
        [crestRects[0].x1, crestRects[0].y1], [crestRects[0].x2, crestRects[0].y1],
        [crestRects[0].x2, crestRects[0].y2], [crestRects[0].x1, crestRects[0].y2],
      ][c];
      meshes.push(boxMesh(corner[0] - 1, corner[1] - 1, 0, 2, 2, 3, MINE_COLORS.equipmentOrange, 'SURVEY-MARKERS'));
    }
  }

  // Dimensions
  prims.push(dimension(-pitLength/2, -pitWidth/2 - 15, pitLength/2, -pitWidth/2 - 15, `${pitLength} m`));
  prims.push(dimension(-pitLength/2 - 15, -pitWidth/2, -pitLength/2 - 15, pitWidth/2, `${pitWidth} m`));

  // Cross section
  const sy = -pitWidth/2 - 80;
  prims.push(text(-pitLength/2, sy + 30, 'CROSS SECTION A-A\'', 4, 'TEXT', 7));
  const sectionPts: [number, number][] = [[-pitLength/2, sy]];
  const sx = -pitLength / 2;
  for (let i = 0; i < numBenches; i++) {
    const bx = sx + i * totalSetback;
    sectionPts.push([bx, sy - i * benchHeight]);
    sectionPts.push([bx + faceSetback, sy - (i+1) * benchHeight]);
    sectionPts.push([bx + faceSetback + benchWidth, sy - (i+1) * benchHeight]);
  }
  sectionPts.push([0, sy - numBenches * benchHeight]);
  for (let i = numBenches - 1; i >= 0; i--) {
    const bxR = pitLength/2 - i * totalSetback;
    sectionPts.push([bxR - benchWidth, sy - (i+1) * benchHeight]);
    sectionPts.push([bxR - benchWidth + faceSetback, sy - (i+1) * benchHeight]);
    sectionPts.push([bxR, sy - i * benchHeight]);
  }
  sectionPts.push([pitLength/2, sy]);
  prims.push(polyline(sectionPts, false, 'PIT-CREST', 1));
  // Section annotations: bench height on the first bench, total depth overall
  const benchX = sx + totalSetback + faceSetback;
  prims.push(dimension(benchX + 8, sy - benchHeight, benchX + 8, sy, `BENCH ${benchHeight} m`));
  prims.push(dimension(sx - 14, sy - builtBenches * benchHeight, sx - 14, sy, `DEPTH ${builtBenches * benchHeight} m`));

  // Pit shell volume: rectangular-pyramid frustum per bench between crests
  const rectArea = (r: PlanRect) => Math.max(0, (r.x2 - r.x1) * (r.y2 - r.y1));
  let wasteVol = 0;
  for (let i = 0; i < builtBenches; i++) {
    const a1 = rectArea(crestRects[i]);
    const a2 = i + 1 < builtBenches ? rectArea(crestRects[i + 1]) : rectArea(toeRects[builtBenches - 1]);
    wasteVol += (benchHeight / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
  }
  const wasteTonnes = wasteVol * 2.7; // waste rock ≈ 2.7 t/m³

  return {
    primitives: prims,
    meshes,
    layers,
    properties: {
      name: 'Open Pit Mine',
      bench_height: benchHeight,
      bench_width: benchWidth,
      num_benches: numBenches,
      pit_length: pitLength,
      pit_width: pitWidth,
      haul_road_width: haulRoadWidth,
      overall_slope: overallSlope,
      batter_angle: batterAngle,
      total_depth: numBenches * benchHeight,
      waste_volume_m3: Math.round(wasteVol),
      waste_tonnes: Math.round(wasteTonnes),
      _object_type: 'open_pit',
    },
    bounds: { minX: -pitLength/2 - 30, minY: -pitWidth/2 - 150, maxX: pitLength/2 + 30, maxY: pitWidth/2 + 50 },
  };
}

// ─── Room and Pillar Generator ───────────────────────────────────────────────

export function generateRoomAndPillar(params: Record<string, number>): GeometryData {
  const roomW = params.room_width ?? 6;
  const pillarW = params.pillar_width ?? 8;
  const numX = params.num_rooms_x ?? 5;
  const numY = params.num_rooms_y ?? 4;
  const roomH = params.room_height ?? 3;
  const entryW = params.entry_width ?? 5;

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];
  const cellW = roomW + pillarW;
  const totalW = numX * cellW + pillarW;
  const totalH = numY * cellW + pillarW;

  const layers = [
    { name: 'PILLARS', color: 4, description: 'Mine pillars' },
    { name: 'ROOMS', color: 7, description: 'Mine rooms' },
    { name: 'ENTRY', color: 3, description: 'Main entries' },
    { name: 'TEXT', color: 7, description: 'Text' },
    { name: 'DIMENSIONS', color: 2, description: 'Dimensions' },
  ];

  prims.push(text(0, totalH + 20, 'ROOM & PILLAR MINE — PLAN VIEW', 5, 'TEXT', 7));
  prims.push(polyline([[0,0], [totalW, 0], [totalW, totalH], [0, totalH]], true, 'ROOMS', 7));

  for (let ix = 0; ix <= numX; ix++) {
    for (let iy = 0; iy <= numY; iy++) {
      const px = ix * cellW;
      const py = iy * cellW;
      prims.push(polyline(
        [[px, py], [px + pillarW, py], [px + pillarW, py + pillarW], [px, py + pillarW]],
        true, 'PILLARS', 4
      ));
      meshes.push(boxMesh(px, py, 0, pillarW, pillarW, roomH, MINE_COLORS.pillarRock, 'PILLARS'));
    }
  }

  // Entry
  const ey = -entryW - 5;
  prims.push(polyline([[-10, ey], [totalW + 10, ey], [totalW + 10, ey + entryW], [-10, ey + entryW]], true, 'ENTRY', 3));
  prims.push(text(totalW / 2 - 10, ey + 1, 'MAIN ENTRY', 2, 'TEXT', 3));
  meshes.push(boxMesh(-10, ey, 0, totalW + 20, entryW, roomH, MINE_COLORS.roadwayGravel, 'ENTRY'));

  // Key-quantity annotations: room width + pillar width on the first row,
  // extraction ratio (standard formula: 1 − (pillar/cell)²)
  const extraction = Math.round((1 - (pillarW ** 2) / (cellW ** 2)) * 1000) / 10;
  prims.push(dimension(pillarW, -8, cellW, -8, `ROOM ${roomW} m`));
  prims.push(dimension(0, -8, pillarW, -8, `PILLAR ${pillarW} m`));
  prims.push(text(0, totalH + 12, `EXTRACTION RATIO ≈${extraction.toFixed(1)}%`, 2.5, 'TEXT', 2));

  // Floor and roof planes at consistent z (roof renders translucent in 3D so
  // the workings stay visible from above).
  meshes.push(boxMesh(-2, ey - 2, -0.6, totalW + 4, totalH - ey + 4, 0.6, MINE_COLORS.floorRock, 'FLOOR'));
  meshes.push(boxMesh(-2, ey - 2, roomH, totalW + 4, totalH - ey + 4, 0.5, MINE_COLORS.roofRock, 'ROOF'));

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Room & Pillar Mine', room_width: roomW, pillar_width: pillarW,
      num_rooms_x: numX, num_rooms_y: numY, room_height: roomH, entry_width: entryW,
      extraction_ratio: extraction,
      coal_tonnes_in_situ: Math.round(numX * numY * (cellW ** 2 - pillarW ** 2) * roomH * 1.4),
      _object_type: 'room_and_pillar',
    },
    bounds: { minX: -20, minY: ey - 30, maxX: totalW + 20, maxY: totalH + 40 },
  };
}

// ─── Ventilation Network ────────────────────────────────────────────────────

export function generateVentilation(params: Record<string, number>): GeometryData {
  const numAirways = params.num_airways ?? 6;
  const airwayLen = params.airway_length ?? 100;
  const shaftD = params.shaft_diameter ?? 6;
  const fanPower = params.fan_power ?? 200;

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];
  const exX = airwayLen * 2;
  const spacing = 30;

  const layers = [
    { name: 'AIRWAYS', color: 6, description: 'Ventilation airways' },
    { name: 'SHAFTS', color: 1, description: 'Ventilation shafts' },
    { name: 'FANS', color: 3, description: 'Ventilation fans' },
    { name: 'TEXT', color: 7, description: 'Text' },
  ];

  prims.push(text(0, 80, 'VENTILATION NETWORK', 5, 'TEXT', 7));
  prims.push(circle(0, 0, shaftD, 'SHAFTS', 1));
  prims.push(text(-8, -shaftD - 5, `INTAKE SHAFT Ø${shaftD} m`, 2, 'TEXT', 1));
  prims.push(circle(exX, 0, shaftD, 'SHAFTS', 1));
  prims.push(text(exX - 8, -shaftD - 5, 'EXHAUST SHAFT', 2, 'TEXT', 1));

  for (let i = 0; i < numAirways; i++) {
    const y = -spacing * (i + 1);
    prims.push(line(0, y, exX, y, 'AIRWAYS', 6));
    prims.push(text(exX / 2 - 5, y + 2, `Airway ${i+1}`, 1.5, 'TEXT', 6));
    if (i === 0) {
      prims.push(text(2, y - 4, `L=${airwayLen} m  v=5 m/s`, 1.8, 'TEXT', 8));
    }
    // Duct just below surface level
    meshes.push(boxMesh(0, y - 1.5, -2.5, exX, 3, 3, MINE_COLORS.ductSteel, 'AIRWAYS'));
  }

  const bottomY = -spacing * (numAirways + 1);
  prims.push(line(0, 0, 0, bottomY, 'AIRWAYS', 6));
  prims.push(line(exX, 0, exX, bottomY, 'AIRWAYS', 6));

  // Vertical manifold ducts at each shaft tying the airways into a network
  meshes.push(boxMesh(-1.5, bottomY, -2.5, 3, -bottomY + 1.5, 3, MINE_COLORS.ductSteel, 'AIRWAYS'));
  meshes.push(boxMesh(exX - 1.5, bottomY, -2.5, 3, -bottomY + 1.5, 3, MINE_COLORS.ductSteel, 'AIRWAYS'));

  // Shaft collars rising above surface and a main fan on the exhaust shaft
  meshes.push(cylinderMesh(0, 0, 0, 4, shaftD * 0.8, 16, MINE_COLORS.concrete, 'intake_shaft_collar', 'SHAFTS'));
  meshes.push(cylinderMesh(exX, 0, 0, 4, shaftD * 0.8, 16, MINE_COLORS.concrete, 'exhaust_shaft_collar', 'SHAFTS'));

  const fanR = shaftD * 1.5;
  prims.push(circle(exX, shaftD + fanR + 3, fanR, 'FANS', 3));
  prims.push(text(exX - 3, shaftD + fanR + 2, 'FAN', 2, 'TEXT', 3));
  meshes.push(cylinderMesh(exX, 0, 4, 4 + fanR * 0.9, fanR * 0.75, 20, MINE_COLORS.equipmentOrange, 'main_fan', 'FANS'));
  meshes.push(cylinderMesh(exX, 0, 4 + fanR * 0.9, 4 + fanR * 1.1, fanR * 0.25, 12, MINE_COLORS.trestleSteel, 'main_fan_hub', 'FANS'));

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Ventilation Network', num_airways: numAirways,
      airway_length: airwayLen, shaft_diameter: shaftD, fan_power_kw: fanPower,
      estimated_airflow_m3s: Math.round(5 * Math.PI * (shaftD / 2) ** 2),
      _object_type: 'ventilation',
    },
    bounds: { minX: -30, minY: bottomY - 30, maxX: exX + 30, maxY: 80 },
  };
}

// ─── Conveyor ────────────────────────────────────────────────────────────────

export function generateConveyor(params: Record<string, number>): GeometryData {
  const length = params.length ?? 200;
  const width = params.width ?? 1.2;
  const inclination = params.inclination ?? 15;
  const startX = params.start_x ?? 0;
  const startY = params.start_y ?? 0;
  const endX = params.end_x ?? length;
  const endY = params.end_y ?? 0;

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];
  const dx = endX - startX;
  const dy = endY - startY;
  const actualLen = Math.sqrt(dx*dx + dy*dy) || length;
  const nx = dx / actualLen;
  const ny = dy / actualLen;
  const px = -ny; const py = nx;
  const hw = width * 5;

  const layers = [
    { name: 'CONVEYOR', color: 5, description: 'Conveyor belt' },
    { name: 'STRUCTURE', color: 8, description: 'Support structure' },
    { name: 'TEXT', color: 7, description: 'Text' },
    { name: 'DIMENSIONS', color: 2, description: 'Dimensions' },
  ];

  prims.push(text(startX, startY + 20, 'CONVEYOR ROUTE', 5, 'TEXT', 7));
  prims.push(polyline([
    [startX + px*hw, startY + py*hw], [endX + px*hw, endY + py*hw],
    [endX - px*hw, endY - py*hw], [startX - px*hw, startY - py*hw],
  ], true, 'CONVEYOR', 5));
  prims.push(line(startX, startY, endX, endY, 'CONVEYOR', 3));

  const numSupports = Math.floor(actualLen / 10);
  for (let i = 0; i <= numSupports; i++) {
    const t = i / Math.max(numSupports, 1);
    const sx = startX + dx * t;
    const sy = startY + dy * t;
    prims.push(line(sx + px*hw*1.3, sy + py*hw*1.3, sx - px*hw*1.3, sy - py*hw*1.3, 'STRUCTURE', 8));
  }

  prims.push(dimension(startX, startY - 15, endX, endY - 15, `${actualLen.toFixed(0)} m`));

  // 3D: inclined belt following the actual route direction and the declared
  // inclination (2D plan view agrees — height is the inclination axis).
  // When start == end there is no route direction — fall back to +X.
  const hasRouteDir = dx !== 0 || dy !== 0;
  const dirX = hasRouteDir ? nx : 1;
  const dirY = hasRouteDir ? ny : 0;
  const routeDx = hasRouteDir ? dx : dirX * actualLen;
  const routeDy = hasRouteDir ? dy : dirY * actualLen;
  const routeEndX = startX + routeDx;
  const routeEndY = startY + routeDy;
  const rise = actualLen * Math.tan(inclination * Math.PI / 180);
  prims.push(text((startX + routeEndX) / 2, (startY + routeEndY) / 2 + 8,
    `INCLINE ${inclination}° · RISE ${rise.toFixed(0)} m`, 2, 'TEXT', 2));

  // Belt: inclined box, carrying surface on top
  meshes.push(inclinedBoxMesh(startX, startY, 0, routeEndX, routeEndY, rise,
    width * 10, 2, MINE_COLORS.conveyorBelt, 'conveyor_belt', 'CONVEYOR'));
  // Conveyor gallery rail along the belt edge (thin inclined strip)
  meshes.push(inclinedBoxMesh(startX, startY, 2, routeEndX, routeEndY, rise + 2,
    0.8, 1.2, MINE_COLORS.trestleSteel, 'conveyor_rail', 'STRUCTURE'));

  // Trestle supports marching along the route, ground → belt underside
  for (let i = 0; i <= numSupports; i++) {
    const t = i / Math.max(numSupports, 1);
    const cx = startX + routeDx * t;
    const cy = startY + routeDy * t;
    const beltZ = rise * t;
    const postW = Math.max(1.2, width * 3);
    meshes.push(boxMesh(cx - postW / 2, cy - postW / 2, 0, postW, postW, Math.max(beltZ, 0.5),
      MINE_COLORS.trestleSteel, 'STRUCTURE'));
    // Bearing pad under the belt
    const padW = width * 10;
    meshes.push(boxMesh(cx - padW / 2, cy - padW / 2, Math.max(beltZ - 0.5, 0), padW, padW, 0.5,
      MINE_COLORS.trestleSteel, 'STRUCTURE'));
  }

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Conveyor Route', length: actualLen, width, inclination,
      start: [startX, startY], end: [endX, endY],
      vertical_lift_m: Math.round(rise * 100) / 100,
      _object_type: 'conveyor',
    },
    bounds: { minX: Math.min(startX, endX) - 30, minY: Math.min(startY, endY) - 30,
              maxX: Math.max(startX, endX) + 30, maxY: Math.max(startY, endY) + 40 },
  };
}

// ─── Blast Pattern ──────────────────────────────────────────────────────────

export function generateBlastPattern(params: Record<string, unknown>): GeometryData {
  const burden = (params.burden as number) ?? 4;
  const spacing = (params.spacing as number) ?? 5;
  const numRows = (params.num_rows as number) ?? 4;
  const numHoles = (params.num_holes_per_row as number) ?? 8;
  const holeDiam = (params.hole_diameter as number) ?? 0.2;
  const holeDepth = (params.hole_depth as number) ?? 12;
  const pattern = (params.pattern as string) ?? 'staggered';

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];
  const totalWidth = (numHoles - 1) * spacing + spacing;

  const layers = [
    { name: 'BLASTHOLES', color: 1, description: 'Blast holes' },
    { name: 'FREE-FACE', color: 3, description: 'Free face' },
    { name: 'TEXT', color: 7, description: 'Text' },
    { name: 'DIMENSIONS', color: 2, description: 'Dimensions' },
  ];

  prims.push(text(0, numRows * burden + 20, 'BLAST PATTERN LAYOUT', 5, 'TEXT', 7));
  prims.push(line(-5, 0, totalWidth + 5, 0, 'FREE-FACE', 3));
  prims.push(text(totalWidth/2 - 5, -5, 'FREE FACE', 2, 'TEXT', 3));

  for (let row = 0; row < numRows; row++) {
    const y = (row + 1) * burden;
    const xOff = (pattern === 'staggered' && row % 2 === 1) ? spacing / 2 : 0;
    for (let col = 0; col < numHoles; col++) {
      const x = col * spacing + xOff + spacing / 2;
      prims.push(circle(x, y, holeDiam * 5, 'BLASTHOLES', 1));
      const r = Math.max(0.25, holeDiam);
      meshes.push(cylinderMesh(x, y, -holeDepth, 0, r, 8, MINE_COLORS.blastHole, `blast_hole_${row}_${col}`, 'BLASTHOLES'));
      meshes.push(cylinderMesh(x, y, 0, 0.5, r * 2, 8, MINE_COLORS.equipmentOrange, `blast_hole_${row}_${col}_collar`, 'BLASTHOLES'));
    }
  }

  prims.push(dimension(spacing/2, burden, spacing/2, burden * 2, `${burden} m`));
  prims.push(dimension(spacing/2, burden - 3, spacing/2 + spacing, burden - 3, `${spacing} m`));
  // Blasting convention check: spacing/burden ratio ≈ 1.0–1.4 for production blasts
  prims.push(text(totalWidth + 5, burden * (numRows + 1), `S/B = ${(spacing / burden).toFixed(2)}`, 2, 'TEXT', 2));
  const totalHoles = numRows * numHoles;
  const rockVolM3 = burden * spacing * holeDepth * totalHoles;
  const muckVolLoose = rockVolM3 * 1.3; // swell factor

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Blast Pattern', burden, spacing, num_rows: numRows,
      num_holes_per_row: numHoles, hole_diameter: holeDiam,
      hole_depth: holeDepth, pattern, total_holes: totalHoles,
      spacing_burden_ratio: Math.round((spacing / burden) * 100) / 100,
      rock_volume_m3: Math.round(rockVolM3),
      muck_volume_loose_m3: Math.round(muckVolLoose),
      _object_type: 'blast_pattern',
    },
    bounds: { minX: -10, minY: -15, maxX: totalWidth + 10, maxY: numRows * burden + 30 },
  };
}

// ─── Decline ────────────────────────────────────────────────────────────────

export function generateDecline(params: Record<string, number>): GeometryData {
  const width = params.width ?? 5;
  const height = params.height ?? 4.5;
  const gradient = params.gradient ?? 10;
  const totalLen = params.total_length ?? 500;
  const numLevels = params.num_levels ?? 4;
  const levelSpacing = params.level_spacing ?? 30;

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];
  const segLen = totalLen / (numLevels * 2);

  const layers = [
    { name: 'DECLINE', color: 5, description: 'Decline tunnel' },
    { name: 'LEVELS', color: 3, description: 'Level access' },
    { name: 'TEXT', color: 7, description: 'Text' },
    { name: 'DIMENSIONS', color: 2, description: 'Dimensions' },
  ];

  prims.push(text(0, 40, 'DECLINE ACCESS', 5, 'TEXT', 7));

  const pts: [number, number][] = [];
  let x = 0, y = 0, dir = 1;
  for (let i = 0; i < numLevels * 2; i++) {
    pts.push([x, y]);
    x += segLen * dir;
    y -= levelSpacing / 2;
    if (i % 2 === 1) dir *= -1;
  }
  pts.push([x, y]);

  prims.push(polyline(pts, false, 'DECLINE', 5));
  for (const pt of pts) {
    prims.push(circle(pt[0], pt[1], 1.5, 'DECLINE', 5));
  }

  // The decline descends continuously: segment i drops from d_i to d_{i+1}
  // where d_i = i · (totalDepth / segments), so level k (depth k·levelSpacing)
  // is reached exactly at vertex pts[2k].
  const totalDepth = numLevels * levelSpacing;
  const numSegments = numLevels * 2;

  for (let i = 0; i < numLevels; i++) {
    const ly = -levelSpacing * (i + 1);
    const attach = pts[Math.min(2 * (i + 1), pts.length - 1)];
    prims.push(line(attach[0], ly, attach[0] + 40, ly, 'LEVELS', 3));
    prims.push(text(attach[0] + 42, ly - 1, `Level ${i+1}`, 2, 'TEXT', 3));
    meshes.push(inclinedBoxMesh(attach[0], ly, -(i + 1) * levelSpacing,
      attach[0] + 40, ly, -(i + 1) * levelSpacing,
      width, height, MINE_COLORS.levelGrey, `level_${i + 1}_drive`, 'LEVELS'));
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const d1 = (i / numSegments) * totalDepth;
    const d2 = ((i + 1) / numSegments) * totalDepth;
    meshes.push(inclinedBoxMesh(p1[0], p1[1], -d1, p2[0], p2[1], -d2,
      width, height, MINE_COLORS.tunnelGrey, `decline_segment_${i}`, 'DECLINE'));
  }

  // Portal frame at the surface entrance
  meshes.push(boxMesh(pts[0][0] - width / 2, pts[0][1] - width / 2, 0, width, width, height,
    MINE_COLORS.roadwayGravel, 'decline_portal', 'DECLINE'));

  // Key-quantity annotations: gradient at the portal (1:7–1:10 is typical)
  const ratio = gradient > 0 ? `1:${Math.round(100 / gradient)}` : 'level';
  prims.push(text(pts[0][0] + 4, pts[0][1] + 6, `GRADIENT ${gradient}% (${ratio})`, 2.2, 'TEXT', 2));
  prims.push(text(pts[0][0] + 4, pts[0][1] + 1, `VERTICAL DROP ${Math.round(totalLen * gradient / 100)} m`, 2.2, 'TEXT', 8));

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Decline Access', width, height, gradient,
      total_length: totalLen, num_levels: numLevels, level_spacing: levelSpacing,
      vertical_drop_m: Math.round(totalLen * gradient) / 100,
      _object_type: 'decline',
    },
    bounds: { minX: -30, minY: -numLevels * levelSpacing - 30, maxX: segLen + 60, maxY: 60 },
  };
}

// ─── Mine Survey Traverse Generator ──────────────────────────────────────────

export function generateMineSurveyTraverse(params: Record<string, unknown>): GeometryData {
  const numStations = Number(params.num_stations || 5);
  const startE = Number(params.starting_easting || 1000);
  const startN = Number(params.starting_northing || 2000);
  const startZ = Number(params.starting_elevation || 150);
  const avgDist = Number(params.avg_segment_len || 80);

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];

  const layers = [
    { name: 'SURVEY-STATIONS', color: 1, description: 'Control station points' },
    { name: 'TRAVERSE-LINES', color: 4, description: 'Traverse sight lines' },
    { name: 'BOUNDARY-FENCE', color: 3, description: 'Lease boundary' },
    { name: 'TEXT', color: 7, description: 'Annotations & Coordinates' },
    { name: 'DIMENSIONS', color: 2, description: 'Bearings & Distances' },
  ];

  prims.push(text(startE - 40, startN + 60, 'MINE SURVEY TRAVERSE & CONTROL LOOP', 6.0, 'TEXT', 7));

  const stations: Array<{ station: string; easting: number; northing: number; elevation: number; code: string }> = [];
  const angleStep = (2 * Math.PI) / numStations;
  let currE = startE, currN = startN, currZ = startZ;

  for (let i = 0; i < numStations; i++) {
    const stnId = i < 9 ? `STN-0${i+1}` : `STN-${i+1}`;
    const code = i === 0 ? 'CONTROL' : 'TRAVERSE';
    stations.push({
      station: stnId,
      easting: Number(currE.toFixed(3)),
      northing: Number(currN.toFixed(3)),
      elevation: Number(currZ.toFixed(3)),
      code,
    });

    const bearing = (i * angleStep) + (25 * Math.PI / 180);
    const dist = avgDist * (0.9 + 0.2 * ((i % 3) / 3));
    currE += dist * Math.sin(bearing);
    currN += dist * Math.cos(bearing);
    currZ += (i % 2 === 0 ? 1.5 : -0.5);
  }

  const closureE = Number(((currE - startE) * 0.05).toFixed(3));
  const closureN = Number(((currN - startN) * 0.05).toFixed(3));
  const totalLen = numStations * avgDist;
  const precision = `1 : ${Math.floor(totalLen / (Math.sqrt(closureE**2 + closureN**2) + 0.001))}`;
  prims.push(text(startE - 40, startN + 52, `TRAVERSE ${totalLen.toFixed(0)} m · PRECISION ${precision}`, 2.2, 'TEXT', 8));

  const ptsLoop: [number, number][] = stations.map(s => [s.easting, s.northing]);
  prims.push(polyline(ptsLoop, true, 'TRAVERSE-LINES', 4));

  const centerE = stations.reduce((a, s) => a + s.easting, 0) / numStations;
  const centerN = stations.reduce((a, s) => a + s.northing, 0) / numStations;
  const fencePts: [number, number][] = stations.map(s => [
    s.easting + (s.easting - centerE) * 0.25,
    s.northing + (s.northing - centerN) * 0.25,
  ]);
  prims.push(polyline(fencePts, true, 'BOUNDARY-FENCE', 3));

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    prims.push(circle(s.easting, s.northing, 4.0, 'SURVEY-STATIONS', 1));
    prims.push(circle(s.easting, s.northing, 1.5, 'SURVEY-STATIONS', 2));
    prims.push(text(s.easting + 5, s.northing + 6, `${s.station} (${s.code})`, 3.0, 'TEXT', 1));
    prims.push(text(s.easting + 5, s.northing + 1, `E: ${s.easting.toFixed(2)} m`, 2.2, 'TEXT', 7));
    prims.push(text(s.easting + 5, s.northing - 4, `N: ${s.northing.toFixed(2)} m`, 2.2, 'TEXT', 7));
    primitives_2d_text(prims, s.easting + 5, s.northing - 9, `Z: ${s.elevation.toFixed(2)} m`, 2.2, 'TEXT', 3);

    meshes.push(boxMesh(s.easting - 1, s.northing - 1, 0, 2, 2, 3.5, i === 0 ? '#E74C3C' : '#F39C12'));

    const nextS = stations[(i + 1) % numStations];
    const midE = (s.easting + nextS.easting) / 2;
    const midN = (s.northing + nextS.northing) / 2;
    const dx = nextS.easting - s.easting;
    const dy = nextS.northing - s.northing;
    const segDist = Math.sqrt(dx**2 + dy**2);
    const bearingDeg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    prims.push(text(midE, midN + 3, `${bearingDeg.toFixed(1)}° | ${segDist.toFixed(2)}m`, 2.0, 'DIMENSIONS', 2));
  }

  const minE = Math.min(...stations.map(s => s.easting)) - 60;
  const maxE = Math.max(...stations.map(s => s.easting)) + 60;
  const minN = Math.min(...stations.map(s => s.northing)) - 60;
  const maxN = Math.max(...stations.map(s => s.northing)) + 80;

  return {
    primitives: prims,
    meshes,
    layers,
    properties: {
      _object_type: 'mine_survey_traverse',
      name: 'Mine Survey Traverse',
      num_stations: numStations,
      starting_easting: startE,
      starting_northing: startN,
      starting_elevation: startZ,
      total_perimeter: Number(totalLen.toFixed(2)),
      misclosure_easting: closureE,
      misclosure_northing: closureN,
      precision,
      survey_stations: stations,
    },
    bounds: { minX: minE, minY: minN, maxX: maxE, maxY: maxN },
  };
}

function primitives_2d_text(prims: CadPrimitive[], x: number, y: number, t: string, h: number, layer: string, col: number) {
  prims.push(text(x, y, t, h, layer, col));
}

// ─── Topographic Contours Generator ───────────────────────────────────────────

export function generateTopographicContours(params: Record<string, unknown>): GeometryData {
  const rawInterval = Number(params.contour_interval || 5.0);
  const interval = Number.isFinite(rawInterval) ? Math.max(rawInterval, 0.5) : 5.0;
  const gridW = Number(params.grid_size_x || 300.0);
  const gridH = Number(params.grid_size_y || 200.0);
  const minZ = Number(params.min_elevation || 100.0);
  const maxZ = Number(params.max_elevation || 160.0);

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];

  const layers = [
    { name: 'MAJOR-CONTOURS', color: 1, description: 'Index contours (every 25m)' },
    { name: 'MINOR-CONTOURS', color: 8, description: 'Intermediate contours' },
    { name: 'SPOT-HEIGHTS', color: 3, description: 'Survey elevation benchmarks' },
    { name: 'TEXT', color: 7, description: 'Elevation labels' },
  ];

  prims.push(text(0, gridH / 2 + 25, 'TOPOGRAPHIC SURFACE & DTM CONTOUR MAP', 5.0, 'TEXT', 7));
  prims.push(text(0, gridH / 2 + 17, `CONTOUR INTERVAL ${interval} m · RELIEF ${Math.round(maxZ - minZ)} m`, 2.2, 'TEXT', 8));

  const centerX = gridW * 0.4, centerY = gridH * 0.5;
  const numSteps = Math.min(Math.floor((maxZ - minZ) / interval), 500);

  for (let i = 0; i <= numSteps; i++) {
    const elev = minZ + i * interval;
    const isMajor = Math.floor(elev) % 25 === 0;
    const layerName = isMajor ? 'MAJOR-CONTOURS' : 'MINOR-CONTOURS';
    const color = isMajor ? 1 : 8;

    const rx = (maxZ - elev) * 3.5 + 20;
    const ry = (maxZ - elev) * 2.2 + 15;

    const pts: [number, number][] = [];
    for (let a = 0; a < 360; a += 10) {
      const rad = a * Math.PI / 180;
      const wobble = 1.0 + 0.08 * Math.sin(3 * rad) + 0.05 * Math.cos(5 * rad);
      pts.push([centerX + rx * Math.cos(rad) * wobble, centerY + ry * Math.sin(rad) * wobble]);
    }

    prims.push(polyline(pts, true, layerName, color));
    if (pts.length > 0) {
      prims.push(text(pts[0][0], pts[0][1] + 1.5, `${Math.floor(elev)}m`, isMajor ? 2.2 : 1.6, 'TEXT', color));
    }
  }

  // 3D terrain surface: a triangulated heightfield generated from the same
  // ring math as the contours (inverting radius → elevation), split into two
  // tone bands at mid-elevation.
  const heightAt = (x: number, y: number) => {
    const nx = (x - centerX) / 3.5, ny = (y - centerY) / 2.2;
    const raw = Math.hypot(nx, ny);
    const a = Math.atan2(ny, nx);
    const wobble = 1.0 + 0.08 * Math.sin(3 * a) + 0.05 * Math.cos(5 * a);
    const h = maxZ - raw / wobble;
    return Math.min(maxZ, Math.max(minZ, h)) - minZ;
  };
  meshes.push(...heightfieldMeshes(gridW, gridH, 56, 38, heightAt,
    (maxZ - minZ) / 2, MINE_COLORS.terrainLow, MINE_COLORS.terrainHigh, 'terrain'));

  const spots = [
    { x: centerX, y: centerY, z: maxZ, label: 'BM-TOP' },
    { x: centerX - 80, y: centerY + 40, z: minZ + 12, label: 'BM-WEST' },
    { x: centerX + 90, y: centerY - 30, z: minZ + 18, label: 'BM-EAST' },
  ];

  const stations = spots.map(s => {
    prims.push(circle(s.x, s.y, 2.5, 'SPOT-HEIGHTS', 3));
    prims.push(line(s.x - 3, s.y, s.x + 3, s.y, 'SPOT-HEIGHTS', 3));
    prims.push(line(s.x, s.y - 3, s.x, s.y + 3, 'SPOT-HEIGHTS', 3));
    prims.push(text(s.x + 3, s.y + 2, `${s.label} (${s.z.toFixed(1)}m)`, 2.4, 'TEXT', 3));
    meshes.push(cylinderMesh(s.x, s.y, s.z - minZ, s.z - minZ + 3, 1.2, 10,
      MINE_COLORS.equipmentYellow, `bm_${s.label.toLowerCase()}`, 'SPOT-HEIGHTS'));
    return { station: s.label, easting: Number((s.x + 1000).toFixed(2)), northing: Number((s.y + 2000).toFixed(2)), elevation: s.z, code: 'BENCHMARK' };
  });

  return {
    primitives: prims,
    meshes,
    layers,
    properties: {
      _object_type: 'topographic_contours',
      name: 'Topographic Contours',
      contour_interval: interval,
      min_elevation: minZ,
      max_elevation: maxZ,
      grid_size_x: gridW,
      grid_size_y: gridH,
      total_area_ha: Number(((gridW * gridH) / 10000).toFixed(2)),
      survey_stations: stations,
    },
    bounds: { minX: -40, minY: -40, maxX: gridW + 40, maxY: gridH + 50 },
  };
}

// ─── Borehole Lithology Generator ─────────────────────────────────────────

export function generateBoreholeLithology(params: Record<string, unknown>): GeometryData {
  const numHoles = Number(params.num_boreholes || 5);
  const spacing = Number(params.spacing || 50);
  const totalDepth = Number(params.depth || 80);
  const seamThick = Number(params.coal_seam_thickness || 4.5);
  const seamDepth = Number(params.coal_seam_depth || 35);
  const dipAngle = Number(params.dip_angle || 8);

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];

  const layers = [
    { name: 'BOREHOLE-COLLARS', color: 1, description: 'Drillhole collar locations' },
    { name: 'OVERBURDEN', color: 2, description: 'Soil & weathered clay layer' },
    { name: 'COAL-SEAM', color: 7, description: 'Economic coal seam' },
    { name: 'TEXT', color: 7, description: 'Labels and depths' },
    { name: 'DIMENSIONS', color: 2, description: 'Depth dimensions' },
  ];

  prims.push(text(-20, 50, 'GEOLOGICAL BOREHOLE & STRATIGRAPHY CROSS SECTION', 5.0, 'TEXT', 7));

  const tanDip = Math.tan(dipAngle * Math.PI / 180);
  const seamTopPts: [number, number][] = [];
  const seamBotPts: [number, number][] = [];
  const stations = [];

  for (let i = 0; i < numHoles; i++) {
    const hx = i * spacing;
    const hy = 0;
    const currSeamDepth = seamDepth + hx * tanDip;
    const seamTopY = hy - currSeamDepth;
    const seamBotY = seamTopY - seamThick;
    const bottomY = hy - totalDepth;
    const bhName = `BH-0${i+1}`;

    stations.push({
      station: bhName,
      easting: Number((1000 + hx).toFixed(2)),
      northing: 2500,
      elevation: 120,
      coal_depth_m: Number(currSeamDepth.toFixed(2)),
      coal_thickness_m: seamThick,
      code: 'DRILLHOLE',
    });

    prims.push(line(hx, hy, hx, bottomY, 'BOREHOLE-COLLARS', 1));
    prims.push(polyline([[hx - 3, hy], [hx + 3, hy], [hx, hy + 5]], true, 'BOREHOLE-COLLARS', 1));
    prims.push(text(hx - 8, hy + 8, `${bhName} (Collar 0.0m)`, 2.4, 'TEXT', 1));
    prims.push(text(hx + 5, seamTopY, `Coal Top: -${currSeamDepth.toFixed(1)}m`, 1.8, 'TEXT', 7));
    if (i === 0) {
      prims.push(dimension(hx - 12, bottomY, hx - 12, hy, `DEPTH ${totalDepth} m`));
    }

    seamTopPts.push([hx, seamTopY]);
    seamBotPts.push([hx, seamBotY]);

    // 3D drillhole column: overburden → sandstone → coal seam → mudstone floor
    meshes.push(cylinderMesh(hx, hy, -10, 0, 1, 10, MINE_COLORS.overburden, `bh_${i + 1}_overburden`, 'OVERBURDEN'));
    meshes.push(cylinderMesh(hx, hy, seamTopY, -10, 1, 10, MINE_COLORS.sandstone, `bh_${i + 1}_sandstone`, 'SANDSTONE'));
    meshes.push(cylinderMesh(hx, hy, seamBotY, seamTopY, 1.3, 10, MINE_COLORS.coalSeam, `bh_${i + 1}_coal`, 'COAL-SEAM'));
    meshes.push(cylinderMesh(hx, hy, bottomY, seamBotY, 1, 10, MINE_COLORS.mudstone, `bh_${i + 1}_mudstone`, 'MUDSTONE-FLOOR'));
    // Collar marker at surface
    meshes.push(cylinderMesh(hx, hy, 0, 1, 1.6, 10, MINE_COLORS.equipmentOrange, `bh_${i + 1}_collar`, 'BOREHOLE-COLLARS'));
    // Seam intercept marker flag
    meshes.push(cylinderMesh(hx, hy, seamTopY - 0.25, seamTopY + 0.25, 1.8, 12, MINE_COLORS.equipmentYellow, `bh_${i + 1}_seam_marker`, 'COAL-SEAM'));
  }

  prims.push(polyline(seamTopPts, false, 'COAL-SEAM', 7));
  prims.push(polyline(seamBotPts, false, 'COAL-SEAM', 7));

  const maxXx = (numHoles - 1) * spacing + 40;
  return {
    primitives: prims,
    meshes,
    layers,
    properties: {
      _object_type: 'borehole_lithology',
      name: 'Borehole Lithology',
      num_boreholes: numHoles,
      spacing,
      total_depth: totalDepth,
      coal_seam_thickness: seamThick,
      coal_seam_depth: seamDepth,
      dip_angle_deg: dipAngle,
      coal_in_place_tonnes: Math.round(seamThick * Math.max(numHoles - 1, 1) * spacing * 100 * 1.4),
      survey_stations: stations,
    },
    bounds: { minX: -40, minY: -totalDepth - 20, maxX: maxXx, maxY: 60 },
  };
}

// ─── Longwall Panel Generator ────────────────────────────────────────────────

export function generateLongwallPanel(params: Record<string, unknown>): GeometryData {
  const faceW = Number(params.face_width || 200);
  const panelL = Number(params.panel_length || 800);
  const seamH = Number(params.seam_height || 3.5);
  const numSupports = Number(params.num_supports || 100);
  const shearerPos = Number(params.shearer_position || 80);

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];

  const layers = [
    { name: 'LONGWALL-FACE', color: 1, description: 'Longwall coal face line' },
    { name: 'POWERED-SUPPORTS', color: 3, description: 'Hydraulic roof chocks' },
    { name: 'GATEROADS', color: 5, description: 'Headgate & Tailgate roadways' },
    { name: 'SHEARER', color: 2, description: 'Coal shearer machine' },
    { name: 'TEXT', color: 7, description: 'Annotations' },
    { name: 'DIMENSIONS', color: 2, description: 'Panel dimensions' },
  ];

  prims.push(text(-20, faceW + 30, 'UNDERGROUND LONGWALL MINING PANEL', 5.0, 'TEXT', 7));
  const gateW = 5.5;

  prims.push(polyline([[0, -gateW], [panelL, -gateW], [panelL, 0], [0, 0]], true, 'GATEROADS', 5));
  prims.push(polyline([[0, faceW], [panelL, faceW], [panelL, faceW + gateW], [0, faceW + gateW]], true, 'GATEROADS', 5));

  const faceX = Math.min(350, panelL * 0.5);
  prims.push(line(faceX, 0, faceX, faceW, 'LONGWALL-FACE', 1));
  prims.push(circle(faceX, shearerPos, 4.0, 'SHEARER', 2));
  prims.push(text(faceX + 6, shearerPos, `Double-Drum Shearer (${shearerPos.toFixed(1)}m)`, 2.0, 'TEXT', 2));
  // Key-quantity annotations: face width + panel length
  prims.push(dimension(faceX + 12, 0, faceX + 12, faceW, `FACE ${faceW} m`));
  prims.push(dimension(0, -gateW - 14, panelL, -gateW - 14, `PANEL ${panelL} m`));

  // 3D: gate roads, caved goaf, coal face, powered supports, shearer
  meshes.push(boxMesh(0, -gateW, 0, panelL, gateW, seamH, MINE_COLORS.gateroad, 'headgate_roadway', 'GATEROADS'));
  meshes.push(boxMesh(0, faceW, 0, panelL, gateW, seamH, MINE_COLORS.gateroad, 'tailgate_roadway', 'GATEROADS'));
  // Caved goaf floor behind the face
  meshes.push(boxMesh(0, 0, 0, Math.max(faceX - 10, 1), faceW, 0.4, MINE_COLORS.goaf, 'caved_goaf', 'GOAF'));
  // Coal face block (uncut coal ahead of the supports)
  meshes.push(boxMesh(faceX - 1.5, 0, 0, 1.5, faceW, seamH, MINE_COLORS.coalSeam, 'longwall_face', 'LONGWALL-FACE'));
  // Powered roof supports along the face (every 4th, matching the 2D symbols)
  const supportSpacing = faceW / numSupports;
  for (let i = 0; i < numSupports; i += 4) {
    const sy = i * supportSpacing;
    meshes.push(boxMesh(faceX - 4.5, sy, 0, 3.5, supportSpacing * 3 * 0.9, seamH * 0.92,
      MINE_COLORS.equipmentYellow, `powered_support_${i}`, 'POWERED-SUPPORTS'));
  }
  // Double-drum shearer riding the face at the declared position
  const spY = Math.min(Math.max(shearerPos, 10), faceW - 10);
  meshes.push(boxMesh(faceX - 3.2, spY - 4, 0, 4.2, 8, seamH * 0.85,
    MINE_COLORS.equipmentOrange, 'coal_shearer', 'SHEARER'));
  meshes.push(cylinderMesh(faceX - 1, spY - 4, 0, seamH * 0.85, 1.4, 10,
    MINE_COLORS.trestleSteel, 'shearer_drum_near', 'SHEARER'));
  meshes.push(cylinderMesh(faceX - 1, spY + 4, 0, seamH * 0.85, 1.4, 10,
    MINE_COLORS.trestleSteel, 'shearer_drum_far', 'SHEARER'));

  return {
    primitives: prims,
    meshes,
    layers,
    properties: {
      _object_type: 'longwall_panel',
      name: 'Longwall Panel',
      face_width: faceW,
      panel_length: panelL,
      seam_height: seamH,
      num_supports: numSupports,
      shearer_position: shearerPos,
      face_advance_m: faceX,
      remaining_reserve_m: panelL - faceX,
      recoverable_coal_tonnes: Math.round(faceW * panelL * seamH * 1.4 * 0.95),
    },
    bounds: { minX: -30, minY: -30, maxX: panelL + 30, maxY: faceW + 40 },
  };
}

// ─── Cut & Fill Volume Generator ─────────────────────────────────────────────

export function generateCutFillVolume(params: Record<string, unknown>): GeometryData {
  const pitD = Number(params.pit_depth || 40);
  const surfW = Number(params.surface_width || 180);
  const botW = Number(params.bottom_width || 60);
  const slopeDeg = Number(params.original_ground_slope || 5);
  const density = Number(params.rock_density || 2.5);

  const prims: CadPrimitive[] = [];
  const meshes: MeshData[] = [];

  const layers = [
    { name: 'ORIGINAL-GROUND', color: 3, description: 'Pre-mining ground profile' },
    { name: 'DESIGN-EXCAVATION', color: 4, description: 'Target pit slope profile' },
    { name: 'CUT-AREA', color: 1, description: 'Excavation cut volume' },
    { name: 'TEXT', color: 7, description: 'Volumetric Data Table' },
    { name: 'DIMENSIONS', color: 2, description: 'Cut depth' },
  ];

  prims.push(text(-10, pitD + 30, 'CUT & FILL VOLUMETRIC CROSS SECTION', 5.0, 'TEXT', 7));

  const groundTan = Math.tan(slopeDeg * Math.PI / 180);
  prims.push(line(-30, -30 * groundTan, surfW + 30, (surfW + 30) * groundTan, 'ORIGINAL-GROUND', 3));

  const sideSetback = (surfW - botW) / 2;
  const pitPts: [number, number][] = [
    [0, 0],
    [sideSetback, -pitD],
    [sideSetback + botW, -pitD],
    [surfW, surfW * groundTan],
  ];
  prims.push(polyline(pitPts, false, 'DESIGN-EXCAVATION', 4));

  const strikeLen = 100.0;
  const cutAreaM2 = ((surfW + botW) / 2) * pitD;
  const cutVolM3 = cutAreaM2 * strikeLen;
  const cutTonnes = cutVolM3 * density;

  prims.push(text(surfW + 20, 20, 'VOLUMETRIC ESTIMATION SUMMARY', 3.0, 'TEXT', 7));
  prims.push(text(surfW + 20, 10, `Cross Section Area: ${cutAreaM2.toFixed(1)} m²`, 2.2, 'TEXT', 4));
  prims.push(text(surfW + 20, 2, `Total Cut Volume: ${cutVolM3.toLocaleString()} m³`, 2.4, 'TEXT', 1));
  prims.push(text(surfW + 20, -6, `Total Excavation Tonnage: ${cutTonnes.toLocaleString()} Tonnes`, 2.4, 'TEXT', 1));
  prims.push(dimension(-14, -pitD, -14, 0, `CUT ${pitD} m`));
  const spoilVolM3 = 0.5 * 55 * 16 * strikeLen; // spoil-dump wedge

  // 3D: excavation prism extruded from the same cross-section polygon as the
  // 2D profile, plus a spoil-dump wedge on the downhill side.
  const cutPoly: [number, number][] = [
    [0, 0],
    [sideSetback, -pitD],
    [sideSetback + botW, -pitD],
    [surfW, surfW * groundTan],
    [surfW, surfW * groundTan + 2],
    [0, 2],
  ];
  meshes.push(extrudeXZMesh(cutPoly, -strikeLen / 2, strikeLen / 2, MINE_COLORS.cutVolume, 'cut_volume', 'CUT-AREA'));
  const dumpPoly: [number, number][] = [
    [surfW, surfW * groundTan],
    [surfW + 55, surfW * groundTan],
    [surfW, surfW * groundTan + 16],
  ];
  meshes.push(extrudeXZMesh(dumpPoly, -strikeLen / 2, strikeLen / 2, MINE_COLORS.spoilDump, 'spoil_dump', 'FILL-AREA'));

  return {
    primitives: prims,
    meshes,
    layers,
    properties: {
      _object_type: 'cut_fill_volume',
      name: 'Cut & Fill Volume',
      pit_depth: pitD,
      surface_width: surfW,
      bottom_width: botW,
      cut_area_m2: Number(cutAreaM2.toFixed(2)),
      cut_volume_m3: Number(cutVolM3.toFixed(2)),
      cut_tonnes: Number(cutTonnes.toFixed(2)),
      spoil_volume_m3: Math.round(spoilVolM3),
      stripping_ratio: Number((cutVolM3 / (cutTonnes/3.5 + 0.1)).toFixed(2)),
    },
    bounds: { minX: -40, minY: -pitD - 30, maxX: surfW + 140, maxY: pitD + 40 },
  };
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

const GENERATORS: Record<string, (params: Record<string, unknown>) => GeometryData> = {
  open_pit: generateOpenPit as (params: Record<string, unknown>) => GeometryData,
  room_and_pillar: generateRoomAndPillar as (params: Record<string, unknown>) => GeometryData,
  ventilation: generateVentilation as (params: Record<string, unknown>) => GeometryData,
  conveyor: generateConveyor as (params: Record<string, unknown>) => GeometryData,
  blast_pattern: generateBlastPattern,
  decline: generateDecline as (params: Record<string, unknown>) => GeometryData,
  mine_survey_traverse: generateMineSurveyTraverse,
  topographic_contours: generateTopographicContours,
  borehole_lithology: generateBoreholeLithology,
  longwall_panel: generateLongwallPanel,
  cut_fill_volume: generateCutFillVolume,
};

// ─── Parameter Sanitizer ────────────────────────────────────────────────────

// Integer-count parameters across all generators (each defaults to ≥ 1)
const INTEGER_COUNT_PARAMS = new Set([
  'num_benches', 'num_rooms_x', 'num_rooms_y', 'num_airways',
  'num_rows', 'num_holes_per_row', 'num_levels', 'num_stations',
  'num_boreholes', 'num_supports',
]);

// Angle parameters (degrees) — keep below 90 so Math.tan stays finite
const ANGLE_PARAMS = new Set([
  'overall_slope', 'batter_angle', 'inclination', 'gradient',
  'dip_angle', 'original_ground_slope',
]);

const MAX_COUNT = 500;

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    let num: number;
    if (typeof value === 'number') {
      num = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
      num = Number(value);
      if (Number.isNaN(num)) {
        clean[key] = value; // non-numeric string (e.g. pattern) → pass through
        continue;
      }
    } else {
      continue; // non-numeric / empty → fall back to generator default
    }
    if (!Number.isFinite(num)) continue; // NaN / Infinity → generator default
    if (INTEGER_COUNT_PARAMS.has(key)) {
      num = Math.min(MAX_COUNT, Math.max(1, Math.round(num)));
    } else if (ANGLE_PARAMS.has(key)) {
      num = Math.min(89, Math.max(0, num));
    }
    clean[key] = num;
  }
  return clean;
}

export function generateGeometry(objectType: string, params: Record<string, unknown>): GeometryData {
  const gen = GENERATORS[objectType];
  if (!gen) throw new Error(`Unknown generator: ${objectType}`);
  return gen(sanitizeParams(params));
}

// ─── Local NLP Parser ───────────────────────────────────────────────────────
// v2 parser lives in promptParser.ts (parity with backend/parser.py); it is
// re-exported here so existing imports from geometryEngine keep working.

export { parsePromptLocal, parseEditCommand, buildInterpretation } from './promptParser';
export type { ParsedPrompt } from './promptParser';

export async function parseWithDeepSeekClient(
  prompt: string,
  apiKey: string,
  model = 'deepseek-chat',
  baseUrl = 'https://api.deepseek.com'
): Promise<{ object_type: string; params: Record<string, unknown> } | null> {
  try {
    let url = baseUrl.replace(/\/$/, '');
    if (!url.endsWith('/chat/completions')) {
      url = `${url}/chat/completions`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const systemPrompt = `You are a mining engineering CAD assistant. Parse the user's natural language prompt into a JSON object describing a mining engineering design.
Return ONLY valid JSON with fields:
- "object_type": one of "open_pit", "room_and_pillar", "ventilation", "conveyor", "blast_pattern", "decline"
- "params": an object with relevant parameters`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn('Client-side DeepSeek parse error:', err);
  }
  return null;
}

