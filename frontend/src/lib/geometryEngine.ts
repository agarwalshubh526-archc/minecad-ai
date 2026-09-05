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

function boxMesh(x: number, y: number, z: number, w: number, d: number, h: number, color: string): MeshData {
  const verts = [
    [x, y, z], [x+w, y, z], [x+w, y+d, z], [x, y+d, z],
    [x, y, z+h], [x+w, y, z+h], [x+w, y+d, z+h], [x, y+d, z+h],
  ];
  const faces = [
    [0,1,2],[0,2,3],[4,6,5],[4,7,6],
    [0,4,5],[0,5,1],[2,6,7],[2,7,3],
    [0,3,7],[0,7,4],[1,5,6],[1,6,2],
  ];
  return { type: 'mesh', vertices: verts, indices: faces, color, name: `box_${x}_${y}_${z}` };
}

function orientedBoxMesh(
  x: number, y: number, z: number,
  ux: number, uy: number, // unit direction along the box length (XY plane)
  len: number, wid: number, h: number,
  color: string, name: string,
): MeshData {
  const px = -uy, py = ux;
  const hw = wid / 2;
  const x2 = x + ux * len, y2 = y + uy * len;
  const verts = [
    [x + px*hw, y + py*hw, z], [x - px*hw, y - py*hw, z],
    [x2 + px*hw, y2 + py*hw, z], [x2 - px*hw, y2 - py*hw, z],
    [x + px*hw, y + py*hw, z+h], [x - px*hw, y - py*hw, z+h],
    [x2 + px*hw, y2 + py*hw, z+h], [x2 - px*hw, y2 - py*hw, z+h],
  ];
  const faces = [
    [0,2,3],[0,3,1],[4,5,7],[4,7,6],
    [0,1,5],[0,5,4],[2,6,7],[2,7,3],
    [0,4,6],[0,6,2],[1,3,7],[1,7,5],
  ];
  return { type: 'mesh', vertices: verts, indices: faces, color, name };
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

  const colors3D = ['#5B8C5A', '#4A7A4A', '#3D6B3D', '#2F5C2F', '#1E4D1E'];

  for (let i = 0; i < numBenches; i++) {
    const offset = i * totalSetback;
    const cx1 = -pitLength / 2 + offset;
    const cy1 = -pitWidth / 2 + offset;
    const cx2 = pitLength / 2 - offset;
    const cy2 = pitWidth / 2 - offset;
    if (cx2 <= cx1 || cy2 <= cy1) break;

    prims.push(polyline([[cx1, cy1], [cx2, cy1], [cx2, cy2], [cx1, cy2]], true, 'PIT-CREST', 1));

    const tx1 = cx1 + faceSetback;
    const ty1 = cy1 + faceSetback;
    const tx2 = cx2 - faceSetback;
    const ty2 = cy2 - faceSetback;
    if (tx2 > tx1 && ty2 > ty1) {
      prims.push(polyline([[tx1, ty1], [tx2, ty1], [tx2, ty2], [tx1, ty2]], true, 'PIT-TOE', 5));
    }

    prims.push(text(cx2 + 5, (cy1 + cy2) / 2, `Bench ${i+1}`, 2, 'TEXT', 7));

    // 3D benches
    const z = -i * benchHeight;
    const bw = pitLength - 2 * offset;
    const bd = pitWidth - 2 * offset;
    const col = colors3D[i % colors3D.length];
    const innerW = bw - 2 * totalSetback;
    const innerD = bd - 2 * totalSetback;
    if (innerW > 0 && innerD > 0) {
      meshes.push(boxMesh(cx1, cy1, z - benchHeight, bw, totalSetback, benchHeight, col));
      meshes.push(boxMesh(cx1, cy2 - totalSetback, z - benchHeight, bw, totalSetback, benchHeight, col));
      meshes.push(boxMesh(cx1, cy1 + totalSetback, z - benchHeight, totalSetback, bd - 2*totalSetback, benchHeight, col));
      meshes.push(boxMesh(cx2 - totalSetback, cy1 + totalSetback, z - benchHeight, totalSetback, bd - 2*totalSetback, benchHeight, col));
    } else {
      meshes.push(boxMesh(cx1, cy1, z - benchHeight, bw, bd, benchHeight, col));
    }
  }

  // Haul road (plan view)
  const roadPts: [number, number][] = [];
  const roadPts2: [number, number][] = [];
  for (let i = 0; i < numBenches; i++) {
    const offset = i * totalSetback;
    const roadX = pitLength / 2 - offset - 5;
    const ry = -pitWidth / 2 + offset;
    roadPts.push([roadX, ry]);
    roadPts2.push([roadX - haulRoadWidth, ry]);
  }
  if (roadPts.length > 1) {
    prims.push(polyline(roadPts, false, 'HAUL-ROAD', 3));
    prims.push(polyline(roadPts2, false, 'HAUL-ROAD', 3));
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
      meshes.push(boxMesh(px, py, 0, pillarW, pillarW, roomH, '#7A6B5D'));
    }
  }

  // Entry
  const ey = -entryW - 5;
  prims.push(polyline([[-10, ey], [totalW + 10, ey], [totalW + 10, ey + entryW], [-10, ey + entryW]], true, 'ENTRY', 3));
  prims.push(text(totalW / 2 - 10, ey + 1, 'MAIN ENTRY', 2, 'TEXT', 3));
  meshes.push(boxMesh(-10, ey, 0, totalW + 20, entryW, roomH, '#4A6B8A'));

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Room & Pillar Mine', room_width: roomW, pillar_width: pillarW,
      num_rooms_x: numX, num_rooms_y: numY, room_height: roomH, entry_width: entryW,
      extraction_ratio: Math.round((roomW**2) / ((roomW + pillarW)**2) * 1000) / 10,
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
  prims.push(text(-8, -shaftD - 5, 'INTAKE SHAFT', 2, 'TEXT', 1));
  prims.push(circle(exX, 0, shaftD, 'SHAFTS', 1));
  prims.push(text(exX - 8, -shaftD - 5, 'EXHAUST SHAFT', 2, 'TEXT', 1));

  for (let i = 0; i < numAirways; i++) {
    const y = -spacing * (i + 1);
    prims.push(line(0, y, exX, y, 'AIRWAYS', 6));
    prims.push(text(exX / 2 - 5, y + 2, `Airway ${i+1}`, 1.5, 'TEXT', 6));
    meshes.push(boxMesh(0, y - 1.5, 0, exX, 3, 3, '#4A8B9E'));
  }

  const bottomY = -spacing * (numAirways + 1);
  prims.push(line(0, 0, 0, bottomY, 'AIRWAYS', 6));
  prims.push(line(exX, 0, exX, bottomY, 'AIRWAYS', 6));

  const fanR = shaftD * 1.5;
  prims.push(circle(exX, shaftD + fanR + 3, fanR, 'FANS', 3));
  prims.push(text(exX - 3, shaftD + fanR + 2, 'FAN', 2, 'TEXT', 3));

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Ventilation Network', num_airways: numAirways,
      airway_length: airwayLen, shaft_diameter: shaftD, fan_power_kw: fanPower,
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

  // 3D: build the belt and supports along the actual route direction (the 2D
  // view honors dx/dy; previously the 3D mesh always ran along +X).
  // When start == end there is no route direction — fall back to +X.
  const hasRouteDir = dx !== 0 || dy !== 0;
  const dirX = hasRouteDir ? nx : 1;
  const dirY = hasRouteDir ? ny : 0;
  const routeDx = hasRouteDir ? dx : dirX * actualLen;
  const routeDy = hasRouteDir ? dy : dirY * actualLen;

  meshes.push(orientedBoxMesh(startX, startY, 0, dirX, dirY, actualLen, width*10, 2, '#D4A574', 'conveyor_belt'));
  for (let i = 0; i <= numSupports; i++) {
    const t = i / Math.max(numSupports, 1);
    const cx = startX + routeDx * t;
    const cy = startY + routeDy * t;
    meshes.push(orientedBoxMesh(cx - dirX*0.5, cy - dirY*0.5, -5, dirX, dirY, 1, width*14, 5, '#666666', `conveyor_support_${i}`));
  }

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Conveyor Route', length: actualLen, width, inclination,
      start: [startX, startY], end: [endX, endY],
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
      meshes.push(boxMesh(x - 0.3, y - 0.3, -holeDepth, 0.6, 0.6, holeDepth, '#FF4444'));
    }
  }

  prims.push(dimension(spacing/2, burden, spacing/2, burden * 2, `${burden} m`));
  prims.push(dimension(spacing/2, burden - 3, spacing/2 + spacing, burden - 3, `${spacing} m`));

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Blast Pattern', burden, spacing, num_rows: numRows,
      num_holes_per_row: numHoles, hole_diameter: holeDiam,
      hole_depth: holeDepth, pattern, total_holes: numRows * numHoles,
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

  for (let i = 0; i < numLevels; i++) {
    const ly = -levelSpacing * (i + 1);
    const closest = pts.reduce((a, b) => Math.abs(a[1] - ly) < Math.abs(b[1] - ly) ? a : b);
    prims.push(line(closest[0], ly, closest[0] + 40, ly, 'LEVELS', 3));
    prims.push(text(closest[0] + 42, ly - 1, `Level ${i+1}`, 2, 'TEXT', 3));
    meshes.push(boxMesh(closest[0], ly - width/2, -(i+1)*levelSpacing, 40, width, height, '#4A8B6E'));
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i+1];
    meshes.push(boxMesh(
      Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]) - width/2, -(i+1)*3,
      Math.abs(p2[0]-p1[0]) || width, Math.abs(p2[1]-p1[1]) || width, height, '#5A6B7C'
    ));
  }

  return {
    primitives: prims, meshes, layers,
    properties: {
      name: 'Decline Access', width, height, gradient,
      total_length: totalLen, num_levels: numLevels, level_spacing: levelSpacing,
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

    meshes.push(boxMesh(centerX - rx/2, centerY - ry/2, elev - minZ, rx, ry, interval, isMajor ? '#27AE60' : '#2ECC71'));
  }

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

    seamTopPts.push([hx, seamTopY]);
    seamBotPts.push([hx, seamBotY]);

    meshes.push(boxMesh(hx - 1, -1, hy - 10, 2, 2, 10, '#D35400'));
    meshes.push(boxMesh(hx - 1, -1, seamTopY, 2, 2, 10 - seamTopY, '#F1C40F'));
    meshes.push(boxMesh(hx - 1, -1, seamBotY, 2, 2, seamThick, '#2C3E50'));
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
  ];

  prims.push(text(-20, faceW + 30, 'UNDERGROUND LONGWALL MINING PANEL', 5.0, 'TEXT', 7));
  const gateW = 5.5;

  prims.push(polyline([[0, -gateW], [panelL, -gateW], [panelL, 0], [0, 0]], true, 'GATEROADS', 5));
  prims.push(polyline([[0, faceW], [panelL, faceW], [panelL, faceW + gateW], [0, faceW + gateW]], true, 'GATEROADS', 5));

  const faceX = Math.min(350, panelL * 0.5);
  prims.push(line(faceX, 0, faceX, faceW, 'LONGWALL-FACE', 1));
  prims.push(circle(faceX, shearerPos, 4.0, 'SHEARER', 2));
  prims.push(text(faceX + 6, shearerPos, `Double-Drum Shearer (${shearerPos.toFixed(1)}m)`, 2.0, 'TEXT', 2));

  meshes.push(boxMesh(0, -gateW, 0, panelL, gateW, seamH, '#34495E'));
  meshes.push(boxMesh(0, faceW, 0, panelL, gateW, seamH, '#34495E'));
  meshes.push(boxMesh(faceX - 6, 0, 0, 6, faceW, seamH, '#E67E22'));

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

  meshes.push(boxMesh(0, -strikeLen/2, -pitD, surfW, strikeLen, pitD, '#C0392B'));

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

const TYPE_PATTERNS: [RegExp, string][] = [
  [/survey|traverse|station|boundary|lease|control\s*loop/i, 'mine_survey_traverse'],
  [/contour|topography|topographic|elevation\s*map|dtm|surface\s*grid/i, 'topographic_contours'],
  [/borehole|drillhole|stratigraphy|coal\s*seam|lithology|core/i, 'borehole_lithology'],
  [/longwall|shearer|headgate|tailgate|chocks/i, 'longwall_panel'],
  [/cut\s*and\s*fill|cut\s*fill|volume|volumetric|earthwork|stripping\s*ratio/i, 'cut_fill_volume'],
  [/open\s*pit|pit\s*mine|surface\s*mine/i, 'open_pit'],
  [/room\s*and\s*pillar|room\s*&\s*pillar|bord\s*and\s*pillar/i, 'room_and_pillar'],
  [/ventilation|vent\s*network|airway/i, 'ventilation'],
  [/conveyor|belt\s*system/i, 'conveyor'],
  [/blast\s*(pattern|layout|design|hole)/i, 'blast_pattern'],
  [/decline|ramp\s*access|portal|shaft/i, 'decline'],
  [/haul\s*road/i, 'open_pit'],
];

const PARAM_PATTERNS: [RegExp, string][] = [
  [/(\d+\.?\d*)\s*m?\s*bench\s*height/i, 'bench_height'],
  [/bench\s*height\s*(?:of\s*)?(\d+\.?\d*)/i, 'bench_height'],
  [/(\d+\.?\d*)\s*m?\s*bench\s*width/i, 'bench_width'],
  [/bench\s*width\s*(?:of\s*)?(\d+\.?\d*)/i, 'bench_width'],
  [/(\d+)\s*bench(?:es)?/i, 'num_benches'],
  [/(\d+\.?\d*)\s*m?\s*haul\s*road/i, 'haul_road_width'],
  [/haul\s*road\s*(?:width\s*)?(?:of\s*)?(\d+\.?\d*)/i, 'haul_road_width'],
  [/(\d+\.?\d*)°?\s*(?:overall\s*)?slope/i, 'overall_slope'],
  [/slope\s*(?:angle\s*)?(?:of\s*)?(\d+\.?\d*)/i, 'overall_slope'],
  [/(\d+\.?\d*)\s*m?\s*(?:pit\s*)?length/i, 'pit_length'],
  [/(\d+\.?\d*)\s*m?\s*(?:pit\s*)?width/i, 'pit_width'],
  [/(\d+)\s*levels?/i, 'num_levels'],
  [/(\d+\.?\d*)\s*m?\s*burden/i, 'burden'],
  [/(\d+\.?\d*)\s*m?\s*spacing/i, 'spacing'],
  [/(\d+)\s*rows?/i, 'num_rows'],
  [/room\s*width\s*(?:of\s*)?(\d+\.?\d*)/i, 'room_width'],
  [/pillar\s*(?:width|size)\s*(?:of\s*)?(\d+\.?\d*)/i, 'pillar_width'],
];

export function parsePromptLocal(prompt: string): { object_type: string | null; params: Record<string, number> } {
  const text = prompt.toLowerCase();
  let objectType: string | null = null;
  for (const [re, type] of TYPE_PATTERNS) {
    if (re.test(text)) { objectType = type; break; }
  }
  const params: Record<string, number> = {};
  for (const [re, key] of PARAM_PATTERNS) {
    const m = text.match(re);
    if (m) {
      params[key] = parseFloat(m[1]);
    }
  }
  return { object_type: objectType, params };
}

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

