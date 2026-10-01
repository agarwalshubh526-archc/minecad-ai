'use client';

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { GeometryData, LayerInfo, CadPrimitive, SceneObject } from '@/types';
import { dxfColor } from '@/types';
import { buildSheetFrame, SHEET_LAYER } from '@/lib/sheetFrame';

interface Canvas2DProps {
  geometry: GeometryData | null;
  layers: LayerInfo[];
  sceneObjects?: SceneObject[];
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onMoveObject?: (id: string, x: number, y: number) => void;
  onDeleteObject?: (id: string) => void;
  // Identifies the project/type being viewed; a change triggers an auto-fit
  fitKey?: string | null;
  // AutoCAD-style drawing sheet (frame, title block, north arrow, grid labels)
  sheetMode?: boolean;
  sheetProjectName?: string;
  sheetObjectType?: string;
}

export default function Canvas2D({ geometry, layers, sceneObjects = [], selectedObjectId = null, onSelectObject, onMoveObject, onDeleteObject, fitKey = null, sheetMode = false, sheetProjectName = 'Untitled', sheetObjectType = '' }: Canvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [cursorWorld, setCursorWorld] = useState({ x: 0, y: 0 });

  const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'coordinate' | 'distance' | 'area'>('select');
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragObjectRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [legendOpen, setLegendOpen] = useState(true);

  // Latest cursor world position (readable from throttled/rAF contexts)
  const cursorWorldRef = useRef({ x: 0, y: 0 });
  // Whether the user has panned/zoomed since the last auto-fit
  const hasUserTransformed = useRef(false);
  const lastFitKey = useRef<string | null | undefined>(undefined);
  const cursorRafRef = useRef<number | null>(null);
  const mouseDownRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // Touch gesture tracking (pointer events; mouse keeps the existing path)
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ startDist: number; startScale: number; startTx: number; startTy: number } | null>(null);
  const tapRef = useRef<{ id: number; x: number; y: number; t: number; dragged: boolean } | null>(null);

  // Visible layer set (memoized — it feeds draw()'s dependency array)
  const visibleLayers = useMemo(
    () => new Set(layers.filter(l => l.visible).map(l => l.name)),
    [layers],
  );

  // Drawing-sheet frame primitives (world space, shared with SVG/PDF exports).
  // Text metrics are derived from the live zoom so the canvas's minimum-font
  // clamp cannot squash the title-block layout.
  const sheetFrame = useMemo(
    () => (sheetMode && geometry
      ? buildSheetFrame(geometry, { projectName: sheetProjectName, objectType: sheetObjectType }, transform.scale)
      : null),
    [sheetMode, geometry, sheetProjectName, sheetObjectType, transform.scale],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = '#0a0e15';
    ctx.fillRect(0, 0, w, h);

    // Grid — step grows with zoom-out so the line count stays bounded
    const { x: tx, y: ty, scale } = transform;
    let gridSize = scale > 0.5 ? 10 : scale > 0.2 ? 50 : 100;
    while (gridSize * scale < 20) gridSize *= 5;
    const gridScale = gridSize * scale;

    ctx.strokeStyle = '#161b22';
    ctx.lineWidth = 0.5;
    const startX = (tx % gridScale);
    const startY = (ty % gridScale);
    for (let gx = startX; gx < w; gx += gridScale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = startY; gy < h; gy += gridScale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // Grid edge tick labels (sheet mode): world easting along the top,
    // world northing along the left, at the current grid step.
    if (sheetMode && geometry) {
      const decimals = gridSize < 1 ? 1 : 0;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#6e7681';
      ctx.textAlign = 'center';
      for (let gx = startX; gx < w; gx += gridScale) {
        const worldX = (gx - w / 2 - tx) / scale;
        ctx.fillText(worldX.toFixed(decimals), gx, 12);
      }
      ctx.textAlign = 'left';
      for (let gy = startY; gy < h; gy += gridScale) {
        const worldY = -(gy - h / 2 - ty) / scale;
        ctx.fillText(worldY.toFixed(decimals), 4, gy + 3);
      }
    }

    // Origin crosshair
    const ox = w / 2 + tx;
    const oy = h / 2 + ty;
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();

    if (!geometry) {
      // Empty state text
      ctx.fillStyle = '#484f58';
      ctx.font = '16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Select a template or enter a prompt to start mine mapping', w / 2, h / 2);
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('Example: "Survey traverse loop 5 stations" or "Topographic contours interval 5m"', w / 2, h / 2 + 30);
      return;
    }

    // Transform helper
    const worldToScreen = (wx: number, wy: number): [number, number] => {
      return [w / 2 + tx + wx * scale, h / 2 + ty - wy * scale]; // flip Y
    };

    // Draw primitives
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawPrim = (prim: CadPrimitive) => {
      const color = dxfColor(prim.color);

      if (prim.type === 'line') {
        const [sx1, sy1] = worldToScreen(prim.x1, prim.y1);
        const [sx2, sy2] = worldToScreen(prim.x2, prim.y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      } else if (prim.type === 'polyline') {
        if (prim.points.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const [sx0, sy0] = worldToScreen(prim.points[0].x, prim.points[0].y);
        ctx.moveTo(sx0, sy0);
        for (let i = 1; i < prim.points.length; i++) {
          const [sx, sy] = worldToScreen(prim.points[i].x, prim.points[i].y);
          ctx.lineTo(sx, sy);
        }
        if (prim.closed) ctx.closePath();
        ctx.stroke();
      } else if (prim.type === 'circle') {
        const [scx, scy] = worldToScreen(prim.cx, prim.cy);
        const sr = prim.r * scale;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(scx, scy, Math.max(1, sr), 0, Math.PI * 2);
        ctx.stroke();
      } else if (prim.type === 'arc') {
        const [scx, scy] = worldToScreen(prim.cx, prim.cy);
        const sr = prim.r * scale;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(scx, scy, Math.max(1, sr), -prim.endAngle * Math.PI / 180, -prim.startAngle * Math.PI / 180);
        ctx.stroke();
      } else if (prim.type === 'hatch') {
        if (prim.points.length < 3) return;
        ctx.fillStyle = color + '25';
        ctx.strokeStyle = color + '60';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const [h0x, h0y] = worldToScreen(prim.points[0].x, prim.points[0].y);
        ctx.moveTo(h0x, h0y);
        for (let i = 1; i < prim.points.length; i++) {
          const [hx, hy] = worldToScreen(prim.points[i].x, prim.points[i].y);
          ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (prim.type === 'text') {
        const [stx, sty] = worldToScreen(prim.x, prim.y);
        const fontH = Math.max(9, Math.min(24, prim.height * scale));
        ctx.fillStyle = color;
        ctx.font = `${fontH}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(prim.text, stx, sty);
      } else if (prim.type === 'dimension') {
        const [sx1, sy1] = worldToScreen(prim.x1, prim.y1);
        const [sx2, sy2] = worldToScreen(prim.x2, prim.y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(prim.text, (sx1 + sx2) / 2, (sy1 + sy2) / 2 - 4);
      }
    };

    for (const prim of geometry.primitives) {
      if (!visibleLayers.has(prim.layer) && !visibleLayers.has('*')) continue;
      drawPrim(prim);
    }
    // Sheet frame bypasses the layer-visibility filter — it is chrome, not data
    if (sheetFrame) {
      for (const prim of sheetFrame.primitives) drawPrim(prim);
    }

    const selected = sceneObjects.find(item => item.id === selectedObjectId);
    if (selected) {
      const b = selected.geometry.bounds;
      const origin = dragPreview?.id === selected.id ? dragPreview : selected.origin;
      const [left, top] = worldToScreen(b.minX + origin.x, b.maxY + origin.y);
      const [right, bottom] = worldToScreen(b.maxX + origin.x, b.minY + origin.y);
      ctx.save();
      ctx.strokeStyle = '#f7b84e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(left - 5, top - 5, right - left + 10, bottom - top + 10);
      ctx.restore();
    }

    // (No screen-space scale bar in sheet mode: the sheet frame draws its own
    // world-space bar in the bottom margin, so it appears in exports too.)

    // Draw Active Interactive Measurement Tool Renderings
    if (measurePoints.length > 0) {
      ctx.strokeStyle = '#f39c12';
      ctx.fillStyle = '#f39c12';
      ctx.lineWidth = 2;

      const screenPts = measurePoints.map(p => worldToScreen(p.x, p.y));

      // Draw points & connecting line
      ctx.beginPath();
      ctx.moveTo(screenPts[0][0], screenPts[0][1]);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i][0], screenPts[i][1]);
      }
      if (activeTool === 'area' && screenPts.length > 2) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(243, 156, 18, 0.15)';
        ctx.fill();
      }
      ctx.stroke();

      for (const [px, py] of screenPts) {
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
      }

      // Distance calculation label
      if (activeTool === 'distance' && measurePoints.length >= 2) {
        const p1 = measurePoints[0];
        const p2 = measurePoints[1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx**2 + dy**2);
        const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

        const [midX, midY] = worldToScreen((p1.x + p2.x)/2, (p1.y + p2.y)/2);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(midX - 60, midY - 24, 120, 32);
        ctx.strokeStyle = '#f39c12';
        ctx.strokeRect(midX - 60, midY - 24, 120, 32);

        ctx.fillStyle = '#36d399';
        ctx.font = '11px font-mono';
        ctx.textAlign = 'center';
        ctx.fillText(`Dist: ${dist.toFixed(2)} m`, midX, midY - 8);
        ctx.fillText(`Bearing: ${bearing.toFixed(1)}°`, midX, midY + 5);
      }

      // Polygon Area calculation label
      if (activeTool === 'area' && measurePoints.length >= 3) {
        let area = 0;
        for (let i = 0; i < measurePoints.length; i++) {
          const j = (i + 1) % measurePoints.length;
          area += measurePoints[i].x * measurePoints[j].y;
          area -= measurePoints[j].x * measurePoints[i].y;
        }
        area = Math.abs(area) / 2;
        const hectares = area / 10000;

        const [cx, cy] = worldToScreen(
          measurePoints.reduce((a, b) => a + b.x, 0) / measurePoints.length,
          measurePoints.reduce((a, b) => a + b.y, 0) / measurePoints.length
        );

        ctx.fillStyle = '#161b22';
        ctx.fillRect(cx - 70, cy - 20, 140, 32);
        ctx.strokeStyle = '#36d399';
        ctx.strokeRect(cx - 70, cy - 20, 140, 32);

        ctx.fillStyle = '#36d399';
        ctx.font = '11px font-mono';
        ctx.textAlign = 'center';
        ctx.fillText(`Area: ${area.toFixed(1)} m²`, cx, cy - 6);
        ctx.fillText(`(${hectares.toFixed(3)} Ha)`, cx, cy + 7);
      }

      // Picked coordinate label
      if (activeTool === 'coordinate' && measurePoints.length >= 1) {
        const p = measurePoints[measurePoints.length - 1];
        const [lx, ly] = worldToScreen(p.x, p.y);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(lx + 12, ly - 30, 190, 34);
        ctx.strokeStyle = '#58a6ff';
        ctx.strokeRect(lx + 12, ly - 30, 190, 34);

        ctx.fillStyle = '#36d399';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`E: ${p.x.toFixed(2)} m  N: ${p.y.toFixed(2)} m`, lx + 18, ly - 9);
      }
    }

  }, [geometry, transform, visibleLayers, measurePoints, activeTool, sheetFrame, sheetMode, sceneObjects, selectedObjectId, dragPreview]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Fit view bounds — in sheet mode the frame is part of the drawing, so
  // extents include it (otherwise the title block/scale bar fall outside
  // the fitted view)
  const fitView = useCallback(() => {
    if (!geometry || !canvasRef.current) return;
    const bounds = (sheetMode && sheetFrame) ? sheetFrame.bounds : geometry.bounds;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    if (w <= 0 || h <= 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const margin = 50;
    const scaleX = (rect.width - margin * 2) / w;
    const scaleY = (rect.height - margin * 2) / h;
    const scale = Math.min(scaleX, scaleY);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    setTransform({
      scale,
      x: -centerX * scale,
      y: centerY * scale,
    });
  }, [geometry, sheetMode, sheetFrame]);

  // Auto-fit only on first load / when the project or object type changes.
  // Regenerations of the same project keep the current view unless the user
  // hasn't panned/zoomed since the last fit. Toggling the sheet re-fits so
  // the frame is fully in view.
  const lastSheetMode = useRef(sheetMode);
  useEffect(() => {
    if (!geometry) return;
    if (fitKey !== lastFitKey.current || sheetMode !== lastSheetMode.current) {
      lastFitKey.current = fitKey;
      lastSheetMode.current = sheetMode;
      hasUserTransformed.current = false;
      fitView();
    } else if (!hasUserTransformed.current) {
      fitView();
    }
  }, [geometry, fitKey, fitView, sheetMode]);

  // Clear stale measure points when the geometry changes
  const prevGeometryRef = useRef(geometry);
  useEffect(() => {
    if (prevGeometryRef.current !== geometry) {
      prevGeometryRef.current = geometry;
      setMeasurePoints([]);
    }
  }, [geometry]);

  // Escape cancels the active measure tool and clears its points
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('pan');
        setMeasurePoints([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Wheel zoom needs a non-passive listener — React's onWheel is passive,
  // so e.preventDefault() there doesn't stop the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      hasUserTransformed.current = true;
      setTransform(prev => {
        const newScale = Math.max(0.01, Math.min(50, prev.scale * factor));
        const ratio = newScale / prev.scale;
        return {
          scale: newScale,
          x: mx - ratio * (mx - cx - prev.x) - cx,
          y: my - ratio * (my - cy - prev.y) - cy,
        };
      });
    };
    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelNative);
  }, []);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => requestAnimationFrame(draw));
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Mouse handlers (wheel zoom is attached as a non-passive native listener above)
  const addMeasurePoint = useCallback(() => {
    const point = { x: cursorWorldRef.current.x, y: cursorWorldRef.current.y };
    if (activeTool === 'distance' && measurePoints.length >= 2) {
      setMeasurePoints([point]);
    } else {
      setMeasurePoints(prev => [...prev, point]);
    }
  }, [activeTool, measurePoints.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      mouseDownRef.current = { x: e.clientX, y: e.clientY, moved: false };
      if (activeTool === 'select') {
        const point = worldFromClient(e.clientX, e.clientY);
        const item = findObjectAt(point.x, point.y);
        if (item) {
          onSelectObject?.(item.id);
          dragObjectRef.current = { id: item.id, startX: point.x, startY: point.y, originX: item.origin.x, originY: item.origin.y };
        }
        return;
      }
      if (activeTool === 'distance' || activeTool === 'area' || activeTool === 'coordinate') {
        addMeasurePoint();
        return;
      }
      setIsDragging(true);
      hasUserTransformed.current = true;
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseDownRef.current && Math.hypot(e.clientX - mouseDownRef.current.x, e.clientY - mouseDownRef.current.y) > 5) mouseDownRef.current.moved = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Update cursor world position (rAF-throttled to avoid re-render storms)
    const wx = (mx - rect.width / 2 - transform.x) / transform.scale;
    const wy = -(my - rect.height / 2 - transform.y) / transform.scale;
    cursorWorldRef.current = { x: wx, y: wy };
    if (dragObjectRef.current && mouseDownRef.current?.moved) {
      const drag = dragObjectRef.current;
      setDragPreview({ id: drag.id, x: Math.round((drag.originX + wx - drag.startX) * 10) / 10,
        y: Math.round((drag.originY + wy - drag.startY) * 10) / 10 });
    }
    if (cursorRafRef.current === null) {
      cursorRafRef.current = requestAnimationFrame(() => {
        cursorRafRef.current = null;
        setCursorWorld(cursorWorldRef.current);
      });
    }

    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const worldFromClient = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - rect.width / 2 - transform.x) / transform.scale,
      y: -(clientY - rect.top - rect.height / 2 - transform.y) / transform.scale };
  };

  const findObjectAt = (x: number, y: number) => {
    const hits = sceneObjects.filter(item => {
      const b = item.geometry.bounds;
      return x >= b.minX + item.origin.x && x <= b.maxX + item.origin.x &&
        y >= b.minY + item.origin.y && y <= b.maxY + item.origin.y;
    });
    hits.sort((a, b) => {
      const ab = a.geometry.bounds, bb = b.geometry.bounds;
      return (ab.maxX - ab.minX) * (ab.maxY - ab.minY) - (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
    });
    return hits[0];
  };

  const selectAtCursor = () => {
    const item = findObjectAt(cursorWorldRef.current.x, cursorWorldRef.current.y);
    if (item) onSelectObject?.(item.id);
  };

  // ── Touch gestures (pointer events; `touch-action: none` on the canvas) ──
  // Single-finger drag = pan (pan tool only), two-finger pinch = zoom at the
  // pinch midpoint, tap = same as a click for the measure tools.
  const updateCursorWorldFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    cursorWorldRef.current = {
      x: (mx - rect.width / 2 - transform.x) / transform.scale,
      y: -(my - rect.height / 2 - transform.y) / transform.scale,
    };
    if (cursorRafRef.current === null) {
      cursorRafRef.current = requestAnimationFrame(() => {
        cursorRafRef.current = null;
        setCursorWorld(cursorWorldRef.current);
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' || !canvasRef.current) return;
    e.preventDefault(); // suppress synthesized mouse events from the touch
    canvasRef.current.setPointerCapture(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    touchPointersRef.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (touchPointersRef.current.size === 2) {
      // Second finger → pinch zoom; cancel any pending tap
      tapRef.current = null;
      setIsDragging(false);
      const [p1, p2] = [...touchPointersRef.current.values()];
      pinchRef.current = {
        startDist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        startScale: transform.scale,
        startTx: transform.x,
        startTy: transform.y,
      };
    } else if (touchPointersRef.current.size === 1) {
      tapRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), dragged: false };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') return;
    if (!touchPointersRef.current.has(e.pointerId)) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    touchPointersRef.current.set(e.pointerId, pos);
    updateCursorWorldFromClient(e.clientX, e.clientY);

    if (touchPointersRef.current.size === 2 && pinchRef.current && pinchRef.current.startDist > 0) {
      const [p1, p2] = [...touchPointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const { startDist, startScale, startTx, startTy } = pinchRef.current;
      const newScale = Math.max(0.01, Math.min(50, startScale * (dist / startDist)));
      const ratio = newScale / startScale;
      hasUserTransformed.current = true;
      setTransform({
        scale: newScale,
        x: midX - ratio * (midX - cx - startTx) - cx,
        y: midY - ratio * (midY - cy - startTy) - cy,
      });
      return;
    }

    const tap = tapRef.current;
    if (touchPointersRef.current.size === 1 && tap && tap.id === e.pointerId) {
      if (!tap.dragged && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) {
        tap.dragged = true;
        if (activeTool === 'pan') {
          setIsDragging(true);
          setLastMouse({ x: e.clientX, y: e.clientY });
        }
      }
      if (tap.dragged && activeTool === 'pan') {
        hasUserTransformed.current = true;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        setLastMouse({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault(); // suppress synthesized mouse events from the touch
    touchPointersRef.current.delete(e.pointerId);
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
    if (touchPointersRef.current.size === 0) setIsDragging(false);

    const tap = tapRef.current;
    if (tap && tap.id === e.pointerId) {
      tapRef.current = null;
      if (!tap.dragged && Date.now() - tap.t < 500) {
        if (activeTool === 'select') selectAtCursor();
        else addMeasurePoint();
      }
    }
  };

  // Cancel any pending cursor update on unmount
  useEffect(() => {
    return () => {
      if (cursorRafRef.current !== null) cancelAnimationFrame(cursorRafRef.current);
    };
  }, []);

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    if (dragObjectRef.current && mouseDownRef.current?.moved) {
      const drag = dragObjectRef.current;
      const point = worldFromClient(e.clientX, e.clientY);
      onMoveObject?.(drag.id, Math.round((drag.originX + point.x - drag.startX) * 10) / 10,
        Math.round((drag.originY + point.y - drag.startY) * 10) / 10);
    }
    dragObjectRef.current = null;
    setDragPreview(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none">
      {/* Top Surveying Tool Bar Overlay */}
      <div className="absolute top-3 left-3 right-14 bg-surface-overlay/90 backdrop-blur border border-edge rounded-lg p-1 flex items-center gap-1 z-30 shadow-[var(--shadow-pop)] font-mono text-[11px] overflow-x-auto scrollbar-none">
        <button onClick={fitView} className="px-2.5 py-2 md:py-1 rounded text-fg-muted hover:bg-surface-hover border border-edge shrink-0" title="Fit all mine components in view">Fit all</button>
        <button onClick={() => { setActiveTool('select'); setMeasurePoints([]); }} className={`px-2.5 py-2 md:py-1 rounded shrink-0 ${activeTool === 'select' ? 'bg-accent-dim text-accent border border-edge-accent' : 'text-fg-muted hover:bg-surface-hover border border-transparent'}`} title="Select and drag a mine component">Select/Move</button>
        <button
          onClick={() => { setActiveTool('pan'); setMeasurePoints([]); }}
          className={`px-2.5 py-2 md:py-1 rounded flex items-center gap-1.5 transition-colors shrink-0 ${activeTool === 'pan' ? 'bg-accent-dim text-accent border border-edge-accent' : 'text-fg-muted hover:bg-surface-hover border border-transparent'}`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4" />
            <path d="m10 10 3.5 3.5" />
          </svg>
          <span className="hidden sm:inline">Pan/Inspect</span>
        </button>
        <button
          onClick={() => { setActiveTool('coordinate'); setMeasurePoints([]); }}
          className={`px-2.5 py-2 md:py-1 rounded flex items-center gap-1.5 transition-colors shrink-0 ${activeTool === 'coordinate' ? 'bg-accent-dim text-accent border border-edge-accent' : 'text-fg-muted hover:bg-surface-hover border border-transparent'}`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M8 14.5s5-4.7 5-8.5a5 5 0 0 0-10 0c0 3.8 5 8.5 5 8.5Z" />
            <circle cx="8" cy="6" r="1.8" />
          </svg>
          <span className="hidden sm:inline">XY Easting/Northing</span>
        </button>
        <button
          onClick={() => { setActiveTool('distance'); setMeasurePoints([]); }}
          className={`px-2.5 py-2 md:py-1 rounded flex items-center gap-1.5 transition-colors shrink-0 ${activeTool === 'distance' ? 'bg-accent-dim text-accent border border-edge-accent' : 'text-fg-muted hover:bg-surface-hover border border-transparent'}`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <rect x="1.5" y="5" width="13" height="6" rx="1" />
            <path d="M4.5 5v2.2M7.5 5v3M10.5 5v2.2" />
          </svg>
          <span className="hidden sm:inline">Distance Tape</span>
        </button>
        <button
          onClick={() => { setActiveTool('area'); setMeasurePoints([]); }}
          className={`px-2.5 py-2 md:py-1 rounded flex items-center gap-1.5 transition-colors shrink-0 ${activeTool === 'area' ? 'bg-accent-dim text-accent border border-edge-accent' : 'text-fg-muted hover:bg-surface-hover border border-transparent'}`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M2 3h12l-1.5 10h-9L2 3Z" />
            <path d="M8 3v10" strokeDasharray="2 1.5" />
          </svg>
          <span className="hidden sm:inline">Polygon Area</span>
        </button>
        {measurePoints.length > 0 && (
          <button
            onClick={() => setMeasurePoints([])}
            className="px-2 py-1 bg-danger/15 text-danger border border-danger/40 rounded text-[10px] ml-1 hover:bg-danger/25 transition-colors shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* Legend (sheet mode) — below the tool bar, collapsible */}
      {sheetMode && geometry && (
        <div className="absolute left-3 bg-surface-overlay/90 backdrop-blur border border-edge rounded-lg z-30 shadow-[var(--shadow-pop)] font-mono text-[10px] max-w-44" style={{ top: 52 }}>
          <button
            onClick={() => setLegendOpen(!legendOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-fg-muted hover:text-fg transition-colors"
            aria-label={legendOpen ? 'Collapse legend' : 'Expand legend'}
          >
            <span className="font-semibold tracking-[0.14em] text-[9px] uppercase">Legend</span>
            <span className="text-[8px]">{legendOpen ? '▾' : '▸'}</span>
          </button>
          {legendOpen && (
            <div className="px-2.5 pb-2 pt-0.5 space-y-1">
              {layers.filter(l => l.name !== SHEET_LAYER).map(l => (
                <div key={l.name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-0 border-t-2 shrink-0"
                    style={{ borderColor: dxfColor(l.color) }}
                  />
                  <span className="text-fg-muted truncate" title={l.description}>{l.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* North Compass Arrow Overlay */}
      <div className="absolute top-3 right-3 w-12 h-12 bg-surface-overlay/90 backdrop-blur border border-edge rounded-full flex flex-col items-center justify-center pointer-events-none z-30 shadow-lg">
        <span className="text-danger text-xs font-bold font-mono">N ▲</span>
        <span className="text-[8px] text-fg-faint font-mono">SURVEY</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair touch-none"
        tabIndex={0}
        role="application"
        aria-label="2D mine drawing. Select and drag components, use arrow keys to move the inspection cursor, Space to add a measurement point, and Escape to return to Select."
        onKeyDown={e => {
          const step = 10 / Math.max(transform.scale, 0.1);
          const next = { ...cursorWorldRef.current };
          if (e.key === 'ArrowLeft') next.x -= step;
          else if (e.key === 'ArrowRight') next.x += step;
          else if (e.key === 'ArrowUp') next.y += step;
          else if (e.key === 'ArrowDown') next.y -= step;
          else if (e.key === ' ' && activeTool !== 'pan') { e.preventDefault(); addMeasurePoint(); return; }
          else if (e.key === 'Escape') { setMeasurePoints([]); setActiveTool('select'); return; }
          else if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool === 'select' && selectedObjectId) { e.preventDefault(); onDeleteObject?.(selectedObjectId); return; }
          else return;
          e.preventDefault();
          cursorWorldRef.current = next;
          setCursorWorld(next);
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={() => { if (activeTool === 'select' && mouseDownRef.current && !mouseDownRef.current.moved) selectAtCursor(); mouseDownRef.current = null; }}
        onMouseLeave={handleMouseUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      />

      <div className="sr-only" aria-live="polite">
        {activeTool === 'distance' && measurePoints.length === 2 &&
          `Measured distance ${Math.hypot(measurePoints[1].x - measurePoints[0].x, measurePoints[1].y - measurePoints[0].y).toFixed(2)} metres.`}
        {activeTool === 'coordinate' && measurePoints.length > 0 &&
          `Selected coordinate easting ${measurePoints.at(-1)!.x.toFixed(2)}, northing ${measurePoints.at(-1)!.y.toFixed(2)} metres.`}
      </div>

      {/* Coordinate bar */}
      <div className="absolute bottom-0 left-0 right-0 min-h-6 bg-surface-raised/90 backdrop-blur border-t border-edge flex flex-wrap items-center px-3 py-0.5 text-[9px] md:text-[10px] text-fg-muted font-mono gap-x-4 gap-y-0.5 z-30">
        <span className="text-success tabular-nums whitespace-nowrap">Easting (X): {cursorWorld.x.toFixed(2)} m</span>
        <span className="text-success tabular-nums whitespace-nowrap">Northing (Y): {cursorWorld.y.toFixed(2)} m</span>
        <span className="whitespace-nowrap">Tool: {activeTool.toUpperCase()}</span>
        <span className="whitespace-nowrap">Zoom: {(transform.scale * 100).toFixed(0)}%</span>
        {geometry && <span className="text-info whitespace-nowrap">{geometry.primitives.length} CAD primitives</span>}
      </div>
    </div>
  );
}
