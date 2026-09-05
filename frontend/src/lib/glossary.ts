// MineCAD AI — plain-English glossary of mining/CAD terms for students
// Keys match the parameter names used by the generators in geometryEngine.ts

export interface GlossaryEntry {
  term: string;
  definition: string;
  typical: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  bench_height: {
    term: 'Bench height',
    definition: 'The vertical height of one step (bench) of the pit. Like stairs for trucks — each bench is one "step" of the open pit.',
    typical: '5–15 m (must match your excavator reach)',
  },
  bench_width: {
    term: 'Bench width',
    definition: 'The horizontal flat strip you stand a drill or truck on, between the toe of the wall above and the crest of the wall below.',
    typical: '8–15 m',
  },
  num_benches: {
    term: 'Number of benches',
    definition: 'How many steps the pit has from the surface down to the pit floor. Total pit depth = benches × bench height.',
    typical: '3–10 for a starter pit',
  },
  batter_angle: {
    term: 'Batter angle',
    definition: 'The slope (from vertical) of a single bench wall. Steeper batter = less waste to dig, but higher rockfall risk.',
    typical: '60–80° in hard rock',
  },
  overall_slope: {
    term: 'Overall slope angle',
    definition: 'The average slope of the whole pit wall from crest to toe, including the benches and berms. This is what governs overall wall stability.',
    typical: '35–55°',
  },
  berm_width: {
    term: 'Berm width',
    definition: 'A safety shelf left on each bench to catch falling rocks and give trucks room. Wider berms are safer but flatten the overall slope.',
    typical: '5–10 m',
  },
  haul_road_width: {
    term: 'Haul road width',
    definition: 'Width of the road trucks drive down into the pit. Must fit the widest truck plus a safety margin, usually 3–4× truck width.',
    typical: '20–30 m for 100-t class trucks',
  },
  pit_length: {
    term: 'Pit length',
    definition: 'How long the open pit is at the surface (along one axis), in metres.',
    typical: '100–1000 m',
  },
  pit_width: {
    term: 'Pit width',
    definition: 'How wide the open pit is at the surface, in metres.',
    typical: '100–600 m',
  },
  room_width: {
    term: 'Room width',
    definition: 'The open gallery (room) miners work in between pillars. Wider rooms extract more coal but leave thinner support.',
    typical: '5–9 m',
  },
  pillar_width: {
    term: 'Pillar width',
    definition: 'The block of unmined rock/coal left between rooms to hold up the roof. The main safety element of room & pillar mining.',
    typical: '6–12 m',
  },
  num_rooms_x: {
    term: 'Rooms across (X)',
    definition: 'Number of rooms along the main (horizontal) direction of the panel.',
    typical: '4–8',
  },
  num_rooms_y: {
    term: 'Rooms deep (Y)',
    definition: 'Number of room rows in the other direction.',
    typical: '3–6',
  },
  room_height: {
    term: 'Seam / room height',
    definition: 'The thickness of the seam being mined — how tall the working space is.',
    typical: '2–4 m',
  },
  entry_width: {
    term: 'Entry width',
    definition: 'Width of the main entry tunnel used to access the rooms, usually wider than the rooms.',
    typical: '4–6 m',
  },
  extraction_ratio: {
    term: 'Extraction ratio',
    definition: 'Percentage of the ore/coal actually recovered — the rest stays behind as pillars. Higher = more profit but more roof-risk.',
    typical: '50–70%',
  },
  num_airways: {
    term: 'Number of airways',
    definition: 'Parallel tunnels carrying ventilation air. Fresh air travels in one set, contaminated air returns in the other.',
    typical: '4–10',
  },
  airway_length: {
    term: 'Airway length',
    definition: 'Length of each ventilation tunnel between the intake and exhaust shafts.',
    typical: '100–2000 m',
  },
  airway_width: {
    term: 'Airway width',
    definition: 'Cross-section width of a ventilation tunnel.',
    typical: '3–6 m',
  },
  shaft_diameter: {
    term: 'Shaft diameter',
    definition: 'Diameter of the vertical shaft from the surface used to move air (and often men/materials) between surface and underground.',
    typical: '4–8 m',
  },
  fan_power: {
    term: 'Fan power',
    definition: 'Power of the main ventilation fan that pushes fresh air through the mine network, in kilowatts.',
    typical: '100–1000 kW',
  },
  length: {
    term: 'Length',
    definition: 'Overall length of the structure along its main axis, in metres.',
    typical: '100–500 m',
  },
  width: {
    term: 'Width',
    definition: 'Cross-section width — belt width for conveyors, tunnel width for declines — in metres.',
    typical: '1–6 m',
  },
  height: {
    term: 'Height',
    definition: 'Cross-section height of the tunnel or opening, in metres.',
    typical: '3–5 m',
  },
  belt_width: {
    term: 'Belt width',
    definition: 'Width of the conveyor belt carrying crushed rock or coal.',
    typical: '0.8–2 m',
  },
  inclination: {
    term: 'Inclination',
    definition: 'Slope angle of the conveyor or route, in degrees. Steeper belts need special designs to stop material rolling back.',
    typical: '0–18°',
  },
  gradient: {
    term: 'Gradient',
    definition: 'How steeply a decline (ramp) descends, usually quoted as a percentage: a 10% gradient drops 10 m for every 100 m travelled.',
    typical: '8–12% (1:8 to 1:10) for trucks',
  },
  start_x: {
    term: 'Start X (easting)',
    definition: 'Map X-coordinate (easting) where the route begins.',
    typical: 'Matches your survey grid',
  },
  start_y: {
    term: 'Start Y (northing)',
    definition: 'Map Y-coordinate (northing) where the route begins.',
    typical: 'Matches your survey grid',
  },
  end_x: {
    term: 'End X (easting)',
    definition: 'Map X-coordinate where the route finishes.',
    typical: 'Matches your survey grid',
  },
  end_y: {
    term: 'End Y (northing)',
    definition: 'Map Y-coordinate where the route finishes.',
    typical: 'Matches your survey grid',
  },
  burden: {
    term: 'Burden',
    definition: 'Distance from a blast hole to the nearest free face (the rock it must break toward). The most critical blasting parameter.',
    typical: '3–8 m',
  },
  spacing: {
    term: 'Spacing',
    definition: 'Distance between adjacent blast holes in the same row. Usually 1.0–1.4× the burden.',
    typical: '4–10 m',
  },
  num_rows: {
    term: 'Number of rows',
    definition: 'How many rows of blast holes sit behind the free face. More rows = larger blast.',
    typical: '3–8',
  },
  num_holes_per_row: {
    term: 'Holes per row',
    definition: 'Blast holes across one row along the face.',
    typical: '5–15',
  },
  hole_diameter: {
    term: 'Hole diameter',
    definition: 'Diameter of the drill hole, in metres. Bigger holes hold more explosive for bigger blasts.',
    typical: '0.09–0.25 m (89–250 mm)',
  },
  hole_depth: {
    term: 'Hole depth',
    definition: 'How deep each blast hole is drilled, in metres.',
    typical: '8–15 m (benched to hole diameter)',
  },
  pattern: {
    term: 'Drill pattern',
    definition: 'Layout of holes: "staggered" offsets alternate rows for more even breakage; "square" lines them up in a grid.',
    typical: 'Staggered for most production blasts',
  },
  total_length: {
    term: 'Total length',
    definition: 'Full length of the decline ramp from portal to its deepest point, measured along the ramp.',
    typical: '300–1500 m',
  },
  num_levels: {
    term: 'Number of levels',
    definition: 'How many horizontal access levels branch off the decline.',
    typical: '3–8',
  },
  level_spacing: {
    term: 'Level spacing',
    definition: 'Vertical distance between successive access levels.',
    typical: '20–50 m',
  },
  num_stations: {
    term: 'Number of stations',
    definition: 'Survey control points around the traverse loop. More stations = better control of the boundary.',
    typical: '4–12',
  },
  starting_easting: {
    term: 'Starting easting',
    definition: 'X-coordinate of the first survey station on the mine grid.',
    typical: 'e.g. 1000 mE',
  },
  starting_northing: {
    term: 'Starting northing',
    definition: 'Y-coordinate of the first survey station on the mine grid.',
    typical: 'e.g. 2000 mN',
  },
  starting_elevation: {
    term: 'Starting elevation',
    definition: 'Height (Z, above datum) of the first survey station.',
    typical: 'e.g. 150 m',
  },
  avg_segment_len: {
    term: 'Average sight length',
    definition: 'Typical distance between two survey stations — how far the total station sees each shot.',
    typical: '50–150 m',
  },
  contour_interval: {
    term: 'Contour interval',
    definition: 'Vertical distance between two neighbouring contour lines. Smaller intervals show more terrain detail.',
    typical: '1–10 m',
  },
  min_elevation: {
    term: 'Minimum elevation (min Z)',
    definition: 'Lowest elevation shown on the contour map.',
    typical: 'Lowest point of your site',
  },
  max_elevation: {
    term: 'Maximum elevation (max Z)',
    definition: 'Highest elevation shown on the contour map.',
    typical: 'Highest point of your site',
  },
  max_z: {
    term: 'Maximum elevation (max Z)',
    definition: 'Highest elevation shown on the contour map.',
    typical: 'Highest point of your site',
  },
  min_z: {
    term: 'Minimum elevation (min Z)',
    definition: 'Lowest elevation shown on the contour map.',
    typical: 'Lowest point of your site',
  },
  grid_size_x: {
    term: 'Grid width (X)',
    definition: 'East–west extent of the surveyed area, in metres.',
    typical: '100–1000 m',
  },
  grid_size_y: {
    term: 'Grid depth (Y)',
    definition: 'North–south extent of the surveyed area, in metres.',
    typical: '100–1000 m',
  },
  num_boreholes: {
    term: 'Number of boreholes',
    definition: 'How many drill holes make up the exploration section. More holes give a clearer picture of the seam.',
    typical: '3–10 in a section',
  },
  depth: {
    term: 'Total depth',
    definition: 'Maximum depth each borehole is drilled to, in metres.',
    typical: '50–300 m',
  },
  total_depth: {
    term: 'Total depth',
    definition: 'Maximum depth each borehole is drilled to, in metres.',
    typical: '50–300 m',
  },
  coal_seam_depth: {
    term: 'Coal seam depth',
    definition: 'Depth below surface where the target coal seam begins at the first hole.',
    typical: '20–100 m',
  },
  coal_seam_thickness: {
    term: 'Coal seam thickness',
    definition: 'How thick the economic coal seam is. Thicker seams are cheaper to mine per tonne.',
    typical: '2–10 m',
  },
  dip_angle: {
    term: 'Dip angle',
    definition: 'The angle the seam tilts below horizontal. 0° = flat, 90° = vertical. The seam deepens along dip.',
    typical: '1–15° for most coalfields',
  },
  panel_length: {
    term: 'Panel length',
    definition: 'How far the longwall panel advances (retreats) in the mining direction, in metres.',
    typical: '1000–4000 m',
  },
  face_length: {
    term: 'Face length',
    definition: 'Length of the coal face the shearer cuts along, in metres. Longer faces need more roof supports.',
    typical: '150–400 m',
  },
  face_width: {
    term: 'Face width',
    definition: 'Length of the coal face the shearer cuts along, in metres (drawn across the panel).',
    typical: '150–400 m',
  },
  panel_width: {
    term: 'Panel width',
    definition: 'Width of the longwall panel, in metres.',
    typical: '150–400 m',
  },
  seam_height: {
    term: 'Seam height',
    definition: 'Thickness of the coal seam the longwall extracts, in metres.',
    typical: '1.5–4 m',
  },
  num_supports: {
    term: 'Number of supports (chocks)',
    definition: 'Powered roof supports holding up the roof behind the shearer. Spaced ~1.5 m apart across the face.',
    typical: '100–250 across the face',
  },
  shearer_position: {
    term: 'Shearer position',
    definition: 'Where along the face the double-drum shearer currently sits, in metres from the headgate.',
    typical: 'Anywhere from 0 to face length',
  },
  pit_depth: {
    term: 'Cut depth',
    definition: 'How deep the excavation (cut) goes below the original ground surface, in metres.',
    typical: '10–100 m',
  },
  cut_depth: {
    term: 'Cut depth',
    definition: 'How deep the excavation (cut) goes below the original ground surface, in metres.',
    typical: '10–100 m',
  },
  surface_width: {
    term: 'Top width',
    definition: 'Width of the excavation at the original ground surface, in metres.',
    typical: '50–300 m',
  },
  bottom_width: {
    term: 'Bottom width',
    definition: 'Width of the flat floor of the excavation at its deepest point.',
    typical: '20–100 m',
  },
  original_ground_slope: {
    term: 'Ground slope',
    definition: 'Angle of the natural hillside before mining, in degrees.',
    typical: '2–15°',
  },
  rock_density: {
    term: 'Rock density',
    definition: 'Mass of rock per cubic metre (tonnes/m³), used to convert excavated volume into tonnage.',
    typical: '2.4–2.8 t/m³',
  },
  swell_factor: {
    term: 'Swell factor',
    definition: 'How much blasted rock expands in volume when dug (loose cubic metres vs in-situ).',
    typical: '1.2–1.5 (20–50% swell)',
  },
  belt_speed: {
    term: 'Belt speed',
    definition: 'How fast the conveyor belt travels, in metres per second.',
    typical: '2.5–6 m/s',
  },
};

export function getGlossaryEntry(key: string): GlossaryEntry | null {
  return GLOSSARY[key] ?? null;
}
