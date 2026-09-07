// MineCAD AI — Client-side natural-language parser (v2, parity with backend/parser.py)
// Units-aware values (ft→m), mining-term synonyms, multi-step prompts, relative
// adjectives (deeper/wider/steeper/bigger/more benches) and a human-readable
// interpretation string for the confirmation toast.

export interface ParsedPrompt {
  object_type: string | null;
  params: Record<string, number>;
  features: string[];
  notes: string[];
  interpretation: string;
}

const FT_TO_M = 0.3048;

// Capturing unit groups so ft→m conversion can see the unit
const LENU = '(metres?|meters?|feet|foot|ft|m)?';
const ANGU = '(°|degrees?)?';
const PCTU = '(%|percent)?';

const TYPE_PATTERNS: [RegExp, string][] = [
  [/survey|traverse|station|boundary|lease|control\s*loop/i, 'mine_survey_traverse'],
  [/contour|topo(?:graphy|graphic)?|elevation\s*map|dtm|surface\s*grid/i, 'topographic_contours'],
  [/borehole|drill\s*hole|drillhole|stratigraphy|coal\s*seam|lithology|core/i, 'borehole_lithology'],
  [/longwall|shearer|headgate|tailgate|chocks/i, 'longwall_panel'],
  [/cut\s*(?:and|&)?\s*fill|earthwork|volume|volumetric|stripping\s*ratio/i, 'cut_fill_volume'],
  // "blast" beats the generic open_pit context words (quarry/pit): a prompt
  // like "blast pattern for a quarry" is a blast design, not a pit design.
  [/blast/i, 'blast_pattern'],
  [/open\s*(?:pit|cast|cut)|quarry|pit\s*mine|surface\s*mine/i, 'open_pit'],
  [/room\s*(?:and|&)\s*pillar|bord\s*(?:and|&)\s*pillar/i, 'room_and_pillar'],
  [/ventilation|vent\s*network|airway|airflow/i, 'ventilation'],
  [/conveyor|belt\s*system/i, 'conveyor'],
  [/decline|ramp\s*access|portal|shaft|tunnel/i, 'decline'],
  [/haul\s*road/i, 'open_pit'],
];

const TYPE_LABELS: Record<string, string> = {
  open_pit: 'open pit',
  room_and_pillar: 'room & pillar mine',
  ventilation: 'ventilation network',
  conveyor: 'conveyor route',
  blast_pattern: 'blast pattern',
  decline: 'decline access',
  mine_survey_traverse: 'survey traverse',
  topographic_contours: 'topographic contours',
  borehole_lithology: 'borehole section',
  longwall_panel: 'longwall panel',
  cut_fill_volume: 'cut & fill section',
};

const NUM = '(\\d+\\.?\\d*)';
const PARAM_PATTERNS: [RegExp, string][] = [
  [new RegExp(`${NUM}\\s*${LENU}\\s*bench\\s*heights?`, 'i'), 'bench_height'],
  [new RegExp(`bench\\s*heights?\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'bench_height'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*bench\\s*widths?`, 'i'), 'bench_width'],
  [new RegExp(`bench\\s*widths?\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'bench_width'],
  [/(\d+)\s*bench(?:es)?/i, 'num_benches'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*haul\\s*road`, 'i'), 'haul_road_width'],
  [new RegExp(`haul\\s*road\\s*(?:width\\s*)?(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'haul_road_width'],
  [new RegExp(`${NUM}\\s*${ANGU}\\s*(?:overall\\s*)?slope`, 'i'), 'overall_slope'],
  [new RegExp(`overall\\s*slope\\s*(?:of\\s*)?${NUM}\\s*${ANGU}`, 'i'), 'overall_slope'],
  [new RegExp(`slope\\s*angle\\s*(?:of\\s*)?${NUM}\\s*${ANGU}`, 'i'), 'overall_slope'],
  [new RegExp(`${NUM}\\s*${ANGU}\\s*batter`, 'i'), 'batter_angle'],
  [new RegExp(`batter\\s*(?:angle\\s*)?(?:of\\s*)?${NUM}\\s*${ANGU}`, 'i'), 'batter_angle'],
  [new RegExp(`pit\\s*(?:length|long)\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'pit_length'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*(?:pit\\s*)?length`, 'i'), 'pit_length'],
  [new RegExp(`pit\\s*width\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'pit_width'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*(?:pit\\s*)?width`, 'i'), 'pit_width'],
  // Generic "N m high/deep" — resolved per object type in post-processing
  [new RegExp(`${NUM}\\s*${LENU}\\s*high\\b`, 'i'), '_high'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*deep\\b`, 'i'), '_deep'],
  // Room and pillar
  [new RegExp(`room\\s*width\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'room_width'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*room\\s*width`, 'i'), 'room_width'],
  [new RegExp(`pillar\\s*(?:width|size)\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'pillar_width'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*pillar`, 'i'), 'pillar_width'],
  [/(\d+)\s*rooms?\s*(?:x|by|×)/i, 'num_rooms_x'],
  [/(?:x|by|×)\s*(\d+)\s*rooms?/i, 'num_rooms_y'],
  // Conveyor
  [new RegExp(`conveyor\\s*(?:length\\s*)?(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'length'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*(?:long\\s*)?conveyor`, 'i'), 'length'],
  [new RegExp(`belt\\s*(?:width\\s*)?(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'width'],
  [new RegExp(`inclin(?:ation|e)\\s*(?:of\\s*)?${NUM}\\s*${ANGU}`, 'i'), 'inclination'],
  [new RegExp(`${NUM}\\s*${ANGU}\\s*incline`, 'i'), 'inclination'],
  // Blast
  [new RegExp(`burden\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'burden'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*burden`, 'i'), 'burden'],
  [new RegExp(`spacing\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'spacing'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*spacing`, 'i'), 'spacing'],
  [new RegExp(`hole\\s*depth\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'hole_depth'],
  [new RegExp(`${NUM}\\s*${LENU}\\s*hole`, 'i'), 'hole_diameter'],
  [new RegExp(`hole\\s*diam(?:eter)?\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'hole_diameter'],
  [/(\d+)\s*rows?/i, 'num_rows'],
  [/(\d+)\s*holes?\s*per\s*row/i, 'num_holes_per_row'],
  // Decline
  [new RegExp(`gradient\\s*(?:of\\s*)?${NUM}\\s*${PCTU}`, 'i'), 'gradient'],
  [new RegExp(`${NUM}\\s*${PCTU}\\s*gradient`, 'i'), 'gradient'],
  [/(\d+)\s*levels?/i, 'num_levels'],
  [new RegExp(`level\\s*spacing\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'level_spacing'],
  // Ventilation / traverse / contours / boreholes / longwall
  [/(\d+)\s*airways?/i, 'num_airways'],
  [new RegExp(`airway\\s*length\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'airway_length'],
  [new RegExp(`shaft\\s*diam(?:eter)?\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'shaft_diameter'],
  [/(\d+)\s*stations?/i, 'num_stations'],
  [/(\d+)\s*boreholes?/i, 'num_boreholes'],
  [new RegExp(`contour\\s*interval\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'contour_interval'],
  [new RegExp(`face\\s*width\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'face_width'],
  [new RegExp(`panel\\s*length\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'panel_length'],
  [/(\d+)\s*supports?/i, 'num_supports'],
  [new RegExp(`seam\\s*(?:height|thickness)\\s*(?:of\\s*)?${NUM}\\s*${LENU}`, 'i'), 'seam_height'],
  [new RegExp(`coal\\s*seam\\s*(?:at\\s*)?${NUM}\\s*${LENU}\\s*deep`, 'i'), 'coal_seam_depth'],
  [new RegExp(`seam\\s*dip\\s*(?:of\\s*)?${NUM}`, 'i'), 'dip_angle'],
];

const INT_PARAMS = new Set([
  'num_benches', 'num_rooms_x', 'num_rooms_y', 'num_rows',
  'num_holes_per_row', 'num_levels', 'num_airways', 'num_stations',
  'num_boreholes', 'num_supports',
]);

const SECONDARY_SPLIT_RE = /\s+(?:and|then|plus)\s+(?:add|include|attach)\s+|\s+with\s+a(?:n)?\s+(?!\d)/i;

const SECONDARY_FEATURES: [RegExp, string, string][] = [
  [/haul\s*road/i, 'haul_road', 'haul road (included in the pit design)'],
  [/vent|airway|fan/i, 'ventilation', 'ventilation shaft/raise (noted — model it with the ventilation tool)'],
  [/decline|ramp|portal|tunnel/i, 'decline', 'decline/ramp access (noted — use the decline generator)'],
  [/berm/i, 'berm', 'berms (included in the bench design)'],
  [/drain|sump|pump/i, 'drainage', 'drainage/sump (noted, not modelled)'],
  [/stockpile|dump|heap/i, 'stockpile', 'waste dump/stockpile (noted, not modelled)'],
  [/crusher|screen|plant|mill|washer/i, 'plant', 'processing plant (noted, not modelled)'],
  [/fence|gate|road\s*around|perimeter/i, 'perimeter', 'perimeter road/fence (noted, not modelled)'],
];

function unitToM(value: number, unit: string | undefined, notes: string[], key: string): number {
  if (unit && /^(ft|feet|foot)$/i.test(unit)) {
    const converted = Math.round(value * FT_TO_M * 100) / 100;
    notes.push(`${value} ft → ${converted} m (${key.replace(/^_+/, '').replace(/_/g, ' ')})`);
    return converted;
  }
  return value;
}

function detectType(text: string): string | null {
  for (const [re, type] of TYPE_PATTERNS) {
    if (re.test(text)) return type;
  }
  return null;
}

function splitSecondary(text: string): [string, string] {
  const m = SECONDARY_SPLIT_RE.exec(text);
  if (m) return [text.slice(0, m.index), text.slice(m.index + m[0].length)];
  return [text, ''];
}

function parseSecondary(secondary: string, notes: string[]): string[] {
  const applied: string[] = [];
  for (const [re, key, note] of SECONDARY_FEATURES) {
    if (re.test(secondary)) {
      if (!notes.includes(note)) notes.push(note);
      applied.push(key);
    }
  }
  return applied;
}

function resolveGenericMeasure(params: Record<string, number>, objectType: string, notes: string[]): void {
  const high = params._high;
  const deep = params._deep;
  delete params._high;
  delete params._deep;
  if (high !== undefined && objectType === 'open_pit') {
    params.bench_height = high;
  }
  if (deep === undefined) return;
  if (objectType === 'open_pit') {
    const benchH = params.bench_height || 10;
    params.num_benches = Math.max(1, Math.round(deep / benchH));
    notes.push(`${deep} m deep ≈ ${params.num_benches} benches of ${benchH} m`);
  } else if (objectType === 'cut_fill_volume') {
    params.pit_depth = deep;
  } else if (objectType === 'borehole_lithology') {
    params.depth = deep;
  } else if (objectType === 'decline') {
    const gradient = params.gradient || 10;
    params.total_length = Math.round(deep / (gradient / 100));
    notes.push(`${deep} m deep ≈ ${params.total_length} m decline at ${gradient}%`);
  } else {
    params.depth = deep;
  }
}

export function buildInterpretation(
  objectType: string,
  params: Record<string, unknown>,
  notes: string[] = [],
): string {
  const p = params;
  const label = TYPE_LABELS[objectType] ?? objectType.replace(/_/g, ' ');
  const parts: string[] = [];
  const n = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);

  if (objectType === 'open_pit') {
    if (p.num_benches !== undefined || p.bench_height !== undefined) {
      const nb = n(p.num_benches, 5);
      parts.push(`${nb} bench${nb === 1 ? '' : 'es'} × ${n(p.bench_height, 10)} m`);
    }
    if (p.batter_angle !== undefined) parts.push(`batter ${p.batter_angle}°`);
    if (p.overall_slope !== undefined) parts.push(`overall slope ${p.overall_slope}°`);
    if (p.haul_road_width !== undefined) parts.push(`haul road ${p.haul_road_width} m`);
    if (p.pit_length !== undefined || p.pit_width !== undefined) {
      parts.push(`${p.pit_length ?? '—'} × ${p.pit_width ?? '—'} m`);
    }
  } else if (objectType === 'room_and_pillar') {
    if (p.room_width !== undefined || p.pillar_width !== undefined) {
      parts.push(`rooms ${p.room_width ?? 6} m, pillars ${p.pillar_width ?? 8} m`);
    }
    if (p.num_rooms_x !== undefined || p.num_rooms_y !== undefined) {
      parts.push(`${p.num_rooms_x ?? 5} × ${p.num_rooms_y ?? 4} rooms`);
    }
  } else if (objectType === 'blast_pattern') {
    if (p.burden !== undefined || p.spacing !== undefined) {
      parts.push(`burden ${p.burden ?? 4} m, spacing ${p.spacing ?? 5} m`);
    }
    if (p.num_rows !== undefined || p.num_holes_per_row !== undefined) {
      parts.push(`${p.num_rows ?? 4} rows × ${p.num_holes_per_row ?? 8} holes`);
    }
  } else if (objectType === 'decline') {
    if (p.gradient !== undefined) {
      parts.push(p.gradient ? `gradient ${p.gradient}% (1 : ${Math.round(100 / Number(p.gradient))})` : 'gradient 0%');
    }
    if (p.num_levels !== undefined) parts.push(`${p.num_levels} levels`);
  } else {
    let shown = 0;
    for (const [k, v] of Object.entries(p)) {
      if (k.startsWith('_') || k === 'name') continue;
      if (typeof v === 'number' && shown < 4) {
        parts.push(`${k.replace(/_/g, ' ')} ${v}`);
        shown += 1;
      }
    }
  }

  const base = parts.length ? `${label} — ${parts.join(', ')}` : `${label} (defaults)`;
  return notes.length ? `${base}  ·  ${notes.join('; ')}` : base;
}

export function parsePromptLocal(prompt: string): ParsedPrompt {
  const text = prompt.toLowerCase().trim();
  const notes: string[] = [];

  const [primary, secondary] = splitSecondary(text);
  const objectType = detectType(primary) ?? detectType(text) ?? 'open_pit';

  const params: Record<string, number> = {};
  for (const [re, key] of PARAM_PATTERNS) {
    const m = text.match(re);
    if (m) {
      let value = parseFloat(m[1]);
      const unit = m[2] || undefined;
      if (INT_PARAMS.has(key)) {
        value = Math.trunc(value);
      } else {
        value = unitToM(value, unit, notes, key);
      }
      params[key] = value;
    }
  }

  resolveGenericMeasure(params, objectType, notes);
  const features = secondary ? parseSecondary(secondary, notes) : [];

  return {
    object_type: objectType,
    params,
    features,
    notes,
    interpretation: buildInterpretation(objectType, params, notes),
  };
}

// ─── Edit commands ───────────────────────────────────────────────────────────

const FIELD_MAP: Record<string, string> = {
  'bench height': 'bench_height',
  'bench width': 'bench_width',
  'haul road width': 'haul_road_width',
  'haul road': 'haul_road_width',
  slope: 'overall_slope',
  'slope angle': 'overall_slope',
  burden: 'burden',
  spacing: 'spacing',
  'room width': 'room_width',
  'pillar width': 'pillar_width',
};

const ADD_FIELD_MAP: Record<string, string> = {
  bench: 'num_benches',
  level: 'num_levels',
  row: 'num_rows',
  airway: 'num_airways',
  room: 'num_rooms_x',
};

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function relativeEdit(text: string, props: Record<string, unknown>): Record<string, unknown> | null {
  const objType = String(props._object_type ?? 'open_pit');
  const updated: Record<string, unknown> = { ...props };
  let changed = false;

  const scale = (param: string, factor: number, lo = 0.1, hi = 100000) => {
    const cur = updated[param];
    if (isNum(cur)) {
      updated[param] = Math.round(Math.min(hi, Math.max(lo, cur * factor)) * 100) / 100;
      changed = true;
    }
  };
  const step = (param: string, delta: number, lo: number, hi: number) => {
    const cur = updated[param];
    if (isNum(cur)) {
      updated[param] = Math.round(Math.min(hi, Math.max(lo, cur + delta)) * 100) / 100;
      changed = true;
    }
  };

  if (/\bdeeper\b/.test(text)) {
    if (objType === 'open_pit') {
      const nb = isNum(updated.num_benches) ? updated.num_benches : 5;
      step('num_benches', Math.max(1, Math.round(nb * 0.25)), 1, 500);
    } else {
      for (const cand of ['pit_depth', 'depth', 'total_length']) {
        if (cand in updated) { scale(cand, 1.25); break; }
      }
    }
  }
  if (/\bshallower\b/.test(text)) {
    if (objType === 'open_pit') {
      const nb = isNum(updated.num_benches) ? updated.num_benches : 5;
      step('num_benches', -Math.max(1, Math.round(nb * 0.2)), 1, 500);
    } else {
      for (const cand of ['pit_depth', 'depth', 'total_length']) {
        if (cand in updated) { scale(cand, 0.8); break; }
      }
    }
  }

  if (/\bwider\b/.test(text)) {
    for (const cand of ['pit_width', 'width', 'surface_width']) {
      if (cand in updated) { scale(cand, 1.25); break; }
    }
  }
  if (/\bnarrower\b/.test(text)) {
    for (const cand of ['pit_width', 'width', 'surface_width']) {
      if (cand in updated) { scale(cand, 0.8); break; }
    }
  }
  if (/\bbigger\b/.test(text)) {
    scale('pit_length', 1.25);
    scale('pit_width', 1.25);
    if (!('pit_length' in props) && !('pit_width' in props)) scale('length', 1.25);
  }
  if (/\bsmaller\b/.test(text)) {
    scale('pit_length', 0.8);
    scale('pit_width', 0.8);
    if (!('pit_length' in props) && !('pit_width' in props)) scale('length', 0.8);
  }

  // Steepness: batter angle measured from vertical → larger = steeper
  if (/\bsteeper\b/.test(text)) {
    step('batter_angle', 5, 45, 87);
    step('overall_slope', 3, 20, 65);
  }
  if (/\b(?:gentler|flatter)\b/.test(text)) {
    step('batter_angle', -5, 45, 87);
    step('overall_slope', -3, 20, 65);
  }

  const moreM = text.match(/more\s+(benches|levels|rows|airways|rooms)/);
  const fewerM = text.match(/(?:fewer|less)\s+(benches|levels|rows|airways|rooms)/);
  if (moreM || fewerM) {
    const item = (moreM ?? fewerM)![1];
    const singular = item === 'benches' ? 'bench' : item.slice(0, -1);
    const paramKey = ADD_FIELD_MAP[singular];
    const cur = paramKey ? updated[paramKey] : undefined;
    if (paramKey && isNum(cur)) {
      const delta = moreM ? 2 : -2;
      updated[paramKey] = Math.max(1, Math.trunc(cur) + delta);
      changed = true;
    }
  }

  return changed ? updated : null;
}

const EDIT_PATTERNS: [RegExp, string][] = [
  [/(?:increase|raise|grow)\s+(bench\s*(?:height|width)|haul\s*road\s*(?:width)?|slope|burden|spacing|room\s*width|pillar\s*width)\s*(to|by)?\s*(\d+\.?\d*)/i, 'increase'],
  [/(?:decrease|reduce|lower|shrink)\s+(bench\s*(?:height|width)|haul\s*road\s*(?:width)?|slope|burden|spacing|room\s*width|pillar\s*width)\s*(to|by)?\s*(\d+\.?\d*)/i, 'decrease'],
  [/(?:set|change|make)\s+(bench\s*(?:height|width)|haul\s*road\s*(?:width)?|slope|burden|spacing)\s*(to|=)?\s*(\d+\.?\d*)/i, 'set'],
  [/add\s+(?:another|a|one|more)\s+(bench|level|row|airway|room)/i, 'add'],
  [/remove\s+(?:a|one|last)\s+(bench|level|row|airway|room)/i, 'remove'],
];

export function parseEditCommand(
  prompt: string,
  currentProperties: Record<string, unknown>,
): Record<string, unknown> | null {
  const text = prompt.toLowerCase().trim();

  const relative = relativeEdit(text, currentProperties);
  if (relative !== null) return relative;

  for (const [re, action] of EDIT_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;

    if (action === 'increase' || action === 'decrease' || action === 'set') {
      const fieldName = m[1].trim();
      const prep = (m[2] || '').trim();
      const value = parseFloat(m[3]);
      const paramKey = FIELD_MAP[fieldName];
      if (!paramKey) continue;
      const current = currentProperties[paramKey];
      let newVal = value;
      if (prep === 'by' && isNum(current)) {
        newVal = action === 'increase' ? current + value : current - value;
      }
      return { ...currentProperties, [paramKey]: newVal };
    }

    if (action === 'add' || action === 'remove') {
      const item = m[1].trim();
      const paramKey = ADD_FIELD_MAP[item];
      const cur = paramKey ? currentProperties[paramKey] : undefined;
      if (paramKey && isNum(cur)) {
        const next = action === 'add' ? cur + 1 : Math.max(1, cur - 1);
        return { ...currentProperties, [paramKey]: next };
      }
    }
  }

  return null;
}
