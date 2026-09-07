'use client';

import React, { useState } from 'react';
import type { GeometryData, LayerInfo } from '@/types';
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
  layers: LayerInfo[];
  setLayers: (l: LayerInfo[]) => void;
  onUpdateParams: (params: Record<string, unknown>) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

type Tab = 'properties' | 'layers' | 'explain';

export default function RightSidebar({
  geometry,
  layers,
  setLayers,
  onUpdateParams,
  collapsed,
  setCollapsed,
}: RightSidebarProps) {
  const properties = geometry?.properties || {};
  const [activeTab, setActiveTab] = useState<Tab>('properties');
  // Mobile: tap ⓘ toggles an inline accordion per property
  const [openInfoKey, setOpenInfoKey] = useState<string | null>(null);

  const toggleLayerVisibility = (name: string) => {
    setLayers(
      layers.map((l) => (l.name === name ? { ...l, visible: !l.visible } : l))
    );
  };

  const toggleLayerLock = (name: string) => {
    setLayers(
      layers.map((l) => (l.name === name ? { ...l, locked: !l.locked } : l))
    );
  };

  const handleParamChange = (key: string, value: number | string) => {
    const updated = { ...properties, [key]: value };
    // Clear internal helper variables starting with underscore
    delete updated._object_type;
    onUpdateParams(updated);
  };

  const computeSlopeSafetyFactor = () => {
    if (!properties || !properties.overall_slope) return null;
    const slopeDeg = Number(properties.overall_slope || 55);
    const benchH = Number(properties.bench_height || 10);
    const numBenches = Number(properties.num_benches || 5);
    const totalH = benchH * numBenches;

    const rad = (slopeDeg * Math.PI) / 180;
    const cohesion = 35; // kPa
    const gamma = 25; // kN/m3
    const phiRad = (32 * Math.PI) / 180;

    const numerator = cohesion + gamma * totalH * Math.cos(rad) ** 2 * Math.tan(phiRad);
    const denominator = gamma * totalH * Math.sin(rad) * Math.cos(rad) + 0.001;
    const fos = Math.max(0.5, Math.min(3.5, numerator / denominator));

    let status = 'STABLE';
    let badgeBg = 'bg-success/10 text-success border-success/40';
    if (fos < 1.1) {
      status = 'UNSTABLE / CRITICAL SLIP';
      badgeBg = 'bg-danger/10 text-danger border-danger/40';
    } else if (fos < 1.5) {
      status = 'MARGINAL / MONITORING REQUIRED';
      badgeBg = 'bg-warn/10 text-warn border-warn/40';
    }
    return { fos: fos.toFixed(2), status, badgeBg, totalH, slopeDeg };
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
          const glossary = getGlossaryEntry(key);
          const infoOpen = openInfoKey === key;

          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center gap-1 relative group/prop">
                <label className="text-[10px] uppercase tracking-[0.12em] text-fg-muted font-semibold">
                  {label}
                </label>
                {glossary && (
                  <button
                    type="button"
                    onClick={() => setOpenInfoKey(infoOpen ? null : key)}
                    className="text-fg-faint hover:text-info transition-colors p-0.5 leading-none"
                    title={glossary.term}
                    aria-label={`What is ${glossary.term}?`}
                  >
                    <Icon d={I.info} className="w-3 h-3" />
                  </button>
                )}
                {/* Desktop hover tooltip (drops below the info button) */}
                {glossary && (
                  <div className="hidden md:block invisible opacity-0 group-hover/prop:visible group-hover/prop:opacity-100 transition-opacity absolute top-full left-0 mt-1 z-30 w-60 max-w-[240px] bg-surface-overlay border border-edge rounded-lg p-2.5 shadow-[var(--shadow-pop)] pointer-events-none">
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
              {isNum ? (
                <input
                  type="number"
                  value={val as number}
                  onChange={(e) =>
                    handleParamChange(key, parseFloat(e.target.value) || 0)
                  }
                  className="input font-mono text-base md:text-xs tabular-nums"
                />
              ) : (
                <input
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

      {/* Slope Stability Factor of Safety (FoS) Geotechnical Analysis */}
      {Boolean(properties.overall_slope) && (() => {
        const slopeInfo = computeSlopeSafetyFactor();
        if (!slopeInfo) return null;
        return (
          <div className="border-t border-edge p-3 bg-surface-overlay/50 font-mono">
            <div className="text-[10px] text-info font-bold mb-1 flex items-center gap-1.5">
              <Icon d={I.mountain} className="w-3.5 h-3.5" />
              <span>Slope Stability Analysis (FoS)</span>
            </div>
            <div className="text-[9px] text-fg-faint mb-2">
              Overall Slope: {slopeInfo.slopeDeg}° | Total Height: {slopeInfo.totalH}m
            </div>
            <div className={`p-2 rounded-lg border font-mono text-center text-xs font-bold ${slopeInfo.badgeBg}`}>
              FoS = {slopeInfo.fos} ({slopeInfo.status})
            </div>
          </div>
        );
      })()}

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
                <button
                  onClick={() => toggleLayerLock(layer.name)}
                  className={`p-1 rounded transition-colors ${layer.locked ? 'text-danger hover:text-fg' : 'text-fg-faint hover:text-fg'}`}
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                >
                  <Icon d={layer.locked ? I.lock : I.unlock} className="w-3.5 h-3.5" />
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
    <div className="w-full md:w-64 bg-surface-raised border-l border-edge flex flex-col overflow-hidden select-none">
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
