'use client';

import React, { useState } from 'react';
import type { GeometryData, LayerInfo, SceneObject } from '@/types';
import { dxfColor } from '@/types';
import { getGlossaryEntry } from '@/lib/glossary';
import ExplainPanel from '@/components/ExplainPanel';

const I = {
  eye: (
    <>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4.5C2.6 5.6 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.3 0 2.4-.4 3.4-1M6.5 3.7C7 3.6 7.5 3.5 8 3.5c4 0 6.5 4.5 6.5 4.5s-.5.9-1.4 1.9" />
      <path d="M2 2l12 12" />
      <path d="M6.2 6.2a2 2 0 0 0 2.8 2.8" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  unlock: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5-.6" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.5V11" />
      <path d="M8 5.2v.2" />
    </>
  ),
  mountain: (
    <>
      <path d="M1.5 13 6 5.5l2.5 4 1.5-2.5L14.5 13H1.5Z" />
      <path d="M5.2 8.2 6 9.5l.8-1.3" />
    </>
  ),
  ruler: (
    <>
      <rect x="1.5" y="5" width="13" height="6" rx="1" />
      <path d="M4.5 5v2.2M7.5 5v3M10.5 5v2.2" />
    </>
  ),
};

function Icon({ d, className = 'w-3.5 h-3.5' }: { d: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d}
    </svg>
  );
}

interface RightSidebarProps {
  geometry: GeometryData | null;
  scene?: SceneObject[];
  selectedObjectId?: string | null;
  onSelectSceneObject?: (id: string) => void;
  onMoveSceneObject?: (id: string, x: number, y: number) => void;
  onDeleteSceneObject?: (id: string) => void;
  layers: LayerInfo[];
  setLayers: (l: LayerInfo[]) => void;
  onUpdateParams: (params: Record<string, unknown>) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

type Tab = 'properties' | 'layers' | 'explain';

const EDITABLE_PROPERTIES = new Set([
  'bench_height', 'bench_width', 'num_benches', 'pit_length', 'pit_width',
  'haul_road_width', 'overall_slope', 'batter_angle', 'room_width',
  'pillar_width', 'num_rooms_x', 'num_rooms_y', 'room_height', 'entry_width',
  'num_airways', 'airway_length', 'shaft_diameter', 'fan_power_kw',
  'length', 'width', 'inclination', 'start_x', 'start_y', 'end_x', 'end_y',
  'burden', 'spacing', 'num_rows', 'num_holes_per_row', 'hole_diameter',
  'hole_depth', 'pattern', 'height', 'gradient', 'total_length',
  'num_levels', 'level_spacing', 'num_stations', 'starting_easting',
  'starting_northing', 'starting_elevation', 'avg_segment_len',
  'contour_interval', 'min_elevation', 'max_elevation', 'grid_size_x',
  'grid_size_y', 'num_boreholes', 'total_depth', 'coal_seam_thickness',
  'coal_seam_depth', 'dip_angle_deg', 'face_width', 'panel_length',
  'seam_height', 'num_supports', 'shearer_position', 'pit_depth',
  'surface_width', 'bottom_width', 'original_ground_slope', 'rock_density',
]);

export default function RightSidebar({
  geometry,
  scene = [],
  selectedObjectId = null,
  onSelectSceneObject,
  onMoveSceneObject,
  onDeleteSceneObject,
  layers,
  setLayers,
  onUpdateParams,
  collapsed,
  setCollapsed,
}: RightSidebarProps) {
  const properties = geometry?.properties || {};
  const selectedSceneObject = scene.find(item => item.id === selectedObjectId) ?? scene[0];
  const [activeTab, setActiveTab] = useState<Tab>('properties');
  const idPrefix = React.useId();
  // Mobile: tap ⓘ toggles an inline accordion per property
  const [openInfoKey, setOpenInfoKey] = useState<string | null>(null);

  const toggleLayerVisibility = (name: string) => {
    setLayers(
      layers.map((l) => (l.name === name ? { ...l, visible: !l.visible } : l))
    );
  };

  const handleParamChange = (key: string, value: number | string) => {
    const updated = { ...properties, [key]: value };
    if (key === 'overall_slope') updated._design_driver = 'overall_slope';
    if (key === 'bench_width') updated._design_driver = 'bench_width';
    if (key === 'length' && properties._object_type === 'conveyor' && typeof value === 'number') {
      const sx = Number(properties.start_x || 0), sy = Number(properties.start_y || 0);
      const ex = Number(properties.end_x || 200), ey = Number(properties.end_y || 0);
      const oldLength = Math.hypot(ex - sx, ey - sy) || 1;
      updated.end_x = sx + (ex - sx) * value / oldLength;
      updated.end_y = sy + (ey - sy) * value / oldLength;
    }
    delete updated._object_type;
    onUpdateParams(updated);
  };

  if (collapsed) {
    return (
      <div className="w-10 bg-surface-raised border-l border-edge flex flex-col items-center py-2 gap-1.5 select-none">
        <button
          onClick={() => setCollapsed(false)}
          className="btn p-1.5 text-fg-muted"
          title="Expand"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
        <div className="w-5 h-px bg-edge my-1" />
        <span className="text-[9px] text-fg-faint font-mono [writing-mode:vertical-lr] tracking-[0.18em] mt-2 uppercase">
          Properties
        </span>
      </div>
    );
  }

  // Determine label formatting and input type
  const renderPropertyInputs = () => {
    if (!geometry) {
      return (
        <div className="text-center py-10 px-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 mx-auto text-fg-faint mb-2" aria-hidden="true">
            <path d="M4 20h16M6 16l4-9 3 5 2-3 3 7" />
          </svg>
          <p className="text-[11px] text-fg-faint font-mono">
            No design selected to inspect properties.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3 p-3 pb-28">
        {Object.entries(properties).map(([key, val]) => {
          if (key.startsWith('_')) return null; // skip metadata
          if (key === 'name') return null;
          if (Array.isArray(val)) return null; // rendered as a table below

          const label = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const isNum = typeof val === 'number';
          const editable = EDITABLE_PROPERTIES.has(key) && !properties.data_source;
          const glossary = getGlossaryEntry(key);
          const infoOpen = openInfoKey === key;

          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center gap-1 relative group/prop">
                <label htmlFor={`${idPrefix}-${key}`} className="text-[11px] uppercase tracking-[0.12em] text-fg-muted font-semibold">
                  {label}
                </label>
                {glossary && (
                  <button
                    type="button"
                    onClick={() => setOpenInfoKey(infoOpen ? null : key)}
                    className="text-fg-faint hover:text-info transition-colors p-0.5 leading-none"
                    title={glossary.term}
                    aria-label={`What is ${glossary.term}?`}
                    aria-expanded={infoOpen}
                  >
                    <Icon d={I.info} className="w-3 h-3" />
                  </button>
                )}
                {/* Desktop hover tooltip (drops below the info button) */}
                {glossary && (
                  <div className="hidden md:block invisible opacity-0 group-hover/prop:visible group-hover/prop:opacity-100 group-focus-within/prop:visible group-focus-within/prop:opacity-100 transition-opacity absolute top-full left-0 mt-1 z-30 w-60 max-w-[240px] bg-surface-overlay border border-edge rounded-lg p-2.5 shadow-[var(--shadow-pop)] pointer-events-none">
                    <div className="text-[10px] font-bold text-info font-mono mb-1">
                      {glossary.term}
                    </div>
                    <div className="text-[10px] text-fg-muted leading-relaxed mb-1.5">
                      {glossary.definition}
                    </div>
                    <div className="text-[9px] text-success font-mono">
                      Typical: {glossary.typical}
                    </div>
                  </div>
                )}
              </div>
              {/* Mobile tap accordion */}
              {glossary && infoOpen && (
                <div className="md:hidden bg-surface-overlay/70 border border-edge rounded-lg p-2.5 mb-1">
                  <div className="text-[10px] font-bold text-info font-mono mb-1">
                    {glossary.term}
                  </div>
                  <div className="text-[10px] text-fg-muted leading-relaxed mb-1.5">
                    {glossary.definition}
                  </div>
                  <div className="text-[9px] text-success font-mono">
                    Typical: {glossary.typical}
                  </div>
                </div>
              )}
              {!editable ? (
                <output id={`${idPrefix}-${key}`} className="text-xs text-fg-muted tabular-nums break-words">{String(val)}</output>
              ) : isNum ? (
                <input
                  id={`${idPrefix}-${key}`}
                  type="number"
                  value={val as number}
                  onChange={(e) => { if (e.target.value !== '' && Number.isFinite(Number(e.target.value))) handleParamChange(key, Number(e.target.value)); }}
                  className="input font-mono text-base md:text-xs tabular-nums"
                />
              ) : (
                <input
                  id={`${idPrefix}-${key}`}
                  type="text"
                  value={val as string}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  className="input font-mono text-base md:text-xs"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPropertiesTab = () => (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="eyebrow px-3 py-2.5 bg-surface-sunken border-b border-edge">
        Parameters
      </div>
      {renderPropertyInputs()}

      {Array.isArray(properties.design_warnings) && properties.design_warnings.length > 0 && (
        <div role="note" className="m-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-[11px] text-warn space-y-1">
          {(properties.design_warnings as string[]).map((warning, index) => <p key={index}>{warning}</p>)}
        </div>
      )}

      {Boolean(properties.overall_slope) && (
        <div className="border-t border-edge p-3 bg-surface-overlay/50 font-mono" role="note">
          <div className="text-xs text-warn font-bold mb-1 flex items-center gap-1.5">
            <Icon d={I.mountain} className="w-3.5 h-3.5" />
            <span>Slope stability is not assessed</span>
          </div>
          <p className="text-[11px] text-fg-muted leading-relaxed">
            This is a conceptual pit shape. A factor of safety requires site geology, rock strength,
            groundwater and a reviewed analysis method. Do not use this drawing as a stability result.
          </p>
        </div>
      )}

      {/* Render Survey Control Station Table if available */}
      {Array.isArray(properties.survey_stations) && (
        <div className="border-t border-edge p-2 bg-surface-overlay/30 font-mono">
          <div className="text-[10px] text-success font-bold mb-2 flex items-center gap-1.5">
            <Icon d={I.ruler} className="w-3.5 h-3.5" />
            <span>Survey Station Coordinates</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[9px] text-left border-collapse">
              <thead>
                <tr className="text-fg-muted border-b border-edge">
                  <th className="py-1 px-1">STN</th>
                  <th className="py-1 px-1">Easting</th>
                  <th className="py-1 px-1">Northing</th>
                  <th className="py-1 px-1">Elev(Z)</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                {(properties.survey_stations as Array<{ station: string; easting: number; northing: number; elevation: number }>).map((stn, idx) => (
                  <tr key={idx} className="border-b border-edge/50 hover:bg-surface-hover">
                    <td className="py-1 px-1 font-bold text-info">{stn.station}</td>
                    <td className="py-1 px-1 tabular-nums">{stn.easting}</td>
                    <td className="py-1 px-1 tabular-nums">{stn.northing}</td>
                    <td className="py-1 px-1 tabular-nums text-warn">{stn.elevation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderLayersTab = () => (
    <div className="flex-1 flex flex-col bg-surface-raised min-h-0">
      <div className="eyebrow px-3 py-2.5 bg-surface-sunken border-b border-edge">
        Layer Manager
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-[11px] scrollbar-thin">
        {layers.map((layer) => {
          const hex = dxfColor(layer.color);
          return (
            <div
              key={layer.name}
              className="flex items-center justify-between px-2 py-2 md:py-1.5 hover:bg-surface-hover rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-[3px] border border-edge shrink-0"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-fg truncate">{layer.name}</span>
              </div>
              <div className="flex gap-1.5 opacity-80 md:opacity-50 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleLayerVisibility(layer.name)}
                  className={`p-1 rounded transition-colors ${layer.visible ? 'text-info hover:text-fg' : 'text-fg-faint hover:text-fg'}`}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  <Icon d={layer.visible ? I.eye : I.eyeOff} className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'properties', label: 'Properties' },
    { id: 'layers', label: 'Layers' },
    { id: 'explain', label: 'Explain' },
  ];

  return (
    <div className="w-full h-full xl:w-64 bg-surface-raised border-l border-edge flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-edge">
        <span className="eyebrow">Inspector</span>
        <button
          onClick={() => setCollapsed(true)}
          className="btn p-1 text-fg-faint"
          title="Collapse"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
      </div>

      <div className="border-b border-edge p-2.5 bg-surface-sunken/50">
        <div className="eyebrow mb-2">Mine components · {scene.length}</div>
        <div className="max-h-28 overflow-y-auto space-y-1 scrollbar-thin">
          {scene.length === 0 && <p className="text-[11px] text-fg-faint">Describe a component to begin.</p>}
          {scene.map(item => (
            <button key={item.id} type="button" onClick={() => onSelectSceneObject?.(item.id)}
              className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] truncate ${selectedSceneObject?.id === item.id ? 'border-edge-accent bg-accent-dim text-accent' : 'border-edge text-fg-muted hover:bg-surface-hover'}`}
              aria-pressed={selectedSceneObject?.id === item.id} title={item.name}>
              {item.name}
            </button>
          ))}
        </div>
        {selectedSceneObject && !selectedSceneObject.params.data_source && (
          <div className="mt-2 border-t border-edge pt-2">
            <div className="text-[10px] text-fg-muted mb-1">Position in plan (m)</div>
            <div className="flex gap-1.5 items-center">
              <label className="text-[10px] text-fg-faint">X<input type="number" value={selectedSceneObject.origin.x} onChange={event => onMoveSceneObject?.(selectedSceneObject.id, Number(event.target.value), selectedSceneObject.origin.y)} className="input w-full text-xs" /></label>
              <label className="text-[10px] text-fg-faint">Y<input type="number" value={selectedSceneObject.origin.y} onChange={event => onMoveSceneObject?.(selectedSceneObject.id, selectedSceneObject.origin.x, Number(event.target.value))} className="input w-full text-xs" /></label>
              <button type="button" className="btn px-2 h-8 text-[10px] text-danger mt-3" onClick={() => onDeleteSceneObject?.(selectedSceneObject.id)} title="Delete selected component (Undo can restore it)">Delete</button>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="px-2 pt-2 pb-2 border-b border-edge">
        <div className="flex bg-surface-sunken border border-edge rounded-md p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-1 py-1.5 text-[10px] font-medium rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent-dim text-accent border border-edge-accent'
                  : 'text-fg-muted hover:text-fg border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'properties' && renderPropertiesTab()}
      {activeTab === 'layers' && renderLayersTab()}
      {activeTab === 'explain' && <ExplainPanel geometry={geometry} />}
    </div>
  );
}
