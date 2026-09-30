// MineCAD AI — Minimal client-side vector PDF exporter
// Mirrors the backend's export_pdf (lines/polylines/circles/text/dimensions)

import type { GeometryData } from '@/types';

function pdfEscapeText(text: string): string {
  return String(text)
    .replaceAll('≈', '~').replaceAll('×', 'x').replaceAll('—', '-')
    .replaceAll('–', '-').replaceAll('→', '->')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toLatin1(s: string): Uint8Array {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes[i] = code < 256 ? code : 0x3f; // '?' for non-latin-1
  }
  return bytes;
}

export function exportPDF(geometry: GeometryData): Blob {
  const b = geometry.bounds;
  const margin = 50;
  const minX = Number.isFinite(b.minX) ? b.minX : -200;
  let maxX = Number.isFinite(b.maxX) ? b.maxX : 200;
  const minY = Number.isFinite(b.minY) ? b.minY : -200;
  let maxY = Number.isFinite(b.maxY) ? b.maxY : 200;

  let pageW = maxX - minX + 2 * margin;
  let pageH = maxY - minY + 2 * margin;

  // Guard against degenerate (zero-size) bounds
  if (!(pageW > 0)) {
    pageW = 2 * margin + 1;
    maxX = minX + 1;
  }
  if (!(pageH > 0)) {
    pageH = 2 * margin + 1;
    maxY = minY + 1;
  }

  // Scale to fit A3 (1190 x 842 pts)
  const scale = Math.min(1190 / pageW, 842 / pageH, 3);
  const pw = pageW * scale;
  const ph = pageH * scale;

  const tx = (x: number) => (x - minX + margin) * scale;
  const ty = (y: number) => (maxY - y + margin) * scale; // flip Y like the SVG export

  const parts: string[] = [];
  parts.push('0.1 0.1 0.18 rg');
  parts.push(`0 0 ${pw.toFixed(1)} ${ph.toFixed(1)} re f`);
  parts.push('1 1 1 RG');
  parts.push('0.5 w');

  for (const prim of geometry.primitives) {
    if (prim.type === 'line') {
      parts.push(`${tx(prim.x1).toFixed(2)} ${ty(prim.y1).toFixed(2)} m ${tx(prim.x2).toFixed(2)} ${ty(prim.y2).toFixed(2)} l S`);
    } else if (prim.type === 'polyline') {
      if (prim.points.length === 0) continue;
      parts.push(`${tx(prim.points[0].x).toFixed(2)} ${ty(prim.points[0].y).toFixed(2)} m`);
      for (let i = 1; i < prim.points.length; i++) {
        parts.push(`${tx(prim.points[i].x).toFixed(2)} ${ty(prim.points[i].y).toFixed(2)} l`);
      }
      if (prim.closed) parts.push('h');
      parts.push('S');
    } else if (prim.type === 'circle') {
      const cx = tx(prim.cx);
      const cy = ty(prim.cy);
      const r = prim.r * scale;
      const k = 0.5522847498;
      parts.push(
        `${cx.toFixed(2)} ${(cy + r).toFixed(2)} m ` +
        `${(cx + r * k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy + r * k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c ` +
        `${(cx + r).toFixed(2)} ${(cy - r * k).toFixed(2)} ${(cx + r * k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c ` +
        `${(cx - r * k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy - r * k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c ` +
        `${(cx - r).toFixed(2)} ${(cy + r * k).toFixed(2)} ${(cx - r * k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c S`
      );
    } else if (prim.type === 'text') {
      const fontSize = Math.max(prim.height * scale, 1.0);
      parts.push('1 1 1 rg');
      parts.push(
        `BT /F1 ${fontSize.toFixed(2)} Tf 1 0 0 1 ${tx(prim.x).toFixed(2)} ${ty(prim.y).toFixed(2)} Tm ` +
        `(${pdfEscapeText(prim.text)}) Tj ET`
      );
    } else if (prim.type === 'dimension') {
      parts.push(`${tx(prim.x1).toFixed(2)} ${ty(prim.y1).toFixed(2)} m ${tx(prim.x2).toFixed(2)} ${ty(prim.y2).toFixed(2)} l S`);
      const midX = (prim.x1 + prim.x2) / 2;
      const midY = (prim.y1 + prim.y2) / 2;
      const fontSize = Math.max(1.5 * scale, 1.0);
      parts.push('1 1 1 rg');
      parts.push(
        `BT /F1 ${fontSize.toFixed(2)} Tf 1 0 0 1 ${tx(midX).toFixed(2)} ${(ty(midY) + 2 * scale).toFixed(2)} Tm ` +
        `(${pdfEscapeText(prim.text)}) Tj ET`
      );
    } else if (prim.type === 'arc') {
      const span = ((prim.endAngle - prim.startAngle) % 360 + 360) % 360 || 360;
      const count = Math.max(8, Math.ceil(span / 10));
      for (let i = 0; i <= count; i++) {
        const angle = (prim.startAngle + span * i / count) * Math.PI / 180;
        const x = tx(prim.cx + prim.r * Math.cos(angle)).toFixed(2);
        const y = ty(prim.cy + prim.r * Math.sin(angle)).toFixed(2);
        parts.push(`${x} ${y} ${i === 0 ? 'm' : 'l'}`);
      }
      parts.push('S');
    } else if (prim.type === 'hatch' && prim.points.length >= 3) {
      parts.push('0.35 0.35 0.45 rg');
      for (let i = 0; i < prim.points.length; i++) {
        const p = prim.points[i];
        parts.push(`${tx(p.x).toFixed(2)} ${ty(p.y).toFixed(2)} ${i === 0 ? 'm' : 'l'}`);
      }
      parts.push('h B', '1 1 1 rg');
    }
  }

  const stream = toLatin1(parts.join('\n'));

  // Build minimal PDF
  const encoder = new TextEncoder();
  const objects: Uint8Array[] = [];
  objects.push(encoder.encode('%PDF-1.4\n'));

  // Catalog
  objects.push(encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  // Pages
  objects.push(encoder.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
  // Page
  objects.push(encoder.encode(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(1)} ${ph.toFixed(1)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`));
  // Content stream
  objects.push(encoder.encode(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n`));
  objects.push(stream);
  objects.push(encoder.encode('\nendstream\nendobj\n'));
  // Font (base-14 Helvetica)
  objects.push(encoder.encode('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'));

  const out: number[] = [];
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(out.length);
    for (const byte of obj) out.push(byte);
  }
  const xrefStart = out.length;
  const xrefRows: string[] = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f `];
  for (let i = 1; i <= objects.length; i++) {
    xrefRows.push(`${String(offsets[i]).padStart(10, '0')} 00000 n `);
  }
  const xref = encoder.encode(xrefRows.join('\n') + '\n');
  const trailer = encoder.encode(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  const assembled = new Uint8Array(out.length + xref.length + trailer.length);
  assembled.set(out, 0);
  assembled.set(xref, out.length);
  assembled.set(trailer, out.length + xref.length);

  return new Blob([assembled], { type: 'application/pdf' });
}
