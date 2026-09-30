'use client';

import React from 'react';
import type { MineTemplate, ProjectFile } from '@/types';

const ICON_PATHS: Record<string, React.ReactNode> = {
  survey_traverse: (
    <>
      <circle cx="6" cy="6" r="3.5" />
      <path d="M7.5 4.5 6 6l-1.5 1.5" />
      <path d="M3 13.5h10M5 11.5l-2 2 2 2M11 11.5l2 2-2 2" />
    </>
  ),
  topo_contours: (
    <>
      <path d="M2 5.5c2-1.5 4-1.5 6 0s4 1.5 6 0" />
      <path d="M2 9c2-1.5 4-1.5 6 0s4 1.5 6 0" />
      <path d="M3.5 12.5c1.5-1 3-1 4.5 0s3 1 4.5 0" />
    </>
  ),
  borehole_strat: (
    <>
      <path d="M8 1.5v13" strokeDasharray="2 1.5" />
      <path d="M6 4.5h4M5.5 8h5M6.5 11.5h3" />
    </>
  ),
  open_pit: (
    <>
      <path d="M8 1.5 14 4.8v6.4L8 14.5 2 11.2V4.8L8 1.5Z" />
      <path d="M2 4.8l6 3.2 6-3.2M8 8v6.5" />
    </>
  ),
  cut_fill: (
    <>
      <path d="M2.5 13.5v-5M7 13.5V5.5M11.5 13.5V8" />
      <path d="M1.5 13.5h13" />
    </>
  ),
  longwall: (
    <>
      <rect x="1.5" y="5" width="8" height="5.5" rx="1" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="8.5" cy="12" r="1.5" />
      <path d="M9.5 7h2.5l1.5 2" />
    </>
  ),
  room_pillar: (
    <>
      <rect x="2" y="2.5" width="4.5" height="4.5" rx="0.5" />
      <rect x="9.5" y="2.5" width="4.5" height="4.5" rx="0.5" />
      <rect x="2" y="9" width="4.5" height="4.5" rx="0.5" />
      <rect x="9.5" y="9" width="4.5" height="4.5" rx="0.5" />
    </>
  ),
  ventilation: (
    <>
      <circle cx="8" cy="8" r="1.8" />
      <path d="M8 6.2c.3-2.3 2-3.4 4.3-3.4-.4 2.1-1.7 3.2-4.3 3.4ZM9.7 8c2.3.3 3.4 2 3.4 4.3-2.1-.4-3.2-1.7-3.4-4.3ZM8 9.7c-.3 2.3-2 3.4-4.3 3.4.4-2.1 1.7-3.2 4.3-3.4ZM6.3 8c-2.3-.3-3.4-2-3.4-4.3 2.1.4 3.2 1.7 3.4 4.3Z" />
    </>
  ),
  conveyor: (
    <>
      <path d="M2 6h9l3 4" />
      <path d="M2 9h9" />
      <path d="M12 3.5 14 5.5l-2 2M12 8.5l2 2-2 2" />
    </>
  ),
  blast: (
    <>
      <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.1 2.1M10.5 10.5l2.1 2.1M12.6 3.4l-2.1 2.1M5.5 10.5l-2.1 2.1" />
      <circle cx="8" cy="8" r="1.6" />
    </>
  ),
  decline: (
    <>
      <path d="M2 3.5h5l5 10" />
      <path d="M9.5 10.5H14" />
      <path d="M12.5 8.5 14 10.5l-1.5 2" />
    </>
  ),
};

function TemplateIcon({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
      aria-hidden="true"
    >
      {ICON_PATHS[id] ?? ICON_PATHS.open_pit}
    </svg>
  );
}

const TEMPLATES: MineTemplate[] = [
  {
    id: 'survey_traverse', name: 'Mine Survey Traverse', category: 'Mine Surveying', icon: '📐',
    object_type: 'mine_survey_traverse', description: 'Synthetic control loop demonstration',
    defaultParams: { num_stations: 5, starting_easting: 1000, starting_northing: 2000, starting_elevation: 150, avg_segment_len: 80 },
  },
  {
    id: 'topo_contours', name: 'Topographic Contours', category: 'Mine Surveying', icon: '🗺️',
    object_type: 'topographic_contours', description: 'Synthetic terrain demonstration',
    defaultParams: { contour_interval: 5, grid_size_x: 300, grid_size_y: 200, min_elevation: 100, max_elevation: 160 },
  },
  {
    id: 'borehole_strat', name: 'Borehole Lithology', category: 'Mine Surveying', icon: '🕳️',
    object_type: 'borehole_lithology', description: 'Drillhole stratigraphy & seam dip',
    defaultParams: { num_boreholes: 5, spacing: 50, depth: 80, coal_seam_thickness: 4.5, coal_seam_depth: 35, dip_angle: 8 },
  },
  {
    id: 'open_pit', name: 'Open Pit Mine', category: 'Surface Mining', icon: '⛏️',
    object_type: 'open_pit', description: 'Multi-bench open pit with haul road',
    defaultParams: { bench_height: 10, bench_width: 8, num_benches: 5, pit_length: 300, pit_width: 200, haul_road_width: 22, overall_slope: 55, batter_angle: 75 },
  },
  {
    id: 'cut_fill', name: 'Cut & Fill Volume', category: 'Geotechnical & Earthworks', icon: '📊',
    object_type: 'cut_fill_volume', description: 'Volumetric excavation cross-section',
    defaultParams: { pit_depth: 40, surface_width: 180, bottom_width: 60, original_ground_slope: 5, rock_density: 2.5 },
  },
  {
    id: 'longwall', name: 'Longwall Panel', category: 'Underground', icon: '🚜',
    object_type: 'longwall_panel', description: 'Underground longwall face & chocks',
    defaultParams: { face_width: 200, panel_length: 800, seam_height: 3.5, num_supports: 100, shearer_position: 80 },
  },
  {
    id: 'room_pillar', name: 'Room & Pillar', category: 'Underground', icon: '🏗️',
    object_type: 'room_and_pillar', description: 'Room and pillar layout with entries',
    defaultParams: { room_width: 6, pillar_width: 8, num_rooms_x: 5, num_rooms_y: 4, room_height: 3, entry_width: 5 },
  },
  {
    id: 'ventilation', name: 'Ventilation Network', category: 'Underground', icon: '🌬️',
    object_type: 'ventilation', description: 'Airway network with shafts and fan',
    defaultParams: { num_airways: 6, airway_length: 100, shaft_diameter: 6, fan_power: 200 },
  },
  {
    id: 'conveyor', name: 'Conveyor Route', category: 'Infrastructure', icon: '🔄',
    object_type: 'conveyor', description: 'Belt conveyor with support structure',
    defaultParams: { length: 200, width: 1.2, inclination: 15, start_x: 0, start_y: 0, end_x: 200, end_y: 0 },
  },
  {
    id: 'blast', name: 'Blast Pattern', category: 'Drilling & Blasting', icon: '💥',
    object_type: 'blast_pattern', description: 'Drill hole pattern layout',
    defaultParams: { burden: 4, spacing: 5, num_rows: 4, num_holes_per_row: 8, hole_diameter: 0.2, hole_depth: 12, pattern: 'staggered' },
  },
  {
    id: 'decline', name: 'Decline Access', category: 'Underground', icon: '🔽',
    object_type: 'decline', description: 'Decline ramp with level access',
    defaultParams: { width: 5, height: 4.5, gradient: 10, total_length: 500, num_levels: 4, level_spacing: 30 },
  },
];

interface LeftSidebarProps {
  projects: ProjectFile[];
  selectedProject: ProjectFile | null;
  onSelectProject: (p: ProjectFile) => void;
  onLoadTemplate: (t: MineTemplate) => void;
  onRenameProject: (p: ProjectFile, name: string) => void;
  onDeleteProject: (p: ProjectFile) => void;
  onDuplicateProject: (p: ProjectFile) => void;
  onDownloadProject: (p: ProjectFile) => void;
  onImportProject: (file: File) => void;
  onImportSurvey: (file: File) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export default function LeftSidebar({ projects, selectedProject, onSelectProject, onLoadTemplate, onRenameProject, onDeleteProject, onDuplicateProject, onDownloadProject, onImportProject, onImportSurvey, collapsed, setCollapsed }: LeftSidebarProps) {
  const [activeTab, setActiveTab] = React.useState<'templates' | 'projects'>('templates');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');

  if (collapsed) {
    return (
      <div className="w-10 bg-surface-raised border-r border-edge flex flex-col items-center py-2 gap-1.5">
        <button onClick={() => setCollapsed(false)} className="btn p-1.5 text-fg-muted" title="Expand">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
        <div className="w-5 h-px bg-edge my-1" />
        <button onClick={() => { setCollapsed(false); setActiveTab('templates'); }} className="btn p-1.5 text-fg-muted" title="Templates">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
        </button>
        <button onClick={() => { setCollapsed(false); setActiveTab('projects'); }} className="btn p-1.5 text-fg-muted" title="Projects">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
            <path d="M1.5 4.5a1.5 1.5 0 0 1 1.5-1.5h3l1.5 2h6a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12V4.5Z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full md:w-64 bg-surface-raised border-r border-edge flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-2 border-b border-edge">
        <div className="flex gap-0.5 bg-surface-sunken border border-edge rounded-md p-0.5">
          <button
            className={`px-2.5 py-1 text-[10px] rounded transition-colors font-medium ${activeTab === 'templates' ? 'bg-accent-dim text-accent border border-edge-accent' : 'text-fg-muted hover:text-fg border border-transparent'}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            className={`px-2.5 py-1 text-[10px] rounded transition-colors font-medium ${activeTab === 'projects' ? 'bg-accent-dim text-accent border border-edge-accent' : 'text-fg-muted hover:text-fg border border-transparent'}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
        </div>
        <button onClick={() => setCollapsed(true)} className="btn p-1 text-fg-faint" title="Collapse">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'templates' && (
          <div className="p-2 space-y-1">
            <p className="text-[11px] text-warn px-2 py-2">Templates use demonstration geometry and assumed values. Import measured survey CSV data from Projects.</p>
            {(['Mine Surveying', 'Surface Mining', 'Geotechnical & Earthworks', 'Underground', 'Infrastructure', 'Drilling & Blasting'] as const).map(cat => {
              const items = TEMPLATES.filter(t => t.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="eyebrow px-2 pt-3 pb-1">{cat}</div>
                  {items.map(t => (
                    <button
                      key={t.id}
                      onClick={() => onLoadTemplate(t)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-hover transition-colors group border border-transparent hover:border-edge"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-fg-faint group-hover:text-accent transition-colors">
                          <TemplateIcon id={t.id} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs text-fg group-hover:text-accent transition-colors truncate">{t.name}</div>
                          <div className="text-[9px] text-fg-faint truncate">{t.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="p-2">
            <label className="btn flex items-center justify-center w-full mb-2 cursor-pointer text-xs">
              Import project JSON
              <input type="file" accept=".json,.minecad.json,application/json" className="sr-only" onChange={e => {
                const file = e.target.files?.[0];
                if (file) onImportProject(file);
                e.currentTarget.value = '';
              }} />
            </label>
            <label className="btn flex items-center justify-center w-full mb-2 cursor-pointer text-xs">
              Import survey CSV
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => {
                const file = e.target.files?.[0];
                if (file) onImportSurvey(file);
                e.currentTarget.value = '';
              }} />
            </label>
            <p className="text-[10px] text-fg-faint px-1 mb-3">CSV columns: station, easting, northing, elevation. Check datum and units before use.</p>
            {projects.length === 0 ? (
              <div className="text-center py-10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mx-auto text-fg-faint mb-2" aria-hidden="true">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2.5 3H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                </svg>
                <p className="text-[11px] text-fg-muted">No projects yet</p>
                <p className="text-[9px] text-fg-faint mt-1">Generate a design to create a project</p>
              </div>
            ) : (
              <div className="space-y-1 pt-1">
                {projects.map(p => (
                  <div key={p.id} className={`rounded-lg border p-1 ${selectedProject?.id === p.id ? 'bg-accent-dim border-edge-accent' : 'border-transparent hover:bg-surface-hover'}`}>
                    {editingId === p.id ? (
                      <input autoFocus value={editingName} maxLength={120} className="input w-full text-xs" aria-label="Project name"
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { onRenameProject(p, editingName); setEditingId(null); }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => { onRenameProject(p, editingName); setEditingId(null); }} />
                    ) : (
                      <button onClick={() => onSelectProject(p)} className="w-full text-left px-1.5 py-1">
                        <div className="text-xs text-fg truncate">{p.name}</div>
                        <div className="text-[10px] text-fg-faint mt-0.5 truncate">{p.object_type.replaceAll('_', ' ')} · {new Date(p.created_at).toLocaleTimeString()}</div>
                      </button>
                    )}
                    <div className="flex gap-1 px-1.5 pb-1">
                      <button className="btn px-1.5 py-0.5 text-[10px]" title={`Rename ${p.name}`} aria-label={`Rename ${p.name}`} onClick={() => { setEditingId(p.id); setEditingName(p.name); }}>Rename</button>
                      <button className="btn px-1.5 py-0.5 text-[10px]" title={`Duplicate ${p.name}`} aria-label={`Duplicate ${p.name}`} onClick={() => onDuplicateProject(p)}>Copy</button>
                      <button className="btn px-1.5 py-0.5 text-[10px]" title={`Download ${p.name}`} aria-label={`Download ${p.name}`} onClick={() => onDownloadProject(p)}>Save file</button>
                      <button className="btn px-1.5 py-0.5 text-[10px] text-danger" title={`Delete ${p.name}`} aria-label={`Delete ${p.name}`} onClick={() => onDeleteProject(p)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { TEMPLATES };
export type { MineTemplate as MineTemplateType };
