'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { AppState, ProjectFile, LayerInfo, GeometryData } from '@/types';
import type { MineTemplateType } from '@/components/LeftSidebar';
import Toolbar from '@/components/Toolbar';
import LeftSidebar, { TEMPLATES } from '@/components/LeftSidebar';
import RightSidebar from '@/components/RightSidebar';
import Canvas2D from '@/components/Canvas2D';
import Viewport3D from '@/components/Viewport3D';
import CommandLine from '@/components/CommandLine';
import PromptBox from '@/components/PromptBox';
import * as apiClient from '@/lib/apiClient';
import * as clientGeometry from '@/lib/geometryEngine';
import { exportPDF } from '@/lib/pdfExport';
import LegalFooter from '@/components/LegalFooter';
import OnboardingTour from '@/components/OnboardingTour';

export default function Home() {
  // App state
  const [activeView, setActiveView] = useState<'2d' | '3d'>('2d');
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectFile | null>(null);
  const [geometry, setGeometry] = useState<GeometryData | null>(null);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [aiConfig, setAiConfig] = useState<AppState['aiConfig']>({
    provider: 'local',
    model: 'llama3.1',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode3D, setViewMode3D] = useState<'solid' | 'wireframe'>('solid');
  const [showSectionView, setShowSectionView] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(0);
  const [commandHistory, setCommandHistory] = useState<string[]>([
    'System: MineCAD AI initialized.',
    'System: Ready to parse prompts. Select a template on the left to start or type a prompt below.',
  ]);

  // Sidebar toggles
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // Mobile slide-over drawers (closed by default; never rendered during SSR
  // beyond this so there's no hydration mismatch)
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  // Load a mining template to initialize the workspace
  const handleLoadTemplate = async (template: MineTemplateType) => {
    setIsGenerating(true);
    setCommandHistory((prev) => [...prev, `System: Loading template "${template.name}"...`]);

    try {
      let geom: GeometryData;
      
      if (aiConfig.provider !== 'local') {
        // Try backend direct generate
        try {
          const res = await apiClient.generateDirect(template.object_type, template.defaultParams);
          if (res.success) {
            geom = res.geometry;
            setCommandHistory((prev) => [...prev, 'Success: Loaded template from backend.']);
          } else {
            throw new Error(res.error);
          }
        } catch (err) {
          console.warn('Backend unavailable, falling back to client-side compiler:', err);
          geom = clientGeometry.generateGeometry(template.object_type, template.defaultParams);
          setCommandHistory((prev) => [...prev, 'System: Backend unavailable. Loaded via client-side preview engine.']);
        }
      } else {
        // Generate client-side
        geom = clientGeometry.generateGeometry(template.object_type, template.defaultParams);
        setCommandHistory((prev) => [...prev, 'Success: Loaded template via client-side engine.']);
      }

      // Create new project file
      const newProj: ProjectFile = {
        id: Math.random().toString(36).slice(2, 11),
        name: `${template.name} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        object_type: template.object_type,
        created_at: new Date().toISOString(),
        geometry: geom,
        properties: geom.properties,
      };

      setProjects((prev) => [newProj, ...prev]);
      setSelectedProject(newProj);
      setGeometry(geom);
      
      // Initialize layers list
      const layerList = geom.layers.map((l) => ({
        name: l.name,
        color: l.color,
        description: l.description,
        visible: true,
        locked: false,
      }));
      setLayers(layerList);

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setCommandHistory((prev) => [...prev, `Error: Failed to load template. ${msg}`]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate or modify drawing from prompt
  const handleGeneratePrompt = async (prompt: string) => {
    setIsGenerating(true);
    setCommandHistory((prev) => [...prev, `Command: ${prompt}`]);

    const activeType = selectedProject?.object_type || 'open_pit';
    const activeProps = selectedProject?.properties || {};

    try {
      let geom: GeometryData;
      let parsedType = activeType;
      let parsedParams = { ...activeProps };

      if (aiConfig.provider !== 'local') {
        // Run AI API call
        try {
          const res = await apiClient.generateFromPrompt(
            prompt,
            aiConfig.provider,
            aiConfig.model,
            aiConfig.baseUrl,
            aiConfig.apiKey,
            activeProps
          );

          if (res.success) {
            geom = res.geometry;
            parsedType = res.object_type;
            parsedParams = res.params;
            setCommandHistory((prev) => [
              ...prev,
              `Success: AI generated geometry. Parse method: ${res.parse_method}`,
            ]);
          } else {
            throw new Error(res.error);
          }
        } catch (err) {
          console.warn('AI API Call failed, trying client-side DeepSeek / fallback:', err);
          let clientParsed = null;
          if (aiConfig.provider === 'deepseek') {
            clientParsed = await clientGeometry.parseWithDeepSeekClient(
              prompt,
              aiConfig.apiKey,
              aiConfig.model || 'deepseek-chat',
              aiConfig.baseUrl || 'https://api.deepseek.com'
            );
          }
          if (!clientParsed) {
            clientParsed = clientGeometry.parsePromptLocal(prompt);
          }
          parsedType = clientParsed.object_type ?? activeType;
          parsedParams = { ...activeProps, ...clientParsed.params };
          geom = clientGeometry.generateGeometry(parsedType, parsedParams);
          setCommandHistory((prev) => [
            ...prev,
            'System: Fallback to client-side geometry parser completed.',
          ]);
        }
      } else {
        // Run client-side parsing (local NLP rules)
        // Check if edit command
        let editProps: Record<string, unknown> | null = null;
        const text = prompt.toLowerCase();
        
        // Simple edit checks in client
        if (text.includes('increase') || text.includes('raise') || text.includes('set') || text.includes('change') || text.includes('reduce') || text.includes('decrease') || text.includes('add') || text.includes('remove')) {
          const fieldMap: Record<string, string> = {
            'height': 'bench_height', 'width': 'bench_width', 'haul road': 'haul_road_width', 'slope': 'overall_slope', 'burden': 'burden', 'spacing': 'spacing', 'pillar': 'pillar_width', 'room': 'room_width'
          };
          const matches = text.match(/(\d+\.?\d*)/);
          const val = matches ? parseFloat(matches[1]) : null;

          const updated = { ...activeProps };
          let changed = false;

          for (const [kw, field] of Object.entries(fieldMap)) {
            if (text.includes(kw) && val !== null) {
              updated[field] = val;
              changed = true;
            }
          }

          if (text.includes('add') && text.includes('bench')) {
            updated.num_benches = (Number(updated.num_benches) || 5) + 1;
            changed = true;
          }
          if (text.includes('remove') && text.includes('bench')) {
            updated.num_benches = Math.max(1, (Number(updated.num_benches) || 5) - 1);
            changed = true;
          }
          if (text.includes('add') && text.includes('level')) {
            updated.num_levels = (Number(updated.num_levels) || 4) + 1;
            changed = true;
          }
          if (text.includes('remove') && text.includes('level')) {
            updated.num_levels = Math.max(1, (Number(updated.num_levels) || 4) - 1);
            changed = true;
          }

          if (changed) {
            editProps = updated;
          }
        }

        if (editProps) {
          parsedParams = editProps;
        } else {
          const clientParsed = clientGeometry.parsePromptLocal(prompt);
          parsedType = clientParsed.object_type ?? activeType;
          parsedParams = { ...activeProps, ...clientParsed.params };
        }

        geom = clientGeometry.generateGeometry(parsedType, parsedParams);
        setCommandHistory((prev) => [...prev, 'Success: Render updated local CAD design.']);
      }

      // Update active project
      const updatedProj: ProjectFile = {
        id: selectedProject?.id || Math.random().toString(36).slice(2, 11),
        name: selectedProject?.name || `Project ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        object_type: parsedType,
        created_at: selectedProject?.created_at || new Date().toISOString(),
        geometry: geom,
        properties: parsedParams,
      };

      if (selectedProject) {
        setProjects((prev) => prev.map((p) => (p.id === selectedProject.id ? updatedProj : p)));
      } else {
        setProjects((prev) => [updatedProj, ...prev]);
      }
      setSelectedProject(updatedProj);
      setGeometry(geom);

      // Merge layers (computed inside the updater to avoid stale-closure duplicates)
      setLayers((prev) => {
        const existingNames = new Set(prev.map((l) => l.name));
        const newLayers = geom.layers
          .filter((l) => !existingNames.has(l.name))
          .map((l) => ({
            name: l.name,
            color: l.color,
            description: l.description,
            visible: true,
            locked: false,
          }));
        return newLayers.length > 0 ? [...prev, ...newLayers] : prev;
      });

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setCommandHistory((prev) => [...prev, `Error: Prompt processing failed. ${msg}`]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Re-generate geometry when property values change in the sidebar panel.
  // Debounced (300ms trailing) so each keystroke doesn't regenerate and
  // reset the canvas view mid-edit.
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdateRef = useRef<{ project: ProjectFile; params: Record<string, unknown> } | null>(null);

  const applyPropertyUpdate = async (project: ProjectFile, newParams: Record<string, unknown>) => {
    try {
      let geom: GeometryData;

      if (aiConfig.provider !== 'local') {
        try {
          const res = await apiClient.generateDirect(project.object_type, newParams);
          if (res.success) {
            geom = res.geometry;
          } else {
            throw new Error(res.error);
          }
        } catch (err) {
          console.warn('Direct backend call failed, fallback to client-side compiler:', err);
          geom = clientGeometry.generateGeometry(project.object_type, newParams);
        }
      } else {
        geom = clientGeometry.generateGeometry(project.object_type, newParams);
      }

      const updatedProj: ProjectFile = {
        ...project,
        geometry: geom,
        properties: newParams,
      };

      setProjects((prev) => prev.map((p) => (p.id === project.id ? updatedProj : p)));
      setSelectedProject(updatedProj);
      setGeometry(geom);

    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProperties = (newParams: Record<string, unknown>) => {
    const project = selectedProject;
    if (!project) return;
    pendingUpdateRef.current = { project, params: newParams };
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      updateTimeoutRef.current = null;
      const pending = pendingUpdateRef.current;
      pendingUpdateRef.current = null;
      if (pending) applyPropertyUpdate(pending.project, pending.params);
    }, 300);
  };

  // Flush/cancel any pending debounced update on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  // Parse Command Line Console CLI inputs
  const handleCommandLineSubmit = async (cmdText: string) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;
    const args = trimmed.split(/\s+/);
    const cmd = args[0].toLowerCase();

    if (cmd === 'clear') {
      setCommandHistory([]);
      return;
    }

    if (cmd === 'help') {
      setCommandHistory((prev) => [
        ...prev,
        'Command: help',
        'Available CLI Console commands:',
        '  deepseek <query>          - Ask DeepSeek AI directly in terminal console',
        '  deepseek key <sk-...>     - Set DeepSeek API key & activate provider',
        '  set provider <name>       - Set active provider (deepseek|local|ollama|huggingface)',
        '  clear                     - Clear terminal console history',
        '  help                      - List available instructions',
        '  bench_height <number>     - Set bench height (open pit)',
        '  bench_width <number>      - Set bench width (open pit)',
        '  num_benches <number>      - Set number of benches (open pit)',
        '  room_width <number>       - Set room width (room & pillar)',
        '  pillar_width <number>     - Set pillar width (room & pillar)',
        '  burden <number>           - Set drill burden (blast pattern)',
        '  spacing <number>          - Set drill spacing (blast pattern)',
        '  add <bench|level|row>     - Add a structure parameter',
        '  remove <bench|level|row>  - Remove structure parameter',
        '  <natural language prompt> - Generate or modify active CAD geometry',
      ]);
      return;
    }

    // Direct DeepSeek terminal command handler
    if (cmd === 'deepseek' || cmd === '/deepseek') {
      if (args.length >= 3 && (args[1].toLowerCase() === 'key' || args[1].toLowerCase() === 'apikey')) {
        const key = args.slice(2).join(' ');
        setAiConfig((prev) => ({ ...prev, provider: 'deepseek', apiKey: key }));
        setCommandHistory((prev) => [
          ...prev,
          `Command: deepseek key ******`,
          `System: DeepSeek API Key updated and DeepSeek provider activated!`,
        ]);
        return;
      }

      if (args.length === 2 && args[1].toLowerCase() === 'activate') {
        setAiConfig((prev) => ({ ...prev, provider: 'deepseek' }));
        setCommandHistory((prev) => [
          ...prev,
          `Command: deepseek activate`,
          `System: Switched active AI provider to DeepSeek AI.`,
        ]);
        return;
      }

      const query = args.slice(1).join(' ');
      if (!query) {
        setCommandHistory((prev) => [
          ...prev,
          'Command: deepseek',
          'Usage: deepseek <query> (e.g. "deepseek explain bench design calculations")',
        ]);
        return;
      }

      setCommandHistory((prev) => [...prev, `Command: deepseek ${query}`, `System: DeepSeek AI generating response...`]);
      setIsGenerating(true);
      try {
        const res = await apiClient.chatWithDeepSeek(
          query,
          aiConfig.apiKey,
          aiConfig.model || 'deepseek-chat',
          aiConfig.baseUrl || 'https://api.deepseek.com'
        );

        if (res.success && res.response) {
          setCommandHistory((prev) => [...prev, `DeepSeek: ${res.response}`]);
        } else {
          // Direct browser fallback if backend endpoint is unavailable
          if (aiConfig.apiKey) {
            const url = (aiConfig.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '') + '/chat/completions';
            const browserRes = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiConfig.apiKey}`,
              },
              body: JSON.stringify({
                model: aiConfig.model || 'deepseek-chat',
                messages: [
                  {
                    role: 'system',
                    content: 'You are DeepSeek AI integrated into MineCAD AI Terminal Console. Assist mining engineers with concise calculations and answers.'
                  },
                  { role: 'user', content: query }
                ],
              }),
            });
            if (browserRes.ok) {
              const data = await browserRes.json();
              const txt = data.choices?.[0]?.message?.content || 'No response from DeepSeek API.';
              setCommandHistory((prev) => [...prev, `DeepSeek: ${txt}`]);
              return;
            }
          }
          setCommandHistory((prev) => [
            ...prev,
            `Error: DeepSeek terminal request failed. ${res.error || 'Please check your DeepSeek API Key in settings.'}`,
          ]);
        }
      } catch (err) {
        setCommandHistory((prev) => [...prev, `Error: DeepSeek terminal execution failed. ${err}`]);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Set provider command
    if (cmd === 'set' && args.length >= 3 && args[1].toLowerCase() === 'provider') {
      const p = args[2].toLowerCase();
      if (['local', 'deepseek', 'ollama', 'huggingface'].includes(p)) {
        setAiConfig((prev) => ({ ...prev, provider: p as AppState['aiConfig']['provider'] }));
        setCommandHistory((prev) => [...prev, `Command: set provider ${p}`, `System: Active AI provider switched to ${p.toUpperCase()}.`]);
        return;
      }
    }

    if (!selectedProject) {
      setCommandHistory((prev) => [...prev, `Error: Load a design template to use CLI properties.`]);
      return;
    }

    const currentParams = { ...selectedProject.properties };
    let changed = false;

    // Check single parameter setting
    if (args.length === 2) {
      const field = args[0].toLowerCase();
      const val = parseFloat(args[1]);

      if (!isNaN(val)) {
        // Map CLI commands to internal parameters
        const cliMap: Record<string, string> = {
          bench_height: 'bench_height',
          bench_width: 'bench_width',
          num_benches: 'num_benches',
          room_width: 'room_width',
          pillar_width: 'pillar_width',
          burden: 'burden',
          spacing: 'spacing',
          length: 'length',
          width: 'width',
          inclination: 'inclination',
          gradient: 'gradient',
        };

        const targetField = cliMap[field];
        if (targetField && targetField in currentParams) {
          currentParams[targetField] = val;
          changed = true;
          setCommandHistory((prev) => [...prev, `Command: set ${field} to ${val}`]);
        }
      }
    }

    // Check add/remove increments
    if (args.length === 2 && (cmd === 'add' || cmd === 'remove')) {
      const item = args[1].toLowerCase();
      const sign = cmd === 'add' ? 1 : -1;

      const incrementMap: Record<string, string> = {
        bench: 'num_benches',
        level: 'num_levels',
        row: 'num_rows',
        airway: 'num_airways',
        room: 'num_rooms_x',
      };

      const targetField = incrementMap[item];
      if (targetField && targetField in currentParams) {
        const val = Number(currentParams[targetField]) || 0;
        currentParams[targetField] = Math.max(1, val + sign);
        changed = true;
        setCommandHistory((prev) => [...prev, `Command: ${cmd} ${item}`]);
      }
    }

    if (changed) {
      handleUpdateProperties(currentParams);
    } else {
      // Treat other inputs as NL prompts
      handleGeneratePrompt(cmdText);
    }
  };


  // Export to CAD/mesh files
  const handleExport = async (format: string) => {
    if (!geometry) return;
    setCommandHistory((prev) => [...prev, `System: Formatting and generating ${format.toUpperCase()} export file...`]);

    try {
      if (aiConfig.provider !== 'local') {
        // Try backend export first
        try {
          const blob = await apiClient.exportFile(format, geometry);
          apiClient.downloadBlob(blob, `minecad_export.${format}`);
          setCommandHistory((prev) => [...prev, `Success: Exported minecad_export.${format} via backend.`]);
          return;
        } catch (err) {
          console.warn('Backend export failed, falling back to client-side SVG/OBJ/STL downloader:', err);
        }
      }

      // Client-side fallback exporter
      if (format === 'obj') {
        const data = clientGeometryExporterOBJ(geometry);
        apiClient.downloadText(data, 'minecad_export.obj', 'text/plain');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.obj (client-side).']);
      } else if (format === 'stl') {
        const data = clientGeometryExporterSTL(geometry);
        apiClient.downloadText(data, 'minecad_export.stl', 'application/octet-stream');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.stl (client-side).']);
      } else if (format === 'svg') {
        const data = clientGeometryExporterSVG(geometry);
        apiClient.downloadText(data, 'minecad_export.svg', 'image/svg+xml');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.svg (client-side).']);
      } else if (format === 'dxf') {
        const data = clientGeometryExporterDXF(geometry);
        apiClient.downloadText(data, 'minecad_export.dxf', 'application/dxf');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.dxf (client-side).']);
      } else if (format === 'pdf') {
        const blob = exportPDF(geometry);
        apiClient.downloadBlob(blob, 'minecad_export.pdf');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.pdf (client-side).']);
      } else {
        setCommandHistory((prev) => [...prev, `Error: Unknown export format "${format.toUpperCase()}".`]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setCommandHistory((prev) => [...prev, `Error: Export failed. ${msg}`]);
    }
  };

  // Client-side DXF exporter
  const clientGeometryExporterDXF = (geom: GeometryData) => {
    const lines = [
      '0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
    ];

    for (const prim of geom.primitives) {
      const layer = prim.layer || '0';
      const col = prim.color || 7;
      if (prim.type === 'line') {
        lines.push('0', 'LINE', '8', layer, '62', String(col));
        lines.push('10', String(prim.x1), '20', String(prim.y1), '30', '0.0');
        lines.push('11', String(prim.x2), '21', String(prim.y2), '31', '0.0');
      } else if (prim.type === 'polyline') {
        lines.push('0', 'LWPOLYLINE', '8', layer, '62', String(col));
        lines.push('90', String(prim.points.length), '70', prim.closed ? '1' : '0');
        for (const p of prim.points) {
          lines.push('10', String(p.x), '20', String(p.y));
        }
      } else if (prim.type === 'circle') {
        lines.push('0', 'CIRCLE', '8', layer, '62', String(col));
        lines.push('10', String(prim.cx), '20', String(prim.cy), '30', '0.0');
        lines.push('40', String(prim.r));
      } else if (prim.type === 'text') {
        lines.push('0', 'TEXT', '8', layer, '62', String(col));
        lines.push('10', String(prim.x), '20', String(prim.y), '30', '0.0');
        lines.push('40', String(prim.height || 2), '1', prim.text);
      }
    }

    lines.push('0', 'ENDSEC', '0', 'EOF');
    return lines.join('\n');
  };

  // Client-side SVG exporter
  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const clientGeometryExporterSVG = (geom: GeometryData) => {
    const { bounds } = geom;
    const margin = 20;
    // Guard against NaN/degenerate bounds so the viewBox stays valid
    const minX = Number.isFinite(bounds.minX) ? bounds.minX : -200;
    const maxX = Number.isFinite(bounds.maxX) ? bounds.maxX : 200;
    const minY = Number.isFinite(bounds.minY) ? bounds.minY : -200;
    const maxY = Number.isFinite(bounds.maxY) ? bounds.maxY : 200;
    const w = Math.max(maxX - minX, 1) + margin * 2;
    const h = Math.max(maxY - minY, 1) + margin * 2;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - margin} ${-maxY - margin} ${w} ${h}" width="800" height="600" style="background:#0d1117;">`
    ];

    const DXF_COLORS: Record<number, string> = {
      1: '#ff4d4d', 2: '#ffeb3b', 3: '#4caf50', 4: '#00bcd4',
      5: '#2196f3', 6: '#e91e63', 7: '#ffffff', 8: '#9e9e9e'
    };

    for (const prim of geom.primitives) {
      const col = DXF_COLORS[prim.color] || '#ffffff';
      if (prim.type === 'line') {
        parts.push(`<line x1="${prim.x1}" y1="${-prim.y1}" x2="${prim.x2}" y2="${-prim.y2}" stroke="${col}" stroke-width="0.8" />`);
      } else if (prim.type === 'polyline') {
        const pts = prim.points.map(p => `${p.x},${-p.y}`).join(' ');
        const tag = prim.closed ? 'polygon' : 'polyline';
        const fill = prim.closed ? `${col}15` : 'none';
        parts.push(`<${tag} points="${pts}" stroke="${col}" stroke-width="0.8" fill="${fill}" />`);
      } else if (prim.type === 'circle') {
        parts.push(`<circle cx="${prim.cx}" cy="${-prim.cy}" r="${prim.r}" stroke="${col}" stroke-width="0.8" fill="none" />`);
      } else if (prim.type === 'text') {
        parts.push(`<text x="${prim.x}" y="${-prim.y}" fill="${col}" font-size="${prim.height}" font-family="monospace">${escapeXml(prim.text)}</text>`);
      } else if (prim.type === 'dimension') {
        parts.push(`<line x1="${prim.x1}" y1="${-prim.y1}" x2="${prim.x2}" y2="${-prim.y2}" stroke="${col}" stroke-width="0.5" stroke-dasharray="2,2" />`);
      }
    }
    parts.push('</svg>');
    return parts.join('\n');
  };

  // Client-side OBJ exporter
  const clientGeometryExporterOBJ = (geom: GeometryData) => {
    const lines = ['# MineCAD AI - Client OBJ Export', ''];
    let vOffset = 0;
    for (const mesh of geom.meshes) {
      lines.push(`o ${mesh.name}`);
      for (const v of mesh.vertices) {
        lines.push(`v ${v[0].toFixed(4)} ${v[2].toFixed(4)} ${(-v[1]).toFixed(4)}`);
      }
      for (const face of mesh.indices) {
        lines.push(`f ${face[0] + 1 + vOffset} ${face[1] + 1 + vOffset} ${face[2] + 1 + vOffset}`);
      }
      vOffset += mesh.vertices.length;
      lines.push('');
    }
    return lines.join('\n');
  };

  // Client-side STL exporter
  const clientGeometryExporterSTL = (geom: GeometryData) => {
    const lines = ['solid MineCAD_AI'];
    for (const mesh of geom.meshes) {
      const v = mesh.vertices;
      for (const face of mesh.indices) {
        const v0 = v[face[0]], v1 = v[face[1]], v2 = v[face[2]];
        lines.push('  facet normal 0.000000 0.000000 0.000000');
        lines.push('    outer loop');
        lines.push(`      vertex ${v0[0].toFixed(6)} ${v0[2].toFixed(6)} ${(-v0[1]).toFixed(6)}`);
        lines.push(`      vertex ${v1[0].toFixed(6)} ${v1[2].toFixed(6)} ${(-v1[1]).toFixed(6)}`);
        lines.push(`      vertex ${v2[0].toFixed(6)} ${v2[2].toFixed(6)} ${(-v2[1]).toFixed(6)}`);
        lines.push('    endloop');
        lines.push('  endfacet');
      }
    }
    lines.push('endsolid MineCAD_AI');
    return lines.join('\n');
  };

  // Switch project files from sidebar selection
  const handleSelectProject = (proj: ProjectFile) => {
    setSelectedProject(proj);
    setGeometry(proj.geometry);
    if (proj.geometry) {
      setLayers(
        proj.geometry.layers.map((l) => ({
          name: l.name,
          color: l.color,
          description: l.description,
          visible: true,
          locked: false,
        }))
      );
    }
    setCommandHistory((prev) => [...prev, `System: Loaded workspace "${proj.name}".`]);
  };

  // Auto-load open pit template on first load
  useEffect(() => {
    const defaultTemplate = TEMPLATES.find((t) => t.id === 'open_pit');
    if (defaultTemplate) {
      handleLoadTemplate(defaultTemplate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed 3 sample projects on first visit (once, persisted via localStorage)
  useEffect(() => {
    try {
      if (localStorage.getItem('minecad-samples-seeded')) return;
      const samples: Array<{ name: string; object_type: string; params: Record<string, unknown> }> = [
        { name: 'Sample: Open Pit Copper', object_type: 'open_pit',
          params: { bench_height: 10, bench_width: 8, num_benches: 6, pit_length: 400, pit_width: 250, haul_road_width: 24, overall_slope: 50, batter_angle: 72 } },
        { name: 'Sample: Room & Pillar Coal', object_type: 'room_and_pillar',
          params: { room_width: 6, pillar_width: 9, num_rooms_x: 6, num_rooms_y: 4, room_height: 3, entry_width: 5 } },
        { name: 'Sample: Longwall Panel', object_type: 'longwall_panel',
          params: { face_width: 180, panel_length: 600, seam_height: 3.2, num_supports: 120, shearer_position: 65 } },
      ];
      const seeded: ProjectFile[] = samples.map((s) => {
        const geom = clientGeometry.generateGeometry(s.object_type, s.params);
        return {
          id: `sample-${s.object_type}`,
          name: s.name,
          object_type: s.object_type,
          created_at: new Date().toISOString(),
          geometry: geom,
          properties: geom.properties,
        };
      });
      setProjects((prev) => [...seeded, ...prev]);
      localStorage.setItem('minecad-samples-seeded', '1');
    } catch (e) {
      console.warn('Sample seeding failed:', e);
    }
  }, []);

  return (
    <div className="h-dvh w-screen flex flex-col overflow-hidden bg-[#0d1117] text-[#e6edf3]">
      {/* Top Toolbar */}
      <Toolbar
        activeView={activeView}
        setActiveView={setActiveView}
        viewMode3D={viewMode3D}
        setViewMode3D={setViewMode3D}
        showSectionView={showSectionView}
        setShowSectionView={setShowSectionView}
        sectionHeight={sectionHeight}
        setSectionHeight={setSectionHeight}
        geometry={geometry}
        onExport={handleExport}
        aiConfig={aiConfig}
        setAiConfig={setAiConfig}
        isGenerating={isGenerating}
      />

      {/* Main workspace layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar — in-flow 3-pane on md+, hidden on mobile (see drawer below) */}
        <div className="hidden md:flex shrink-0 flex-col">
          <LeftSidebar
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={handleSelectProject}
            onLoadTemplate={handleLoadTemplate}
            collapsed={leftCollapsed}
            setCollapsed={setLeftCollapsed}
          />
        </div>

        {/* Mobile drawer: project files / templates */}
        {leftDrawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setLeftDrawerOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-80 flex-col bg-[#0d1117] border-r border-[#30363d] shadow-2xl md:hidden">
              <LeftSidebar
                projects={projects}
                selectedProject={selectedProject}
                onSelectProject={(p) => { handleSelectProject(p); setLeftDrawerOpen(false); }}
                onLoadTemplate={(t) => { handleLoadTemplate(t); setLeftDrawerOpen(false); }}
                collapsed={false}
                setCollapsed={() => setLeftDrawerOpen(false)}
              />
            </div>
          </>
        )}

        {/* Center Viewports + CLI / AI Box */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] min-w-0">
          {/* Canvas area */}
          <div className="flex-1 relative bg-[#0d1117] border-b border-[#30363d] min-h-[280px]">
            {activeView === '2d' ? (
              <Canvas2D
                geometry={geometry}
                layers={layers}
                fitKey={selectedProject ? `${selectedProject.id}:${selectedProject.object_type}` : null}
              />
            ) : (
              <Viewport3D
                geometry={geometry}
                viewMode={viewMode3D}
                showSectionView={showSectionView}
                sectionHeight={sectionHeight}
              />
            )}
          </div>

          {/* Bottom Console CLI Terminal */}
          <CommandLine
            history={commandHistory}
            onCommandSubmit={handleCommandLineSubmit}
            activeProvider={aiConfig.provider}
          />

          {/* AI Prompter */}
          <PromptBox
            onGenerate={handleGeneratePrompt}
            isGenerating={isGenerating}
          />
        </div>

        {/* Right Properties Panel — in-flow 3-pane on md+, hidden on mobile */}
        <div className="hidden md:flex shrink-0 flex-col">
          <RightSidebar
            geometry={geometry}
            layers={layers}
            setLayers={setLayers}
            onUpdateParams={handleUpdateProperties}
            collapsed={rightCollapsed}
            setCollapsed={setRightCollapsed}
          />
        </div>

        {/* Mobile drawer: properties / layers */}
        {rightDrawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setRightDrawerOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-80 flex-col bg-[#0d1117] border-l border-[#30363d] shadow-2xl md:hidden">
              <RightSidebar
                geometry={geometry}
                layers={layers}
                setLayers={setLayers}
                onUpdateParams={handleUpdateProperties}
                collapsed={false}
                setCollapsed={() => setRightDrawerOpen(false)}
              />
            </div>
          </>
        )}

        {/* Floating mobile drawer toggles */}
        <button
          onClick={() => {
            if (!leftDrawerOpen) setLeftCollapsed(false);
            setLeftDrawerOpen((v) => !v);
          }}
          className="md:hidden fixed top-14 left-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#161b22] border border-[#30363d] text-lg text-[#e6edf3] shadow-lg active:bg-[#21262d]"
          title="Projects & templates"
          aria-label={leftDrawerOpen ? 'Close projects panel' : 'Open projects and templates'}
        >
          {leftDrawerOpen ? '✕' : '☰'}
        </button>
        <button
          onClick={() => {
            if (!rightDrawerOpen) setRightCollapsed(false);
            setRightDrawerOpen((v) => !v);
          }}
          className="md:hidden fixed top-14 right-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#161b22] border border-[#30363d] text-lg text-[#e6edf3] shadow-lg active:bg-[#21262d]"
          title="Properties & layers"
          aria-label={rightDrawerOpen ? 'Close properties panel' : 'Open properties and layers'}
        >
          {rightDrawerOpen ? '✕' : '🎚️'}
        </button>
      </div>
      <LegalFooter />
      <OnboardingTour />
    </div>
  );
}
