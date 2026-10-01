import type { CadPrimitive, GeometryData, Point2D, ProjectFile, SceneObject } from '@/types';
import { generateGeometry } from '@/lib/geometryEngine';

export const DESIGN_LABELS: Record<string, string> = {
  open_pit: 'Open pit', room_and_pillar: 'Room and pillar', ventilation: 'Ventilation network',
  conveyor: 'Conveyor', blast_pattern: 'Blast pattern', decline: 'Decline',
  mine_survey_traverse: 'Survey traverse', topographic_contours: 'Topographic contours',
  borehole_lithology: 'Borehole section', longwall_panel: 'Longwall panel',
  cut_fill_volume: 'Cut and fill',
};

const movePoint = (p: Point2D, origin: Point2D): Point2D => ({ x: p.x + origin.x, y: p.y + origin.y });

function movePrimitive(p: CadPrimitive, origin: Point2D): CadPrimitive {
  switch (p.type) {
    case 'line': return { ...p, x1: p.x1 + origin.x, y1: p.y1 + origin.y, x2: p.x2 + origin.x, y2: p.y2 + origin.y };
    case 'dimension': return { ...p, x1: p.x1 + origin.x, y1: p.y1 + origin.y, x2: p.x2 + origin.x, y2: p.y2 + origin.y };
    case 'polyline': return { ...p, points: p.points.map(point => movePoint(point, origin)) };
    case 'hatch': return { ...p, points: p.points.map(point => movePoint(point, origin)) };
    case 'circle': return { ...p, cx: p.cx + origin.x, cy: p.cy + origin.y };
    case 'arc': return { ...p, cx: p.cx + origin.x, cy: p.cy + origin.y };
    case 'text': return { ...p, x: p.x + origin.x, y: p.y + origin.y };
  }
}

export function createSceneObject(objectType: string, params: Record<string, unknown>, origin: Point2D = { x: 0, y: 0 }): SceneObject {
  const geometry = generateGeometry(objectType, params);
  return {
    id: crypto.randomUUID(), name: DESIGN_LABELS[objectType] ?? objectType,
    object_type: objectType, params: { ...geometry.properties }, origin, geometry,
  };
}

export function sceneFromProject(project: ProjectFile | null): SceneObject[] {
  if (!project) return [];
  if (project.scene) return project.scene;
  if (!project.geometry) return [];
  return [{
    id: `${project.id}-design`, name: DESIGN_LABELS[project.object_type] ?? project.name,
    object_type: project.object_type, params: project.properties,
    origin: { x: 0, y: 0 }, geometry: project.geometry,
  }];
}

export function objectBounds(object: SceneObject) {
  const b = object.geometry.bounds;
  return {
    minX: b.minX + object.origin.x, minY: b.minY + object.origin.y,
    maxX: b.maxX + object.origin.x, maxY: b.maxY + object.origin.y,
  };
}

export function nextObjectOrigin(scene: SceneObject[], geometry: GeometryData): Point2D {
  if (!scene.length) return { x: 0, y: 0 };
  const right = Math.max(...scene.map(item => objectBounds(item).maxX));
  const bottom = Math.min(...scene.map(item => objectBounds(item).minY));
  return { x: right + 40 - geometry.bounds.minX, y: bottom - geometry.bounds.minY };
}

export function combineScene(scene: SceneObject[]): GeometryData {
  if (!scene.length) return {
    primitives: [], meshes: [], layers: [], properties: { name: 'Empty mine layout', object_count: 0 },
    bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
  };
  const layerMap = new Map<string, GeometryData['layers'][number]>();
  const primitives: CadPrimitive[] = [];
  const meshes: GeometryData['meshes'] = [];
  for (const object of scene) {
    for (const p of object.geometry.primitives) primitives.push({ ...movePrimitive(p, object.origin), objectId: object.id });
    for (const m of object.geometry.meshes) meshes.push({ ...m, objectId: object.id,
      vertices: m.vertices.map(v => [v[0] + object.origin.x, v[1] + object.origin.y, v[2]]) });
    for (const layer of object.geometry.layers) layerMap.set(layer.name, layer);
  }
  const bounds = scene.map(objectBounds);
  return {
    primitives, meshes, layers: [...layerMap.values()],
    properties: scene.length === 1 ? { ...scene[0].geometry.properties, object_count: 1 }
      : { name: 'Mine layout', object_count: scene.length },
    bounds: {
      minX: Math.min(...bounds.map(b => b.minX)), minY: Math.min(...bounds.map(b => b.minY)),
      maxX: Math.max(...bounds.map(b => b.maxX)), maxY: Math.max(...bounds.map(b => b.maxY)),
    },
  };
}
