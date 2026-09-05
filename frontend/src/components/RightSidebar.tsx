'use client';

import React from 'react';
import type { GeometryData, LayerInfo } from '@/types';
import { dxfColor } from '@/types';

interface RightSidebarProps {
  geometry: GeometryData | null;
  layers: LayerInfo[];
  setLayers: (l: LayerInfo[]) => void;
  onUpdateParams: (params: Record<string, unknown>) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export default function RightSidebar({
  geometry,
  layers,
  setLayers,
  onUpdateParams,
  collapsed,
  setCollapsed,
}: RightSidebarProps) {
  const properties = geometry?.properties || {};

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
    let badgeBg = 'bg-[#052e16] text-[#36d399] border-[#15803d]';
    if (fos < 1.1) {
      status = 'UNSTABLE / CRITICAL SLIP';
      badgeBg = 'bg-[#450a0a] text-[#f85149] border-[#b91c1c]';
    } else if (fos < 1.5) {
      status = 'MARGINAL / MONITORING REQUIRED';
      badgeBg = 'bg-[#451a03] text-[#f39c12] border-[#b45309]';
    }
    return { fos: fos.toFixed(2), status, badgeBg, totalH, slopeDeg };
  };

  if (collapsed) {
    return (
      <div className="w-10 bg-[#0d1117] border-l border-[#30363d] flex flex-col items-center py-2 gap-2 select-none">
        <button
          onClick={() => setCollapsed(false)}
          className="text-[#8b949e] hover:text-white text-sm p-1.5 rounded hover:bg-[#21262d] transition-colors"
          title="Expand"
        >
          ◀
        </button>
        <div className="w-6 h-px bg-[#30363d] my-1" />
        <span className="text-[10px] text-[#484f58] font-mono [writing-mode:vertical-lr] tracking-widest mt-2 uppercase">
          Properties
        </span>
      </div>
    );
  }

  // Determine label formatting and input type
  const renderPropertyInputs = () => {
    if (!geometry) {
      return (
        <div className="text-center py-8 text-[11px] text-[#484f58] font-mono">
          No design selected to inspect properties.
        </div>
      );
    }

    return (
      <div className="space-y-3 p-3">
        {Object.entries(properties).map(([key, val]) => {
          if (key.startsWith('_')) return null; // skip metadata
          if (key === 'name') return null;

          const label = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const isNum = typeof val === 'number';

          return (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-[10px] text-[#8b949e] font-mono">
                {label}
              </label>
              {isNum ? (
                <input
                  type="number"
                  value={val as number}
                  onChange={(e) =>
                    handleParamChange(key, parseFloat(e.target.value) || 0)
                  }
                  className="bg-[#0d1117] border border-[#30363d] rounded text-base md:text-xs text-[#e6edf3] font-mono px-2 py-1.5 focus:border-[#1f6feb] outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={val as string}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded text-base md:text-xs text-[#e6edf3] font-mono px-2 py-1.5 focus:border-[#1f6feb] outline-none"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full md:w-64 bg-[#0d1117] border-l border-[#30363d] flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#30363d]">
        <span className="text-xs font-semibold text-[#e6edf3]">Properties Panel</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-[#484f58] hover:text-white text-xs transition-colors"
        >
          ▶
        </button>
      </div>

      {/* Properties Area */}
      <div className="flex-1 overflow-y-auto border-b border-[#30363d] scrollbar-thin">
        <div className="text-[9px] uppercase tracking-wider text-[#484f58] font-bold px-3 py-2 bg-[#161b22]">
          Parameters
        </div>
        {renderPropertyInputs()}

        {/* Slope Stability Factor of Safety (FoS) Geotechnical Analysis */}
        {Boolean(properties.overall_slope) && (() => {
          const slopeInfo = computeSlopeSafetyFactor();
          if (!slopeInfo) return null;
          return (
            <div className="border-t border-[#30363d] p-3 bg-[#161b22]/70 font-mono">
              <div className="text-[10px] text-[#58a6ff] font-bold mb-1 flex items-center gap-1">
                <span>⛰️</span>
                <span>Slope Stability Analysis (FoS)</span>
              </div>
              <div className="text-[9px] text-[#8b949e] mb-2">
                Overall Slope: {slopeInfo.slopeDeg}° | Total Height: {slopeInfo.totalH}m
              </div>
              <div className={`p-2 rounded border font-mono text-center text-xs font-bold ${slopeInfo.badgeBg}`}>
                FoS = {slopeInfo.fos} ({slopeInfo.status})
              </div>
            </div>
          );
        })()}

        {/* Render Survey Control Station Table if available */}
        {Array.isArray(properties.survey_stations) && (
          <div className="border-t border-[#30363d] p-2 bg-[#161b22]/50 font-mono">
            <div className="text-[10px] text-[#36d399] font-bold mb-2 flex items-center gap-1">
              <span>📐</span>
              <span>Survey Station Coordinates</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[9px] text-left border-collapse">
                <thead>
                  <tr className="text-[#8b949e] border-b border-[#30363d]">
                    <th className="py-1 px-1">STN</th>
                    <th className="py-1 px-1">Easting</th>
                    <th className="py-1 px-1">Northing</th>
                    <th className="py-1 px-1">Elev(Z)</th>
                  </tr>
                </thead>
                <tbody className="text-[#e6edf3]">
                  {(properties.survey_stations as Array<{ station: string; easting: number; northing: number; elevation: number }>).map((stn, idx) => (
                    <tr key={idx} className="border-b border-[#30363d]/40 hover:bg-[#21262d]">
                      <td className="py-1 px-1 font-bold text-[#58a6ff]">{stn.station}</td>
                      <td className="py-1 px-1">{stn.easting}</td>
                      <td className="py-1 px-1">{stn.northing}</td>
                      <td className="py-1 px-1 text-[#f39c12]">{stn.elevation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Layer Manager */}
      <div className="h-64 flex flex-col bg-[#0d1117]">
        <div className="text-[9px] uppercase tracking-wider text-[#484f58] font-bold px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
          Layer Manager
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px] scrollbar-thin">
          {layers.map((layer) => {
            const hex = dxfColor(layer.color);
            return (
              <div
                key={layer.name}
                className="flex items-center justify-between px-2 py-2 md:py-1 hover:bg-[#161b22] rounded transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-black/30"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-[#e6edf3]">{layer.name}</span>
                </div>
                <div className="flex gap-2 opacity-80 md:opacity-60 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleLayerVisibility(layer.name)}
                    className={`p-1 hover:text-white ${layer.visible ? 'text-[#58a6ff]' : 'text-[#484f58]'}`}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? '👁️' : '🕶️'}
                  </button>
                  <button
                    onClick={() => toggleLayerLock(layer.name)}
                    className={`p-1 hover:text-white ${layer.locked ? 'text-[#da3633]' : 'text-[#484f58]'}`}
                    title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  >
                    {layer.locked ? '🔒' : '🔓'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
