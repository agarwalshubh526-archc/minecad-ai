// MineCAD AI — Shared TypeScript Interfaces

// ─── CAD Primitives ──────────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export interface CadLine {
  type: 'line';
  x1: number; y1: number;
  x2: number; y2: number;
  layer: string;
  color: number;
}

export interface CadPolyline {
  type: 'polyline';
  points: Point2D[];
  closed: boolean;
  layer: string;
  color: number;
}

export interface CadCircle {
  type: 'circle';
  cx: number; cy: number;
  r: number;
  layer: string;
  color: number;
}

export interface CadArc {
  type: 'arc';
  cx: number; cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  layer: string;
  color: number;
}

export interface CadDimension {
  type: 'dimension';
  x1: number; y1: number;
  x2: number; y2: number;
  text: string;
  layer: string;
  color: number;
}

export interface CadText {
  type: 'text';
  x: number; y: number;
  text: string;
  height: number;
  layer: string;
  color: number;
}

export interface CadHatch {
  type: 'hatch';
  points: Point2D[];
  pattern: string;
  layer: string;
  color: number;
}

export type CadPrimitive = CadLine | CadPolyline | CadCircle | CadArc | CadDimension | CadText | CadHatch;

// ─── 3D Meshes ───────────────────────────────────────────────────────────────

export interface MeshData {
  type: 'mesh';
  vertices: number[][];
  indices: number[][];
  color: string;
  name: string;
  /** Optional CAD layer name — the 3D viewport uses it for rendering
   *  semantics (e.g. 'ROOF' renders translucent). Exporters ignore it. */
  layer?: string;
}

// ─── Layers ──────────────────────────────────────────────────────────────────

export interface LayerInfo {
  name: string;
  color: number;
  description: string;
  visible: boolean;
  locked: boolean;
}

// ─── Geometry Output ─────────────────────────────────────────────────────────

export interface GeometryBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GeometryData {
  primitives: CadPrimitive[];
  meshes: MeshData[];
  layers: { name: string; color: number; description: string }[];
  properties: Record<string, unknown>;
  bounds: GeometryBounds;
}

// ─── API Models ──────────────────────────────────────────────────────────────

export interface GenerateResponse {
  success: boolean;
  object_type: string;
  params: Record<string, unknown>;
  geometry: GeometryData;
  parse_method: string;
  /** v2 parser: human-readable "Understood: …" summary */
  interpretation?: string;
  /** v2 parser: unit conversions and carried secondary features */
  notes?: string[];
  error: string;
}

// ─── Project State ───────────────────────────────────────────────────────────

export interface ProjectFile {
  id: string;
  name: string;
  object_type: string;
  created_at: string;
  geometry: GeometryData | null;
  properties: Record<string, unknown>;
}

export interface AIConfig {
  provider: 'local' | 'deepseek';
  model: string;
  baseUrl: string;
  apiKey: string;
}

export interface AppState {
  activeView: '2d' | '3d';
  selectedProject: ProjectFile | null;
  projects: ProjectFile[];
  geometry: GeometryData | null;
  layers: LayerInfo[];
  aiConfig: AIConfig;
  isGenerating: boolean;
  viewMode3D: 'solid' | 'wireframe';
  showSectionView: boolean;
  sectionHeight: number;
  commandHistory: string[];
}

// ─── Template Definitions ────────────────────────────────────────────────────

export interface MineTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;
  object_type: string;
  defaultParams: Record<string, unknown>;
  description: string;
}

// ─── DXF Color Map ───────────────────────────────────────────────────────────

export const DXF_COLORS: Record<number, string> = {
  1: '#FF0000',
  2: '#FFFF00',
  3: '#00FF00',
  4: '#00FFFF',
  5: '#0066FF',
  6: '#FF00FF',
  7: '#FFFFFF',
  8: '#808080',
};

export function dxfColor(colorIndex: number): string {
  return DXF_COLORS[colorIndex] || '#FFFFFF';
}
