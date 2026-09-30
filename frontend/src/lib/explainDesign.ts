// MineCAD AI — student-friendly "Explain my design" generator
// Turns geometry.properties into teaching sections for each generator type

import { GLOSSARY } from './glossary';

export interface ExplainSection {
  title: string;
  points: string[];
}

type Props = Record<string, unknown>;

function num(props: Props, key: string, fallback: number): number {
  const v = Number(props[key]);
  return Number.isFinite(v) ? v : fallback;
}

function str(props: Props, key: string, fallback: string): string {
  const v = props[key];
  return typeof v === 'string' && v ? v : fallback;
}

function glossaryLine(key: string): string | null {
  const e = GLOSSARY[key];
  return e ? `${e.term}: ${e.definition}` : null;
}

function tryChanging(keys: string[]): string {
  const names = keys
    .map((k) => GLOSSARY[k]?.term ?? k.replace(/_/g, ' '))
    .join(', ');
  return `Try changing ${names} in the Properties tab and watch what happens in 3D.`;
}

export function buildExplanation(objectType: string, props: Props): ExplainSection[] {
  switch (objectType) {
    case 'open_pit': {
      const bh = num(props, 'bench_height', 10);
      const nb = num(props, 'num_benches', 5);
      const bw = num(props, 'bench_width', 8);
      const hrw = num(props, 'haul_road_width', 22);
      const slope = num(props, 'overall_slope', 55);
      const batter = num(props, 'batter_angle', 75);
      const wasteTonnes = num(props, 'waste_tonnes', 0);
      const wasteLine = wasteTonnes > 0
        ? `Opening this pit moves ≈${(wasteTonnes / 1e6).toFixed(1)} Mt of waste rock (at ~2.7 t/m³) before any ore is reached.`
        : '';
      return [
        {
          title: 'What you are looking at',
          points: [
            `A surface (open pit) mine seen from above — each smaller rectangle inside is one bench (step) dug deeper than the last.`,
            `Your pit is ${nb} benches deep × ${bh} m each = ${(nb * bh).toFixed(0)} m total depth.`,
            wasteLine,
            glossaryLine('bench_height') ?? '',
          ].filter(Boolean),
        },
        {
          title: 'The benches',
          points: [
            `Each bench keeps a ${bw} m wide working strip (${GLOSSARY.bench_width.term.toLowerCase()}) so drills and trucks have room.`,
            glossaryLine('batter_angle') ?? '',
            `Batter angle ${batter}° — steeper walls mean less waste rock to move, but a higher chance of rockfalls.`,
          ],
        },
        {
          title: 'Haul road & stability',
          points: [
            `The ${hrw} m wide haul road winds down the side so trucks can drive in and out.`,
            glossaryLine('haul_road_width') ?? '',
            glossaryLine('overall_slope') ?? '',
            `Your overall slope is ${slope}°. This drawing does not assess slope stability; use site-specific geotechnical data and professional review.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['num_benches', 'bench_height', 'overall_slope', 'haul_road_width'])],
        },
      ];
    }

    case 'room_and_pillar': {
      const rw = num(props, 'room_width', 6);
      const pw = num(props, 'pillar_width', 8);
      const rx = num(props, 'num_rooms_x', 5);
      const ry = num(props, 'num_rooms_y', 4);
      const ex = num(props, 'extraction_ratio', 0);
      const coalT = num(props, 'coal_tonnes_in_situ', 0);
      return [
        {
          title: 'What you are looking at',
          points: [
            `An underground "room and pillar" mine: most of the coal/ore is dug out (the rooms) while square pillars of rock are left behind to hold up the roof.`,
            `Your panel has ${rx} × ${ry} = ${rx * ry} rooms.`,
            coalT > 0 ? `The rooms hold ≈${(coalT / 1000).toFixed(0)} kt of coal in situ (at ~1.4 t/m³).` : '',
            glossaryLine('room_width') ?? '',
          ],
        },
        {
          title: 'Rooms vs pillars',
          points: [
            `${rw} m wide rooms with ${pw} m pillars. ${glossaryLine('pillar_width') ?? ''}`,
            `The golden rule: wider rooms extract more ore but weaken the roof — the pillar must always be strong enough.`,
            ex > 0 ? `Your extraction ratio is ${ex.toFixed(1)}% — that share of the block becomes product, the rest stays as pillars.` : '',
          ].filter(Boolean),
        },
        {
          title: 'How it is worked',
          points: [
            glossaryLine('entry_width') ?? '',
            `A main entry tunnel runs along the bottom; miners cut each room in sequence and the roof is bolted as they advance.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['room_width', 'pillar_width', 'num_rooms_x'])],
        },
      ];
    }

    case 'ventilation': {
      const na = num(props, 'num_airways', 6);
      const al = num(props, 'airway_length', 100);
      const sd = num(props, 'shaft_diameter', 6);
      const fp = num(props, 'fan_power', 200);
      return [
        {
          title: 'What you are looking at',
          points: [
            `The mine's "lungs": fresh air is pushed down the intake shaft, flows along ${na} parallel airways, and returns up the exhaust shaft.`,
            glossaryLine('num_airways') ?? '',
            `Each airway is ${al} m long — air gets warmer and dirtier the farther it travels.`,
          ],
        },
        {
          title: 'Why ventilation matters',
          points: [
            `Underground air removes diesel fumes, dust and (most importantly) methane, which is explosive at 5–15% concentration.`,
            glossaryLine('shaft_diameter') ?? '',
            `Your shafts are ${sd} m diameter — size sets how much air can move.`,
          ],
        },
        {
          title: 'The fan',
          points: [
            glossaryLine('fan_power') ?? '',
            `Your main fan is ${fp} kW. Fans are usually placed on the exhaust side so the mine stays under slight suction — if anything leaks, fresh air flows in, not fumes out.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['num_airways', 'airway_length', 'fan_power'])],
        },
      ];
    }

    case 'conveyor': {
      const len = num(props, 'length', 200);
      const w = num(props, 'width', 1.2);
      const inc = num(props, 'inclination', 15);
      return [
        {
          title: 'What you are looking at',
          points: [
            `A belt conveyor route from (${num(props, 'start_x', 0)}, ${num(props, 'start_y', 0)}) to (${num(props, 'end_x', len)}, ${num(props, 'end_y', 0)}) — the plant's ore highway.`,
            `Total route length: ${len.toFixed(0)} m.`,
          ],
        },
        {
          title: 'The belt',
          points: [
            glossaryLine('width') ?? '',
            `${w} m wide belt on support frames roughly every 10 m.`,
            glossaryLine('inclination') ?? '',
          ],
        },
        {
          title: 'Gradient',
          points: [
            `The route climbs/descends at ${inc}°. Conveyors can usually go far steeper than haul trucks, which is why long pit-to-plant routes use them.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['length', 'inclination', 'width'])],
        },
      ];
    }

    case 'blast_pattern': {
      const burden = num(props, 'burden', 4);
      const spacing = num(props, 'spacing', 5);
      const rows = num(props, 'num_rows', 4);
      const holes = num(props, 'num_holes_per_row', 8);
      const hd = num(props, 'hole_diameter', 0.2);
      const pattern = str(props, 'pattern', 'staggered');
      return [
        {
          title: 'What you are looking at',
          points: [
            `The drill plan for one production blast: ${rows} rows × ${holes} holes = ${rows * holes} holes, with the free face (the cliff the rock breaks toward) along the bottom.`,
            glossaryLine('burden') ?? '',
            `Your burden is ${burden} m — every hole is drilled ${burden} m behind the free face.`,
          ],
        },
        {
          title: 'The pattern',
          points: [
            glossaryLine('spacing') ?? '',
            `${spacing} m spacing (${(spacing / burden).toFixed(1)}× the burden — within the usual 1.0–1.4× rule).`,
            glossaryLine('pattern') ?? '',
            `Pattern: ${pattern}.`,
          ],
        },
        {
          title: 'The holes',
          points: [
            glossaryLine('hole_diameter') ?? '',
            `${(hd * 1000).toFixed(0)} mm diameter holes; each is loaded with explosive and detonated row by row with millisecond delays so the rock piles up in a muck pile.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['burden', 'spacing', 'num_rows'])],
        },
      ];
    }

    case 'decline': {
      const grad = num(props, 'gradient', 10);
      const len = num(props, 'total_length', 500);
      const nl = num(props, 'num_levels', 4);
      const ls = num(props, 'level_spacing', 30);
      return [
        {
          title: 'What you are looking at',
          points: [
            `A decline — the sloping tunnel that lets trucks and equipment drive underground, like a spiral parking ramp but straight.`,
            `It descends at ${grad}% gradient for ${len.toFixed(0)} m, dropping about ${(len * grad / 100).toFixed(0)} m vertically.`,
            glossaryLine('gradient') ?? '',
          ],
        },
        {
          title: 'The zig-zag',
          points: [
            `The route zig-zags because a single straight ramp that deep would run kilometers — each leg switches direction (like a mountain road) to stay compact.`,
          ],
        },
        {
          title: 'The levels',
          points: [
            `${nl} access levels branch off, one every ${ls} m of depth.`,
            glossaryLine('level_spacing') ?? '',
            `Each level is a horizontal tunnel from which the actual ore mining happens.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['gradient', 'num_levels', 'total_length'])],
        },
      ];
    }

    case 'mine_survey_traverse': {
      const ns = num(props, 'num_stations', 5);
      const sl = num(props, 'avg_segment_len', 80);
      return [
        {
          title: 'What you are looking at',
          points: [
            `A closed survey traverse: a total-station loop of ${ns} control stations around the lease boundary, ending back where it started.`,
            glossaryLine('num_stations') ?? '',
            `Each station is sighted roughly ${sl} m apart — the polygon closes so surveyors can check their accuracy.`,
          ],
        },
        {
          title: 'Why survey first',
          points: [
            `Everything in a mine — pit design, roads, boundaries — hangs off these coordinates. If the survey is wrong, the whole design is wrong.`,
            `The misclosure and precision (1 : N) values in Properties tell you how accurate the loop is; better than 1:5000 is good practice.`,
          ],
        },
        {
          title: 'The fence',
          points: [
            `The dashed outer polygon is the lease/boundary fence, offset 25% outside the stations so the whole deposit stays inside the claim.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['num_stations', 'avg_segment_len'])],
        },
      ];
    }

    case 'topographic_contours': {
      const ci = num(props, 'contour_interval', 5);
      const lo = num(props, 'min_elevation', 100);
      const hi = num(props, 'max_elevation', 160);
      return [
        {
          title: 'What you are looking at',
          points: [
            `A topographic (DTM) map: each closed loop is a contour — a line of equal ground elevation. Read it like a fingerprint of the hill.`,
            glossaryLine('contour_interval') ?? '',
            `Your interval is ${ci} m, so neighbouring lines differ by ${ci} m of height.`,
          ],
        },
        {
          title: 'Reading it',
          points: [
            `The map spans ${lo.toFixed(0)}–${hi.toFixed(0)} m elevation (${(hi - lo).toFixed(0)} m of relief).`,
            `Lines packed close together = steep slope; lines far apart = flat ground. The bullseye at the centre is the highest ground.`,
            `Every 5th line (25 m) is drawn as a bolder "index contour" to make counting easier — exactly like a topo sheet.`,
          ],
        },
        {
          title: 'Why miners care',
          points: [
            `Pits, dumps and haul roads are placed using this surface — water always drains perpendicular to contour lines, which decides where you can (and cannot) put a dump.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['contour_interval', 'min_elevation', 'max_elevation'])],
        },
      ];
    }

    case 'borehole_lithology': {
      const nb = num(props, 'num_boreholes', 5);
      const dip = num(props, 'dip_angle', 8);
      const csd = num(props, 'coal_seam_depth', 35);
      const cst = num(props, 'coal_seam_thickness', 4.5);
      const dep = num(props, 'depth', 80);
      return [
        {
          title: 'What you are looking at',
          points: [
            `An exploration cross-section: ${nb} boreholes drilled in a line, each logging the rock layers it passes through.`,
            glossaryLine('num_boreholes') ?? '',
            `The yellow band is the coal seam — the layer the mine actually wants.`,
          ],
        },
        {
          title: 'The seam',
          points: [
            `At the first hole the seam starts at ${csd} m depth and is ${cst} m thick.`,
            glossaryLine('coal_seam_thickness') ?? '',
            glossaryLine('dip_angle') ?? '',
            `The seam tilts at ${dip}°, so it gets deeper (or shallower) with distance — follow the yellow lines between holes.`,
          ],
        },
        {
          title: 'The collar markers',
          points: [
            `Each borehole is drilled to ${dep.toFixed(0)} m total depth.`,
            `The triangle on the surface is the collar (drill site) marker, exactly like on a geological plan.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['dip_angle', 'coal_seam_depth', 'num_boreholes'])],
        },
      ];
    }

    case 'longwall_panel': {
      const pl = num(props, 'panel_length', 800);
      const fw = num(props, 'face_width', 200);
      const ns = num(props, 'num_supports', 100);
      const sp = num(props, 'shearer_position', 80);
      return [
        {
          title: 'What you are looking at',
          points: [
            `A longwall coal panel: the most productive underground coal method. A wall of machinery retreats down a long rectangular block, taking nearly 100% of the coal.`,
            `Your panel is ${pl.toFixed(0)} m long × ${fw.toFixed(0)} m wide.`,
            glossaryLine('face_width') ?? '',
          ],
        },
        {
          title: 'The face equipment',
          points: [
            `The orange box at the face is the double-drum shearer, currently at ${sp.toFixed(0)} m along the face — it cuts a thin slice (~0.8 m) each pass while the conveyor behind it carries the coal away.`,
            glossaryLine('num_supports') ?? '',
            `Your face carries ${ns} powered roof supports — each a 20-tonne hydraulic shield that holds the roof up as the shearer passes, then lets it collapse behind.`,
          ],
        },
        {
          title: 'The gate roads',
          points: [
            `The two roads above and below the face are the headgate (fresh air + coal out) and tailgate (air return) — everything moves along them while the face retreats.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['face_width', 'panel_length', 'num_supports'])],
        },
      ];
    }

    case 'cut_fill_volume': {
      const pd = num(props, 'pit_depth', 40);
      const sw = num(props, 'surface_width', 180);
      const bw = num(props, 'bottom_width', 60);
      const den = num(props, 'rock_density', 2.5);
      const area = num(props, 'cut_area_m2', ((sw + bw) / 2) * pd);
      const vol = num(props, 'cut_volume_m3', area * 100);
      const ton = num(props, 'cut_tonnes', vol * den);
      return [
        {
          title: 'What you are looking at',
          points: [
            `A cross-section of one excavation: the sloping green line is the original hillside, the red block is the material you must dig out.`,
            `Your cut is ${pd.toFixed(0)} m deep, ${sw.toFixed(0)} m wide at the top and ${bw.toFixed(0)} m wide at the floor.`,
            glossaryLine('pit_depth') ?? '',
          ],
        },
        {
          title: 'The volume estimate',
          points: [
            `The cut shape is a trapezoid, so its area ≈ (top + bottom)/2 × depth = ${area.toFixed(0)} m².`,
            `Multiplying by a 100 m strike length gives ${Math.round(vol).toLocaleString()} m³ of rock.`,
            glossaryLine('rock_density') ?? '',
            `At ${den} t/m³ that is about ${Math.round(ton).toLocaleString()} tonnes to move — this single number decides your fleet size and cost.`,
          ],
        },
        {
          title: 'Why it matters',
          points: [
            `Volume estimates like this are done before any digging, to price the job, choose equipment, and schedule the mine plan.`,
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['pit_depth', 'surface_width', 'bottom_width'])],
        },
      ];
    }

    default:
      return [
        {
          title: 'About this design',
          points: [
            'This design was generated from your parameters. Open the Properties tab to see every value used.',
          ],
        },
        {
          title: 'Experiment',
          points: [tryChanging(['num_benches', 'length', 'width'])],
        },
      ];
  }
}
