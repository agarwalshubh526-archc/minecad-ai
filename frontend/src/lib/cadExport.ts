import type { CadPrimitive, GeometryData } from '@/types';
import { dxfColor } from '@/types';

const cleanDxf = (value: string) => value.replace(/[\r\n\0]/g, ' ').slice(0, 255);
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function arcPoints(prim: Extract<CadPrimitive, { type: 'arc' }>) {
  const span = ((prim.endAngle - prim.startAngle) % 360 + 360) % 360 || 360;
  const segments = Math.max(8, Math.ceil(span / 10));
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = (prim.startAngle + span * i / segments) * Math.PI / 180;
    return { x: prim.cx + prim.r * Math.cos(a), y: prim.cy + prim.r * Math.sin(a) };
  });
}

export function exportDXF(geom: GeometryData): string {
  const lines = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '0', 'ENDSEC'];
  const layerMap = new Map(geom.layers.map(l => [l.name, l.color]));
  for (const prim of geom.primitives) if (!layerMap.has(prim.layer)) layerMap.set(prim.layer, prim.color);
  lines.push('0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(layerMap.size));
  for (const [name, color] of layerMap) {
    lines.push('0', 'LAYER', '2', cleanDxf(name), '70', '0', '62', String(color || 7), '6', 'CONTINUOUS');
  }
  lines.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');

  const attrs = (prim: CadPrimitive) => ['8', cleanDxf(prim.layer || '0'), '62', String(prim.color || 7)];
  const addLine = (x1: number, y1: number, x2: number, y2: number, prim: CadPrimitive) => {
    lines.push('0', 'LINE', ...attrs(prim), '10', String(x1), '20', String(y1), '30', '0', '11', String(x2), '21', String(y2), '31', '0');
  };
  const addText = (x: number, y: number, height: number, value: string, prim: CadPrimitive) => {
    lines.push('0', 'TEXT', ...attrs(prim), '10', String(x), '20', String(y), '30', '0', '40', String(height), '1', cleanDxf(value));
  };
  const addPolyline = (points: Array<{ x: number; y: number }>, closed: boolean, prim: CadPrimitive) => {
    if (!points.length) return;
    lines.push('0', 'LWPOLYLINE', ...attrs(prim), '90', String(points.length), '70', closed ? '1' : '0');
    for (const point of points) lines.push('10', String(point.x), '20', String(point.y));
  };

  for (const prim of geom.primitives) {
    switch (prim.type) {
      case 'line': addLine(prim.x1, prim.y1, prim.x2, prim.y2, prim); break;
      case 'polyline': addPolyline(prim.points, prim.closed, prim); break;
      case 'circle': lines.push('0', 'CIRCLE', ...attrs(prim), '10', String(prim.cx), '20', String(prim.cy), '30', '0', '40', String(prim.r)); break;
      case 'arc': lines.push('0', 'ARC', ...attrs(prim), '10', String(prim.cx), '20', String(prim.cy), '30', '0', '40', String(prim.r), '50', String(prim.startAngle), '51', String(prim.endAngle)); break;
      case 'text': addText(prim.x, prim.y, prim.height, prim.text, prim); break;
      case 'dimension':
        addLine(prim.x1, prim.y1, prim.x2, prim.y2, prim);
        addText((prim.x1 + prim.x2) / 2, (prim.y1 + prim.y2) / 2 + 2, 1.5, prim.text, prim);
        break;
      case 'hatch': addPolyline(prim.points, true, prim); break;
    }
  }
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n') + '\n';
}

export function exportSVG(geom: GeometryData): string {
  const { minX, minY, maxX, maxY } = geom.bounds;
  const margin = 20;
  const width = Math.max(maxX - minX, 1) + margin * 2;
  const height = Math.max(maxY - minY, 1) + margin * 2;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - margin} ${-maxY - margin} ${width} ${height}" width="1200" height="800" role="img">`];
  parts.push('<title>MineCAD conceptual drawing</title><rect width="100%" height="100%" fill="#0d1117"/>');
  for (const prim of geom.primitives) {
    const color = dxfColor(prim.color);
    switch (prim.type) {
      case 'line': parts.push(`<line x1="${prim.x1}" y1="${-prim.y1}" x2="${prim.x2}" y2="${-prim.y2}" stroke="${color}" stroke-width="0.8"/>`); break;
      case 'polyline':
      case 'hatch': {
        const points = prim.points.map(p => `${p.x},${-p.y}`).join(' ');
        const closed = prim.type === 'hatch' || prim.closed;
        parts.push(`<${closed ? 'polygon' : 'polyline'} points="${points}" stroke="${color}" stroke-width="0.8" fill="${prim.type === 'hatch' ? `${color}44` : 'none'}"/>`);
        break;
      }
      case 'circle': parts.push(`<circle cx="${prim.cx}" cy="${-prim.cy}" r="${prim.r}" stroke="${color}" stroke-width="0.8" fill="none"/>`); break;
      case 'arc': parts.push(`<polyline points="${arcPoints(prim).map(p => `${p.x},${-p.y}`).join(' ')}" stroke="${color}" stroke-width="0.8" fill="none"/>`); break;
      case 'text': parts.push(`<text x="${prim.x}" y="${-prim.y}" fill="${color}" font-size="${prim.height}" font-family="monospace">${esc(prim.text)}</text>`); break;
      case 'dimension':
        parts.push(`<line x1="${prim.x1}" y1="${-prim.y1}" x2="${prim.x2}" y2="${-prim.y2}" stroke="${color}" stroke-width="0.5"/>`);
        parts.push(`<text x="${(prim.x1 + prim.x2) / 2}" y="${-(prim.y1 + prim.y2) / 2 - 2}" fill="${color}" font-size="2" text-anchor="middle">${esc(prim.text)}</text>`);
        break;
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}

export function exportOBJ(geom: GeometryData): string {
  const lines = ['# MineCAD conceptual mesh — units: metres'];
  let offset = 0;
  for (const mesh of geom.meshes) {
    lines.push(`o ${cleanDxf(mesh.name).replace(/\s+/g, '_')}`);
    for (const v of mesh.vertices) lines.push(`v ${v[0]} ${v[2]} ${-v[1]}`);
    for (const face of mesh.indices) lines.push(`f ${face.map(i => i + offset + 1).join(' ')}`);
    offset += mesh.vertices.length;
  }
  return lines.join('\n') + '\n';
}

export function exportSTL(geom: GeometryData): string {
  const lines = ['solid MineCAD_AI'];
  for (const mesh of geom.meshes) {
    for (const face of mesh.indices) {
      const pts = face.map(i => {
        const v = mesh.vertices[i];
        return [v[0], v[2], -v[1]];
      });
      if (pts.length !== 3) continue;
      const a = pts[0], b = pts[1], c = pts[2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const len = Math.hypot(...n) || 1;
      lines.push(`  facet normal ${n.map(x => x / len).join(' ')}`, '    outer loop');
      for (const p of pts) lines.push(`      vertex ${p.join(' ')}`);
      lines.push('    endloop', '  endfacet');
    }
  }
  lines.push('endsolid MineCAD_AI');
  return lines.join('\n') + '\n';
}
