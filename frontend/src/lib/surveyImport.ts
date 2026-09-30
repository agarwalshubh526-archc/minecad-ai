import type { GeometryData, ProjectFile } from '@/types';

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      cells.push(cell.trim()); cell = '';
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

export function importSurveyCsv(csv: string, filename: string): ProjectFile {
  const rows = csv.replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (rows.length < 3 || rows.length > 501) throw new Error('Survey CSV needs 2–500 stations.');
  const headers = csvCells(rows[0]).map(h => h.toLowerCase());
  const column = (names: string[]) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;
  const idCol = column(['station', 'id', 'point']);
  const eCol = column(['easting', 'x']);
  const nCol = column(['northing', 'y']);
  const zCol = column(['elevation', 'z', 'height']);
  if (eCol < 0 || nCol < 0 || zCol < 0) throw new Error('CSV headers must include easting, northing, and elevation (or x, y, z).');
  const stations = rows.slice(1).map((line, index) => {
    const cells = csvCells(line);
    const easting = Number(cells[eCol]);
    const northing = Number(cells[nCol]);
    const elevation = Number(cells[zCol]);
    if (![easting, northing, elevation].every(Number.isFinite)) throw new Error(`Invalid coordinate on CSV row ${index + 2}.`);
    return { station: idCol >= 0 ? cells[idCol] || `STN-${index + 1}` : `STN-${index + 1}`, easting, northing, elevation, code: 'IMPORTED' };
  });
  const xs = stations.map(s => s.easting), ys = stations.map(s => s.northing);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  const radius = Math.max(0.2, Math.min(span / 300, 5));
  const geometry: GeometryData = {
    primitives: [
      { type: 'polyline', points: stations.map(s => ({ x: s.easting, y: s.northing })), closed: false, layer: 'TRAVERSE-LINES', color: 4 },
      ...stations.flatMap(s => [
        { type: 'circle' as const, cx: s.easting, cy: s.northing, r: radius, layer: 'SURVEY-STATIONS', color: 1 },
        { type: 'text' as const, x: s.easting + radius * 1.5, y: s.northing + radius, text: s.station, height: radius * 1.5, layer: 'TEXT', color: 7 },
      ]),
    ],
    meshes: [],
    layers: [
      { name: 'TRAVERSE-LINES', color: 4, description: 'Imported station sequence' },
      { name: 'SURVEY-STATIONS', color: 1, description: 'Imported survey points' },
      { name: 'TEXT', color: 7, description: 'Station labels' },
    ],
    properties: { name: filename, num_stations: stations.length, survey_stations: stations, data_source: 'Imported CSV; coordinates and datum not independently verified', _object_type: 'mine_survey_traverse' },
    bounds: { minX: Math.min(...xs) - span * 0.05, minY: Math.min(...ys) - span * 0.05, maxX: Math.max(...xs) + span * 0.05, maxY: Math.max(...ys) + span * 0.05 },
  };
  return { id: crypto.randomUUID(), name: filename.replace(/\.csv$/i, '').slice(0, 120), object_type: 'mine_survey_traverse', created_at: new Date().toISOString(), geometry, properties: geometry.properties };
}
