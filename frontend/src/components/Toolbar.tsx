'use client';

import React from 'react';
import type { GeometryData, AIConfig } from '@/types';

/* Inline 1.5px-stroke SVG icons (lucide-style, no emoji in UI) */
const I = {
  cube: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" /><path d="M3 8.5 12 14l9-5.5" /><path d="M12 14v7" />
    </svg>
  ),
  sheet: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 9v12" /><path d="M14 16h4" />
    </svg>
  ),
  solid: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" />
    </svg>
  ),
  wire: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
    </svg>
  ),
  section: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9" /><path d="M14.5 14.5 20 20" /><path d="M8.1 8.1 12 12" />
    </svg>
  ),
  gear: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
};

interface ToolbarProps {
  activeView: '2d' | '3d';
  setActiveView: (v: '2d' | '3d') => void;
  viewMode3D: 'solid' | 'wireframe';
  setViewMode3D: (v: 'solid' | 'wireframe') => void;
  showSectionView: boolean;
  setShowSectionView: (v: boolean) => void;
  sectionHeight: number;
  setSectionHeight: (v: number) => void;
  geometry: GeometryData | null;
  onExport: (format: string) => void;
  aiConfig: AIConfig;
  setAiConfig: (c: AIConfig) => void;
  isGenerating: boolean;
  sheetMode?: boolean;
  setSheetMode?: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function Toolbar({
  activeView, setActiveView,
  viewMode3D, setViewMode3D,
  showSectionView, setShowSectionView,
  sectionHeight, setSectionHeight,
  geometry, onExport,
  aiConfig, setAiConfig,
  isGenerating,
  sheetMode = false, setSheetMode,
  onUndo, onRedo, canUndo, canRedo,
}: ToolbarProps) {
  const [showAiSettings, setShowAiSettings] = React.useState(false);
  React.useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowAiSettings(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  return (
    <header className="h-12 bg-surface-raised border-b border-edge flex items-center px-2 md:px-3 gap-2 select-none relative z-50">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-3 pr-4 border-r border-edge shrink-0">
        <div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-[#1c1305]">
          {I.cube}
        </div>
        <div className="hidden sm:block leading-none">
          <div className="text-[13px] font-bold text-fg tracking-tight">MineCAD AI</div>
          <div className="text-[9px] font-medium text-fg-muted tracking-[0.08em] uppercase mt-0.5">Design workspace</div>
        </div>
      </div>

      {/* Segmented view-mode control */}
      <div className="flex bg-surface-sunken rounded-lg border border-edge p-0.5 mr-2 shrink-0" role="tablist" aria-label="View mode">
        {(['2d', '3d'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={activeView === v}
            className={`px-3.5 h-8 rounded-md text-xs font-mono font-semibold transition-all duration-150 ${
              activeView === v ? 'bg-accent-dim text-accent border border-edge-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]' : 'btn border-transparent'
            }`}
            onClick={() => setActiveView(v)}
          >
            {v.toUpperCase()}
          </button>
        ))}
      </div>

      {/* 2D Drawing Sheet toggle */}
      {activeView === '2d' && setSheetMode && (
        <div className="flex items-center mr-2 pl-2 border-l border-edge shrink-0">
          <button
            className={`btn h-8 px-2.5 text-[11px] font-mono ${sheetMode ? 'btn-active' : ''}`}
            onClick={() => setSheetMode(!sheetMode)}
            title="Toggle AutoCAD-style drawing sheet (frame, title block, north arrow, scale bar)"
            aria-pressed={sheetMode}
          >
            {I.sheet}
            <span className="md:inline">Sheet</span>
          </button>
        </div>
      )}

      {/* 3D View controls */}
      {activeView === '3d' && (
        <div className="flex items-center gap-1 mr-2 pl-2 border-l border-edge shrink-0">
          <button
            className={`btn h-8 px-2.5 text-[11px] font-mono ${viewMode3D === 'solid' ? 'btn-active' : ''}`}
            onClick={() => setViewMode3D('solid')}
            title="Solid view"
            aria-pressed={viewMode3D === 'solid'}
          >
            {I.solid}
            <span className="md:inline">Solid</span>
          </button>
          <button
            className={`btn h-8 px-2.5 text-[11px] font-mono ${viewMode3D === 'wireframe' ? 'btn-active' : ''}`}
            onClick={() => setViewMode3D('wireframe')}
            title="Wireframe view"
            aria-pressed={viewMode3D === 'wireframe'}
          >
            {I.wire}
            <span className="md:inline">Wire</span>
          </button>
          <div className="w-px h-5 bg-edge mx-1" />
          <button
            className={`btn h-8 px-2.5 text-[11px] font-mono ${showSectionView ? 'text-danger border-danger/40 bg-danger/10' : ''}`}
            onClick={() => setShowSectionView(!showSectionView)}
            title="Section view"
            aria-pressed={showSectionView}
          >
            {I.section}
            <span className="md:inline">Section</span>
          </button>
          {showSectionView && (
            <input
              type="range"
              min="-200"
              max="50"
              step="1"
              value={sectionHeight}
              onChange={e => setSectionHeight(Number(e.target.value))}
              className="w-20 h-1 accent-[#e5534b] ml-1"
            />
          )}
        </div>
      )}

      <div className="flex gap-1 shrink-0" aria-label="Edit history">
        <button type="button" className="btn h-8 px-2 text-[11px]" onClick={onUndo} disabled={!canUndo} title="Undo last design edit" aria-label="Undo last design edit">Undo</button>
        <button type="button" className="btn h-8 px-2 text-[11px]" onClick={onRedo} disabled={!canRedo} title="Redo design edit" aria-label="Redo design edit">Redo</button>
      </div>

      </div>

      {/* Status */}
      {isGenerating && (
        <div className="hidden sm:flex items-center gap-2 animate-fade-in shrink-0">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] text-accent font-mono tracking-wide">GENERATING</span>
        </div>
      )}

      {/* Export group */}
      {geometry && (
        <details className="relative shrink-0">
          <summary className="btn h-8 px-3 text-[11px] font-semibold border border-edge-strong list-none [&::-webkit-details-marker]:hidden">Export <span aria-hidden="true">⌄</span></summary>
          <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-edge-strong bg-surface-overlay p-1.5 shadow-[var(--shadow-pop)]">
          {['DXF', 'SVG', 'PDF', 'OBJ', 'STL'].map(fmt => (
            <button
              key={fmt}
              onClick={(event) => { onExport(fmt.toLowerCase()); event.currentTarget.closest('details')?.removeAttribute('open'); }}
              title={`Export ${fmt}`}
              className="btn w-full h-8 justify-start px-2.5 text-xs"
            >
              {fmt} file
            </button>
          ))}
          {Array.isArray(geometry.properties?.survey_stations) && (
            <button
              onClick={(event) => {
                const stations = geometry.properties.survey_stations as Array<{ station: string; easting: number; northing: number; elevation: number; code?: string }>;
                const csvRows = ['Station,Easting,Northing,Elevation,Code'];
                for (const s of stations) {
                  csvRows.push(`${s.station},${s.easting},${s.northing},${s.elevation},${s.code || 'POINT'}`);
                }
                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'mine_survey_stations.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 0);
                event.currentTarget.closest('details')?.removeAttribute('open');
              }}
              className="btn w-full h-8 justify-start px-2.5 text-xs text-success hover:text-success"
              title="Download Survey Stations CSV"
            >
              CSV data
            </button>
          )}
          </div>
        </details>
      )}

      {/* AI Config */}
      <button
        onClick={() => setShowAiSettings(!showAiSettings)}
        className={`btn h-8 px-2.5 text-[11px] font-mono shrink-0 ${showAiSettings ? 'btn-active' : ''}`}
        aria-pressed={showAiSettings}
        title="AI provider settings"
      >
        {I.gear}
        <span className="hidden md:inline">AI:&nbsp;{aiConfig.provider}</span>
      </button>

      {/* AI Settings Dropdown */}
      {showAiSettings && (
        <div className="absolute top-full right-3 mt-1.5 w-[calc(100vw-1.5rem)] max-w-80 card shadow-[var(--shadow-pop)] p-4 z-[100] animate-fade-in">
          <h3 className="text-xs font-bold text-fg mb-3 tracking-tight">AI Configuration</h3>

          <label htmlFor="ai-provider" className="block eyebrow mb-1.5">Provider</label>
          <select
            id="ai-provider"
            value={aiConfig.provider}
            onChange={e => setAiConfig({ ...aiConfig, provider: e.target.value as AIConfig['provider'], model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' })}
            className="input w-full text-xs px-2.5 py-2 mb-4"
          >
            <option value="local">Local (Rule-Based NLP)</option>
            <option value="deepseek">DeepSeek AI (Official API)</option>
          </select>

          {aiConfig.provider === 'deepseek' && (
            <>
              <label htmlFor="ai-model" className="block eyebrow mb-1.5">Model</label>
              <select
                id="ai-model"
                value={aiConfig.model || 'deepseek-chat'}
                onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                className="input w-full text-xs px-2.5 py-2 mb-4"
              >
                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
              </select>
              <label htmlFor="ai-key" className="block eyebrow mb-1.5">DeepSeek API Key</label>
              <input
                id="ai-key"
                type="password"
                value={aiConfig.apiKey}
                onChange={e => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                className="input w-full text-xs px-2.5 py-2 mb-4 font-mono"
                placeholder="sk-..."
              />
              <p className="text-[10px] text-success mt-1 leading-relaxed">
                Your key stays in this tab and is sent through this site to DeepSeek for each request.
              </p>
            </>
          )}

          {aiConfig.provider === 'local' && (
            <p className="text-[10px] text-fg-faint mt-1 leading-relaxed">
              Uses a built-in rule-based NLP engine. No API keys required. Works offline.
              Understands mining engineering terms like bench height, haul road, slope angle, etc.
            </p>
          )}
        </div>
      )}
    </header>
  );
}
