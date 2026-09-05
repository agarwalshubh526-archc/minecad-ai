'use client';

import React from 'react';
import type { MineTemplate, ProjectFile } from '@/types';

const TEMPLATES: MineTemplate[] = [
  {
    id: 'survey_traverse', name: 'Mine Survey Traverse', category: 'Mine Surveying', icon: '📐',
    object_type: 'mine_survey_traverse', description: 'Total station control loop & coordinates',
    defaultParams: { num_stations: 5, starting_easting: 1000, starting_northing: 2000, starting_elevation: 150, avg_segment_len: 80 },
  },
  {
    id: 'topo_contours', name: 'Topographic Contours', category: 'Mine Surveying', icon: '🗺️',
    object_type: 'topographic_contours', description: 'DTM surface elevation contour map',
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
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export default function LeftSidebar({ projects, selectedProject, onSelectProject, onLoadTemplate, collapsed, setCollapsed }: LeftSidebarProps) {
  const [activeTab, setActiveTab] = React.useState<'templates' | 'projects'>('templates');

  if (collapsed) {
    return (
      <div className="w-10 bg-[#0d1117] border-r border-[#30363d] flex flex-col items-center py-2 gap-2">
        <button onClick={() => setCollapsed(false)} className="text-[#8b949e] hover:text-white text-sm p-1.5 rounded hover:bg-[#21262d] transition-colors" title="Expand">
          ▶
        </button>
        <div className="w-6 h-px bg-[#30363d] my-1" />
        <button onClick={() => { setCollapsed(false); setActiveTab('templates'); }} className="text-lg p-1" title="Templates">📋</button>
        <button onClick={() => { setCollapsed(false); setActiveTab('projects'); }} className="text-lg p-1" title="Projects">📁</button>
      </div>
    );
  }

  return (
    <div className="w-full md:w-64 bg-[#0d1117] border-r border-[#30363d] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#30363d]">
        <div className="flex gap-1">
          <button
            className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${activeTab === 'templates' ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-white'}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${activeTab === 'projects' ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-white'}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-[#484f58] hover:text-white text-xs transition-colors">◀</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'templates' && (
          <div className="p-2 space-y-1">
            {(['Mine Surveying', 'Surface Mining', 'Geotechnical & Earthworks', 'Underground', 'Infrastructure', 'Drilling & Blasting'] as const).map(cat => {
              const items = TEMPLATES.filter(t => t.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-[9px] uppercase tracking-wider text-[#484f58] font-semibold px-2 py-1.5 mt-1">{cat}</div>
                  {items.map(t => (
                    <button
                      key={t.id}
                      onClick={() => onLoadTemplate(t)}
                      className="w-full text-left px-2 py-2 rounded-md hover:bg-[#161b22] transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{t.icon}</span>
                        <div>
                          <div className="text-xs text-[#e6edf3] group-hover:text-[#58a6ff] transition-colors">{t.name}</div>
                          <div className="text-[9px] text-[#484f58]">{t.description}</div>
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
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-[#30363d] text-2xl mb-2">📂</div>
                <p className="text-[10px] text-[#484f58]">No projects yet</p>
                <p className="text-[9px] text-[#30363d] mt-1">Generate a design to create a project</p>
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p)}
                    className={`w-full text-left px-2 py-2 rounded-md transition-colors ${
                      selectedProject?.id === p.id ? 'bg-[#1f6feb20] border border-[#1f6feb40]' : 'hover:bg-[#161b22]'
                    }`}
                  >
                    <div className="text-xs text-[#e6edf3]">{p.name}</div>
                    <div className="text-[9px] text-[#484f58] mt-0.5">{p.object_type} • {new Date(p.created_at).toLocaleTimeString()}</div>
                  </button>
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
