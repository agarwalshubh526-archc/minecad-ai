'use client';

import React from 'react';
import type { GeometryData, AIConfig } from '@/types';

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
}: ToolbarProps) {
  const [showAiSettings, setShowAiSettings] = React.useState(false);

  return (
    <div className="h-11 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 gap-1 select-none relative z-50 overflow-x-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4 pr-4 border-r border-[#30363d] shrink-0">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-black">
          M
        </div>
        <span className="text-sm font-semibold text-[#e6edf3] tracking-wide hidden sm:inline">MineCAD AI</span>
      </div>

      {/* View Toggle */}
      <div className="flex bg-[#0d1117] rounded-md border border-[#30363d] overflow-hidden mr-2 shrink-0">
        <button
          className={`px-3 py-1 text-xs font-mono transition-colors ${activeView === '2d' ? 'bg-[#1f6feb] text-white' : 'text-[#8b949e] hover:text-white'}`}
          onClick={() => setActiveView('2d')}
        >
          2D
        </button>
        <button
          className={`px-3 py-1 text-xs font-mono transition-colors ${activeView === '3d' ? 'bg-[#1f6feb] text-white' : 'text-[#8b949e] hover:text-white'}`}
          onClick={() => setActiveView('3d')}
        >
          3D
        </button>
      </div>

      {/* 2D Drawing Sheet toggle */}
      {activeView === '2d' && setSheetMode && (
        <div className="flex items-center gap-1 mr-2 pl-2 border-l border-[#30363d] shrink-0">
          <button
            className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${sheetMode ? 'bg-[#1f6feb] text-white' : 'text-[#8b949e] hover:bg-[#21262d]'}`}
            onClick={() => setSheetMode(!sheetMode)}
            title="Toggle AutoCAD-style drawing sheet (frame, title block, north arrow, scale bar, legend)"
          >
            <span className="md:hidden">📜</span>
            <span className="hidden md:inline">Sheet</span>
          </button>
        </div>
      )}

      {/* 3D View controls */}
      {activeView === '3d' && (
        <div className="flex items-center gap-1 mr-2 pl-2 border-l border-[#30363d] shrink-0">
          <button
            className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${viewMode3D === 'solid' ? 'bg-[#238636] text-white' : 'text-[#8b949e] hover:bg-[#21262d]'}`}
            onClick={() => setViewMode3D('solid')}
            title="Solid view"
          >
            <span className="md:hidden">◼</span>
            <span className="hidden md:inline">Solid</span>
          </button>
          <button
            className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${viewMode3D === 'wireframe' ? 'bg-[#238636] text-white' : 'text-[#8b949e] hover:bg-[#21262d]'}`}
            onClick={() => setViewMode3D('wireframe')}
            title="Wireframe view"
          >
            <span className="md:hidden">△</span>
            <span className="hidden md:inline">Wire</span>
          </button>
          <div className="w-px h-5 bg-[#30363d] mx-1" />
          <button
            className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${showSectionView ? 'bg-[#da3633] text-white' : 'text-[#8b949e] hover:bg-[#21262d]'}`}
            onClick={() => setShowSectionView(!showSectionView)}
            title="Section view"
          >
            <span className="md:hidden">✂</span>
            <span className="hidden md:inline">Section</span>
          </button>
          {showSectionView && (
            <input
              type="range"
              min="-200"
              max="50"
              step="1"
              value={sectionHeight}
              onChange={e => setSectionHeight(Number(e.target.value))}
              className="w-20 h-1 accent-[#da3633]"
            />
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Status */}
      {isGenerating && (
        <div className="flex items-center gap-2 mr-3">
          <div className="w-2 h-2 rounded-full bg-[#f0883e] animate-pulse" />
          <span className="text-[10px] text-[#f0883e] font-mono">Generating...</span>
        </div>
      )}

      {/* Export & Survey Data buttons */}
      {geometry && (
        <div className="flex items-center gap-1 mr-2 pr-2 border-r border-[#30363d] shrink-0">
          <span className="text-[10px] text-[#484f58] mr-1 font-mono hidden md:inline">Export:</span>
          {['DXF', 'SVG', 'PDF', 'OBJ', 'STL'].map(fmt => (
            <button
              key={fmt}
              onClick={() => onExport(fmt.toLowerCase())}
              title={`Export ${fmt}`}
              className="px-1.5 md:px-2 py-0.5 text-[10px] text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded font-mono transition-colors"
            >
              {fmt}
            </button>
          ))}
          {Array.isArray(geometry.properties?.survey_stations) && (
            <button
              onClick={() => {
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
              }}
              className="px-2 py-0.5 text-[10px] text-[#36d399] hover:bg-[#052e16] rounded font-mono transition-colors border border-[#15803d]"
              title="Download Survey Stations CSV"
            >
              CSV<span className="hidden md:inline"> Data</span>
            </button>
          )}
        </div>
      )}

      {/* AI Config */}
      <button
        onClick={() => setShowAiSettings(!showAiSettings)}
        className={`px-2 py-1 text-[10px] rounded font-mono transition-colors flex items-center gap-1 shrink-0 ${
          showAiSettings ? 'bg-[#1f6feb] text-white' : 'text-[#8b949e] hover:bg-[#21262d]'
        }`}
      >
        <span>⚙️</span>
        <span className="hidden md:inline">AI: {aiConfig.provider}</span>
      </button>

      {/* AI Settings Dropdown */}
      {showAiSettings && (
        <div className="absolute top-full right-3 mt-1 w-[calc(100vw-1.5rem)] max-w-80 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl p-4 z-[100]">
          <h3 className="text-xs font-semibold text-[#e6edf3] mb-3">AI Configuration</h3>
          
          <label className="block text-[10px] text-[#8b949e] mb-1">Provider</label>
          <select
            value={aiConfig.provider}
            onChange={e => setAiConfig({ ...aiConfig, provider: e.target.value as AIConfig['provider'] })}
            className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 mb-3 focus:border-[#1f6feb] outline-none"
          >
            <option value="local">Local (Rule-Based NLP)</option>
            <option value="deepseek">DeepSeek AI (Official API)</option>
            <option value="ollama">Ollama (Local LLM)</option>
            <option value="huggingface">HuggingFace (Free API)</option>
          </select>

          {aiConfig.provider === 'deepseek' && (
            <>
              <label className="block text-[10px] text-[#8b949e] mb-1">Model</label>
              <select
                value={aiConfig.model || 'deepseek-chat'}
                onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 mb-3 focus:border-[#1f6feb] outline-none"
              >
                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                <option value="deepseek-coder">DeepSeek Coder</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
              </select>
              <label className="block text-[10px] text-[#8b949e] mb-1">DeepSeek API Key</label>
              <input
                type="password"
                value={aiConfig.apiKey}
                onChange={e => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 mb-3 focus:border-[#1f6feb] outline-none font-mono"
                placeholder="sk-..."
              />
              <label className="block text-[10px] text-[#8b949e] mb-1">API Base URL</label>
              <input
                value={aiConfig.baseUrl || 'https://api.deepseek.com'}
                onChange={e => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 mb-2 focus:border-[#1f6feb] outline-none font-mono text-[11px]"
                placeholder="https://api.deepseek.com"
              />
              <p className="text-[10px] text-[#36d399] mt-1">
                Integrated into CLI terminal. High accuracy mining CAD code generation & engineering math.
              </p>
            </>
          )}

          {aiConfig.provider === 'ollama' && (
            <>
              <label className="block text-[10px] text-[#8b949e] mb-1">Model</label>
              <select
                value={aiConfig.model}
                onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 mb-3 focus:border-[#1f6feb] outline-none"
              >
                <option value="llama3.1">Llama 3.1</option>
                <option value="deepseek-coder-v2">DeepSeek Coder V2</option>
                <option value="qwen2.5">Qwen 2.5</option>
                <option value="mistral">Mistral</option>
                <option value="gemma2">Gemma 2</option>
              </select>
              <label className="block text-[10px] text-[#8b949e] mb-1">Ollama URL</label>
              <input
                value={aiConfig.baseUrl}
                onChange={e => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 mb-3 focus:border-[#1f6feb] outline-none font-mono"
                placeholder="http://localhost:11434"
              />
            </>
          )}

          {aiConfig.provider === 'huggingface' && (
            <>
              <label className="block text-[10px] text-[#8b949e] mb-1">Model</label>
              <select
                value={aiConfig.model}
                onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 mb-3 focus:border-[#1f6feb] outline-none"
              >
                <option value="Qwen/Qwen2.5-Coder-32B-Instruct">Qwen 2.5 Coder 32B</option>
                <option value="meta-llama/Llama-3.1-70B-Instruct">Llama 3.1 70B</option>
                <option value="mistralai/Mixtral-8x7B-Instruct-v0.1">Mixtral 8x7B</option>
                <option value="google/gemma-2-27b-it">Gemma 2 27B</option>
              </select>
              <label className="block text-[10px] text-[#8b949e] mb-1">API Key (optional for free tier)</label>
              <input
                type="password"
                value={aiConfig.apiKey}
                onChange={e => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1.5 focus:border-[#1f6feb] outline-none font-mono"
                placeholder="hf_..."
              />
            </>
          )}

          {aiConfig.provider === 'local' && (
            <p className="text-[10px] text-[#484f58] mt-1">
              Uses a built-in rule-based NLP engine. No API keys required. Works offline.
              Understands mining engineering terms like bench height, haul road, slope angle, etc.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

