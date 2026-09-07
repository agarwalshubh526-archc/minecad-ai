// MineCAD AI — AutoCAD-style drawing sheet frame
// Generates standard CAD primitives (lines / polylines / text) for the sheet
// border, title block, north arrow and scale bar in WORLD coordinates, so the
// 2D canvas and the SVG/PDF exporters share the exact same geometry.

import type { CadPrimitive, GeometryBounds, GeometryData } from '@/types';

export const SHEET_LAYER = 'SHEET-FRAME';

export interface SheetInfo {
  projectName: string;
  objectType: string;
  date?: string;
}

export interface SheetFrame {
  primitives: CadPrimitive[];
  /** Geometry bounds expanded to include the frame */
  bounds: GeometryBounds;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 1-2-5 × 10^k "nice" step for a raw target step size. */
export function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  if (norm < 1.5) return pow;
  if (norm < 3.5) return 2 * pow;
  if (norm < 7.5) return 5 * pow;
  return 10 * pow;
}

/**
 * Nominal plot scale "1:N" — assumes the design is plotted on a 420 mm (A3)
 * wide sheet, rounded to a nice 1-2-5 × 10^k denominator.
 */
export function nominalScale(bounds: GeometryBounds): number {
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  return niceStep(w / 0.42);
}

function line(x1: number, y1: number, x2: number, y2: number, color = 7): CadPrimitive {
  return { type: 'line', x1, y1, x2, y2, layer: SHEET_LAYER, color };
}

function polyline(points: [number, number][], closed = false, color = 7): CadPrimitive {
  return { type: 'polyline', points: points.map(([x, y]) => ({ x, y })), closed, layer: SHEET_LAYER, color };
}

function text(x: number, y: number, t: string, height = 2.2, color = 7): CadPrimitive {
  return { type: 'text', x, y, text: t, height, layer: SHEET_LAYER, color };
}

const OBJECT_LABELS: Record<string, string> = {
  open_pit: 'OPEN PIT MINE',
  room_and_pillar: 'ROOM & PILLAR MINE',
  ventilation: 'VENTILATION NETWORK',
  conveyor: 'CONVEYOR ROUTE',
  blast_pattern: 'BLAST PATTERN',
  decline: 'DECLINE ACCESS',
  mine_survey_traverse: 'SURVEY TRAVERSE',
  topographic_contours: 'TOPOGRAPHIC MAP',
  borehole_lithology: 'BOREHOLE SECTION',
  longwall_panel: 'LONGWALL PANEL',
  cut_fill_volume: 'CUT & FILL SECTION',
};

// ─── Sheet frame builder ─────────────────────────────────────────────────────

/**
 * Build the drawing-sheet frame around a geometry: outer border, title block
 * (bottom-right), north arrow (top-right) and scale bar (bottom-left), all as
 * CAD primitives on the SHEET-FRAME layer in world coordinates.
 *
 * `pxPerWorld` is the display zoom used to derive text metrics: the canvas
 * clamps text to a 9 px minimum font, so laying text out in pixel terms (via
 * pxPerWorld) is the only predictable way; exports pass a nominal ~1.0.
 */
export function buildSheetFrame(geom: GeometryData, info: SheetInfo, pxPerWorld = 0.6): SheetFrame {
  const b = geom.bounds;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const size = Math.max(w, h, 50);
  const pad = Math.max(size * 0.04, 15);

  let fx1 = b.minX - pad;
  const fx2 = b.maxX + pad;
  const fy2 = b.maxY + pad;

  const prims: CadPrimitive[] = [];
  const px2w = (px: number) => px / Math.max(pxPerWorld, 1e-6);

  // Title-block metrics, derived in pixels so the canvas's 9 px font clamp
  // cannot squash the layout. The monospaced font advances 0.6 em per char.
  const rowH = px2w(16);
  const tbH = rowH * 4;
  const th = px2w(10); // body text height (~10 px on screen)
  const charW = th * 0.6;
  const padW = px2w(6);
  const inset = Math.max(size * 0.006, 1.5);

  const date = info.date ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const objLabel = OBJECT_LABELS[info.objectType] ?? info.objectType.replace(/_/g, ' ').toUpperCase();
  const scaleN = nominalScale(b);
  const barLen = niceStep(w / 4);

  // Size the block from the fixed-content rows so nothing overflows:
  //   left cell: OBJECT / SCALE / DATE, right cell: UNITS / AUTHOR
  const leftChars = Math.max(`OBJECT: ${objLabel}`.length, `SCALE: 1:${scaleN}`.length, `DATE: ${date}`.length);
  const rightChars = Math.max('UNITS: METRES'.length, 'AUTHOR: MINECAD AI'.length);
  const tbW = (leftChars + rightChars) * charW + padW * 3;
  const leftW = leftChars * charW + padW * 1.5;

  // The bottom margin band holds the scale bar (left) and the title block
  // (right). At low zoom the pixel-derived text has a large world footprint,
  // so widen the frame leftward — like the wide binding margin on a real
  // drawing sheet — whenever the band does not fit.
  const sbSpace = barLen + px2w(100);
  const bandNeed = inset * 2 + sbSpace + px2w(24) + tbW;
  if (fx2 - fx1 < bandNeed) fx1 = fx2 - bandNeed;

  // Recompute the bottom edge so the title block fits inside the margin.
  // stripH reserves space for the canvas's bottom coordinate strip.
  const stripH = px2w(24);
  const fy1b = b.minY - (inset + stripH + tbH + rowH * 0.9);

  // Outer border + inner margin line (classic double-line sheet frame)
  prims.push(polyline([[fx1, fy1b], [fx2, fy1b], [fx2, fy2], [fx1, fy2]], true, 7));
  prims.push(polyline(
    [[fx1 + inset, fy1b + inset], [fx2 - inset, fy1b + inset], [fx2 - inset, fy2 - inset], [fx1 + inset, fy2 - inset]],
    true, 8,
  ));

  // ── Title block (bottom-right, above the strip reserve) ──
  const tbx1 = fx2 - inset - tbW;
  const tby1 = fy1b + inset + stripH;
  const tby2 = tby1 + tbH;

  prims.push(polyline([[tbx1, tby1], [fx2 - inset, tby1], [fx2 - inset, tby2], [tbx1, tby2]], true, 7));
  for (let r = 1; r < 4; r++) {
    prims.push(line(tbx1, tby1 + rowH * r, fx2 - inset, tby1 + rowH * r, 8));
  }
  // Vertical split between the left and right fields of the bottom two rows
  const midX = tbx1 + leftW;
  prims.push(line(midX, tby1, midX, tby1 + rowH * 2, 8));

  const lx = tbx1 + padW;
  const rx = midX + padW;
  const maxProjectChars = Math.max(10, Math.floor((tbW - padW * 2) / charW));

  prims.push(text(lx, tby2 - rowH * 0.32, `PROJECT: ${info.projectName}`.toUpperCase().slice(0, maxProjectChars), th * 1.1, 7));
  prims.push(text(lx, tby2 - rowH * 1.32, `OBJECT: ${objLabel}`, th, 7));
  prims.push(text(lx, tby2 - rowH * 2.32, `SCALE: 1:${scaleN}`, th, 7));
  prims.push(text(rx, tby2 - rowH * 2.32, `UNITS: METRES`, th, 7));
  prims.push(text(lx, tby2 - rowH * 3.32, `DATE: ${date}`, th, 7));
  prims.push(text(rx, tby2 - rowH * 3.32, `AUTHOR: MINECAD AI`, th, 7));

  // ── North arrow (top-right, inside the frame) ──
  const naCx = fx2 - inset - px2w(30);
  const naCy = fy2 - inset - px2w(34);
  const naR = px2w(12);
  prims.push({ type: 'circle', cx: naCx, cy: naCy, r: naR, layer: SHEET_LAYER, color: 7 });
  prims.push(polyline(
    [[naCx, naCy - naR * 0.75], [naCx + naR * 0.28, naCy + naR * 0.35], [naCx, naCy + naR * 0.1], [naCx - naR * 0.28, naCy + naR * 0.35]],
    true, 1,
  ));
  prims.push(text(naCx - naR * 0.35, naCy - naR - th * 0.7, 'N', th * 1.2, 7));

  // ── Scale bar (bottom-left, inside the bottom margin band) ──
  const sbX = fx1 + inset + px2w(10);
  const barH = px2w(5);
  const sbY = fy1b + inset + stripH + px2w(4);
  const seg = barLen / 4;
  for (let sgm = 0; sgm < 4; sgm++) {
    // alternating filled-look boxes drawn as closed outlines
    prims.push(polyline(
      [[sbX + sgm * seg, sbY], [sbX + (sgm + 1) * seg, sbY], [sbX + (sgm + 1) * seg, sbY + barH], [sbX + sgm * seg, sbY + barH]],
      true, sgm % 2 === 0 ? 7 : 8,
    ));
  }
  prims.push(text(sbX, sbY + barH + th * 1.15, '0', th, 7));
  prims.push(text(sbX + seg * 2 - th, sbY + barH + th * 1.15, `${seg * 2}`, th, 7));
  prims.push(text(sbX + barLen - th * 2, sbY + barH + th * 1.15, `${barLen} m`, th, 7));

  return {
    primitives: prims,
    bounds: { minX: fx1, minY: fy1b, maxX: fx2, maxY: fy2 },
  };
}
