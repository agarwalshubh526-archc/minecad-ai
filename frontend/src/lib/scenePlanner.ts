import { parsePromptLocal } from '@/lib/promptParser';
import { DESIGN_LABELS } from '@/lib/sceneModel';

export interface PlannedObject {
  object_type: string;
  params: Record<string, unknown>;
}

export interface ScenePlan {
  action: 'replace' | 'add';
  objects: PlannedObject[];
  unsupported: string[];
  assumptions: string[];
  interpretation: string;
}

const TYPES: Array<[string, RegExp]> = [
  ['open_pit', /\b(?:open\s+pit|pit\s+mine|quarry|pit\s+design|irregular\s+pit)\b/gi],
  ['room_and_pillar', /\b(?:room\s*(?:and|&)\s*pillar|bord\s*(?:and|&)\s*pillar)\b/gi],
  ['ventilation', /\b(?:ventilation|airway\s+network|vent\s+network)\b/gi],
  ['conveyor', /\b(?:conveyor|belt\s+system)\b/gi],
  ['blast_pattern', /\b(?:blast\s+pattern|blasting\s+pattern|drill\s+hole\s+pattern)\b/gi],
  ['decline', /\b(?:decline|access\s+ramp|portal\s+tunnel)\b/gi],
  ['mine_survey_traverse', /\b(?:survey\s+traverse|control\s+loop)\b/gi],
  ['topographic_contours', /\b(?:topographic\s+contours|contour\s+map)\b/gi],
  ['borehole_lithology', /\b(?:borehole\s+(?:section|lithology)|drillhole\s+section)\b/gi],
  ['longwall_panel', /\b(?:longwall\s+panel|longwall)\b/gi],
  ['cut_fill_volume', /\b(?:cut\s*(?:and|&)\s*fill|earthwork\s+section)\b/gi],
];

const UNSUPPORTED: Array<[string, RegExp]> = [
  ['tailings dam', /\b(?:tailings\s+(?:dam|storage|facility)|tsf)\b/i],
  ['orebody or grade blocks', /\b(?:ore\s*body|orebody|grade\s+blocks?|block\s+model)\b/i],
  ['vertical shaft', /\b(?:(?:vertical|access|production)\s+shaft|shaft\b(?!\s+diameter))/i],
  ['waste dump', /\b(?:waste\s+(?:dump|rock\s+dump)|spoil\s+dump)\b/i],
  ['stockpile', /\bstockpile\b/i],
  ['stope', /\bstopes?\b/i],
  ['crusher or processing plant', /\b(?:crusher|processing\s+plant|mill\s+plant)\b/i],
  ['dewatering system', /\b(?:dewatering|pump\s+station)\b/i],
  ['measured terrain surface', /\b(?:surveyed\s+terrain|real\s+terrain|measured\s+terrain|site\s+topography)\b/i],
];

export function planSceneLocal(prompt: string): ScenePlan {
  const text = prompt.trim();
  const unsupported = UNSUPPORTED.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const hits: Array<{ type: string; start: number; end: number }> = [];
  for (const [type, pattern] of TYPES) {
    for (const match of text.matchAll(pattern)) hits.push({ type, start: match.index, end: match.index + match[0].length });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const unique = hits.filter((hit, index) => {
    if (hits.slice(0, index).some(previous => previous.type === hit.type || (hit.start >= previous.start && hit.end <= previous.end))) return false;
    if (hit.type === 'open_pit' && hits.some(other => other.type !== 'open_pit' && other.start < hit.start) &&
      /\b(?:for|in|at|to)\s+(?:(?:a|the)\s+)?$/i.test(text.slice(Math.max(0, hit.start - 16), hit.start))) return false;
    return true;
  });
  const boundaries = unique.slice(1).map((hit, index) => {
    const previous = unique[index];
    const gap = text.slice(previous.end, hit.start);
    const separators = [...gap.matchAll(/(?:\b(?:and|plus|with)\b|,)\s*/gi)];
    const last = separators.at(-1);
    return last ? previous.end + last.index + last[0].length : hit.start;
  });
  const objects = unique.map((hit, index) => {
    const phrase = text.slice(index === 0 ? 0 : boundaries[index - 1], boundaries[index] ?? text.length);
    return { object_type: hit.type, params: parsePromptLocal(phrase).params };
  });
  const action = /^(?:create|design|generate|make|start|new|replace)\b/i.test(text) ? 'replace' : 'add';
  const assumptions: string[] = [];
  if (objects.some(o => Object.keys(o.params).length === 0)) assumptions.push('Unspecified dimensions use template defaults.');
  if (objects.length > 1) assumptions.push('Components are placed side by side; connections and clashes are not validated.');
  return {
    action, objects, unsupported, assumptions,
    interpretation: objects.length ? objects.map(o => DESIGN_LABELS[o.object_type]).join(' + ') : 'No supported design component identified',
  };
}
