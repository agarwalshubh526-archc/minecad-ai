'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { AppState, ProjectFile, LayerInfo, GeometryData, SceneObject } from '@/types';
import type { MineTemplateType } from '@/components/LeftSidebar';
import Toolbar from '@/components/Toolbar';
import LeftSidebar from '@/components/LeftSidebar';
import RightSidebar from '@/components/RightSidebar';
import Canvas2D from '@/components/Canvas2D';
// three.js (~600 KB) is heavy — load the 3D viewport only when first needed
// instead of paying its download + compile cost on every initial page load.
const Viewport3D = dynamic(() => import('@/components/Viewport3D'), { ssr: false });
import CommandLine from '@/components/CommandLine';
import PromptBox from '@/components/PromptBox';
import * as apiClient from '@/lib/apiClient';
import * as clientGeometry from '@/lib/geometryEngine';
import { exportPDF } from '@/lib/pdfExport';
import { exportDXF, exportSVG, exportOBJ, exportSTL } from '@/lib/cadExport';
import { buildSheetFrame } from '@/lib/sheetFrame';
import { isProjectFile, loadWorkspace, saveWorkspace } from '@/lib/projectStore';
import { importSurveyCsv } from '@/lib/surveyImport';
import { combineScene, createSceneObject, nextObjectOrigin, sceneFromProject } from '@/lib/sceneModel';
import { planSceneLocal, type ScenePlan } from '@/lib/scenePlanner';
import LegalFooter from '@/components/LegalFooter';
import OnboardingTour from '@/components/OnboardingTour';

function layersForGeometry(geometry: GeometryData, previous: LayerInfo[] = []): LayerInfo[] {
  const byName = new Map<string, LayerInfo>();
  const add = (name: string, color: number, description: string) => {
    if (!byName.has(name)) {
      const existing = previous.find(l => l.name === name);
      byName.set(name, { name, color, description, visible: existing?.visible ?? true, locked: false });
    }
  };
  for (const layer of geometry.layers) add(layer.name, layer.color, layer.description);
  for (const mesh of geometry.meshes) if (mesh.layer) add(mesh.layer, 7, '3D geometry');
  return [...byName.values()];
}

function withScene(project: ProjectFile): ProjectFile {
  if (project.scene) return project;
  const scene = sceneFromProject(project);
  if (!scene.length) return { ...project, scene: [] };
  const geometry = combineScene(scene);
  return { ...project, scene, geometry, properties: geometry.properties };
}

export default function Home() {
  // App state
  const [activeView, setActiveView] = useState<'2d' | '3d'>('2d');
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectFile | null>(null);
  const [geometry, setGeometry] = useState<GeometryData | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [sceneFeedback, setSceneFeedback] = useState<string[]>([]);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const operationIdRef = useRef(0);
  const editHistory = useRef<Record<string, { past: ProjectFile[]; future: ProjectFile[] }>>({});
  const [, setHistoryRevision] = useState(0);
  const recordEdit = (project: ProjectFile) => {
    const entry = editHistory.current[project.id] ?? { past: [], future: [] };
    entry.past.push(project);
    if (entry.past.length > 30) entry.past.shift();
    entry.future = [];
    editHistory.current[project.id] = entry;
    setHistoryRevision(v => v + 1);
  };
  const restoreEdit = (direction: 'undo' | 'redo') => {
    if (!selectedProject) return;
    const entry = editHistory.current[selectedProject.id];
    if (!entry) return;
    const source = direction === 'undo' ? entry.past : entry.future;
    const target = direction === 'undo' ? entry.future : entry.past;
    const previous = source.pop();
    if (!previous) return;
    target.push(selectedProject);
    setProjects(items => items.map(p => p.id === previous.id ? previous : p));
    setSelectedProject(previous);
    setGeometry(previous.geometry);
    setSelectedObjectId(sceneFromProject(previous)[0]?.id ?? null);
    setLayers(previous.geometry ? layersForGeometry(previous.geometry) : []);
    setHistoryRevision(v => v + 1);
  };
  const [aiConfig, setAiConfig] = useState<AppState['aiConfig']>({
    provider: 'local',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  // v2 parser confirmation note shown in PromptBox (auto-dismisses there)
  const [parseNote, setParseNote] = useState<{ id: number; text: string } | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [generationMethod, setGenerationMethod] = useState('Local rule-based geometry');
  // AutoCAD-style drawing sheet around the 2D view (default ON)
  const [sheetMode, setSheetMode] = useState(false);
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
  const activeScene = sceneFromProject(selectedProject);
  const selectedObject = activeScene.find(item => item.id === selectedObjectId) ?? activeScene[0] ?? null;

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setLeftDrawerOpen(false); setRightDrawerOpen(false); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  // Load a mining template to initialize the workspace
  const handleLoadTemplate = async (template: MineTemplateType) => {
    const operationId = ++operationIdRef.current;
    setIsGenerating(true);
    setGenerationError('');
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

      if (operationId !== operationIdRef.current) return;
      const sceneObject: SceneObject = {
        id: crypto.randomUUID(), name: template.name, object_type: template.object_type,
        params: geom.properties, origin: { x: 0, y: 0 }, geometry: geom,
      };
      const sceneGeometry = combineScene([sceneObject]);
      // Create new project file
      const newProj: ProjectFile = {
        id: Math.random().toString(36).slice(2, 11),
        name: `${template.name} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        object_type: template.object_type,
        created_at: new Date().toISOString(),
        geometry: sceneGeometry,
        properties: sceneGeometry.properties,
        scene: [sceneObject],
      };

      setProjects((prev) => [newProj, ...prev]);
      setSelectedProject(newProj);
      setGeometry(sceneGeometry);
      setSelectedObjectId(sceneObject.id);
      setSceneFeedback(['Template dimensions are assumptions. Edit an object in the Inspector or describe a change.',
        ...(Array.isArray(geom.properties.design_warnings) ? geom.properties.design_warnings as string[] : [])]);
      setGenerationMethod('Template geometry');
      
      // Initialize layers list
      setLayers(layersForGeometry(sceneGeometry));

    } catch (e) {
      if (operationId !== operationIdRef.current) return;
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setGenerationError(msg);
      setCommandHistory((prev) => [...prev, `Error: Failed to load template. ${msg}`]);
    } finally {
      if (operationId === operationIdRef.current) setIsGenerating(false);
    }
  };

  // Generate or modify drawing from prompt
  const handleGeneratePrompt = async (prompt: string) => {
    const operationId = ++operationIdRef.current;
    setIsGenerating(true);
    setGenerationError('');
    setCommandHistory((prev) => [...prev, `Command: ${prompt}`]);
    try {
      const plan: ScenePlan = aiConfig.provider === 'deepseek'
        ? await apiClient.planSceneWithDeepSeek(prompt, aiConfig.apiKey, aiConfig.model)
        : planSceneLocal(prompt);
      if (operationId !== operationIdRef.current) return;
      if (plan.unsupported.length) throw new Error(`Not supported yet: ${plan.unsupported.join(', ')}. No partial design was created.`);
      const editTarget = selectedObject;
      const isEditPhrase = /^(?:add|remove|increase|decrease|reduce|set|change|make|widen|deepen|raise|lower)\b/i.test(prompt);
      const editParams = aiConfig.provider === 'local' && editTarget && isEditPhrase &&
        (plan.objects.length === 0 || (plan.objects.length === 1 && plan.objects[0].object_type === editTarget.object_type))
        ? clientGeometry.parseEditCommand(prompt, { ...editTarget.params, _object_type: editTarget.object_type }) : null;
      const isNewProject = !selectedProject || (plan.action === 'replace' && !editParams);
      if (editTarget?.params.data_source && (editParams || !plan.objects.length) && !isNewProject) {
        throw new Error('Imported survey points are read-only. Select another component to edit.');
      }
      if (selectedProject?.properties.data_source && !isNewProject && (editParams || !plan.objects.length)) {
        throw new Error('Imported survey points are read-only. Add a supported design component or start a new project with “Create …”.');
      }
      let scene = isNewProject ? [] as SceneObject[] : sceneFromProject(selectedProject);
      let selectedId: string | null = null;
      if (!plan.objects.length || editParams) {
        const current = scene.find(item => item.id === selectedObjectId) ?? scene[0];
        if (!current || aiConfig.provider !== 'local') throw new Error('Name a supported mine component, or select an object and describe a parameter change.');
        const edited = editParams ?? clientGeometry.parseEditCommand(prompt, { ...current.params, _object_type: current.object_type });
        if (!edited) throw new Error('I could not identify a supported component or parameter change.');
        const params = { ...edited };
        if (/\bslope\b/i.test(prompt)) params._design_driver = 'overall_slope';
        if (/\bbench\s+width\b/i.test(prompt)) params._design_driver = 'bench_width';
        const replacement = { ...createSceneObject(current.object_type, params, current.origin), id: current.id, name: current.name };
        scene = scene.map(item => item.id === current.id ? replacement : item);
        selectedId = current.id;
      } else {
        if (plan.objects.length > 8) throw new Error('A prompt can add at most eight mine components.');
        for (const request of plan.objects) {
          const target = plan.action === 'add' && !/\badd\s+another\b/i.test(prompt)
            ? scene.find(item => item.object_type === request.object_type) : undefined;
          if (target?.params.data_source) throw new Error('Imported survey points cannot be regenerated. Add another component instead.');
          const params = { ...target?.params, ...request.params };
          if (target?.object_type === 'conveyor' && typeof request.params.length === 'number' &&
            request.params.end_x == null && request.params.end_y == null) {
            const sx = Number(params.start_x ?? 0), sy = Number(params.start_y ?? 0);
            const dx = Number(target.params.end_x ?? 200) - sx, dy = Number(target.params.end_y ?? 0) - sy;
            const oldLength = Math.hypot(dx, dy) || 1;
            params.end_x = sx + dx * request.params.length / oldLength;
            params.end_y = sy + dy * request.params.length / oldLength;
          }
          if (request.params.overall_slope != null) params._design_driver = 'overall_slope';
          else if (request.params.bench_width != null) params._design_driver = 'bench_width';
          const fresh = createSceneObject(request.object_type, params);
          const item = target
            ? { ...fresh, id: target.id, name: target.name, origin: target.origin }
            : { ...fresh, origin: nextObjectOrigin(scene, fresh.geometry) };
          scene = target ? scene.map(existing => existing.id === target.id ? item : existing) : [...scene, item];
          selectedId = item.id;
        }
      }
      if (scene.length > 16) throw new Error('This project has reached its 16-component limit.');
      const combined = combineScene(scene);
      const warnings = scene.flatMap(item => Array.isArray(item.geometry.properties.design_warnings)
        ? item.geometry.properties.design_warnings as string[] : []);
      const updatedProj: ProjectFile = {
        id: isNewProject ? crypto.randomUUID() : selectedProject!.id,
        name: isNewProject ? (scene.length > 1 ? 'Mine layout' : scene[0]?.name ?? 'Mine layout') : selectedProject!.name,
        object_type: scene.length === 1 ? scene[0].object_type : 'mine_layout',
        created_at: isNewProject ? new Date().toISOString() : selectedProject!.created_at,
        scene, geometry: combined, properties: combined.properties,
      };
      if (!isNewProject && selectedProject) {
        recordEdit(selectedProject);
        setProjects((prev) => prev.map((p) => (p.id === selectedProject.id ? updatedProj : p)));
      } else {
        setProjects((prev) => [updatedProj, ...prev]);
      }
      setSelectedProject(updatedProj);
      setGeometry(combined);
      setSelectedObjectId(selectedId);
      setSceneFeedback([...plan.assumptions,
        ...(scene.some(item => item.params.data_source) && scene.length > 1
          ? ['Imported survey stations are reference points; new geometry is not fitted to measured terrain or geology.'] : []),
        ...warnings]);
      setGenerationMethod(aiConfig.provider === 'deepseek' ? 'DeepSeek scene plan + parametric geometry' : 'Local scene plan + parametric geometry');
      setParseNote({ id: Date.now(), text: plan.interpretation });
      setLayers(prev => layersForGeometry(combined, prev));
      setCommandHistory(prev => [...prev, `Success: ${scene.length} component(s) in ${updatedProj.name}.`]);

    } catch (e) {
      if (operationId !== operationIdRef.current) return;
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setGenerationError(msg);
      setCommandHistory((prev) => [...prev, `Error: Prompt processing failed. ${msg}`]);
    } finally {
      if (operationId === operationIdRef.current) setIsGenerating(false);
    }
  };

  // Re-generate geometry when property values change in the sidebar panel.
  // Debounced (300ms trailing) so each keystroke doesn't regenerate and
  // reset the canvas view mid-edit.
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdateRef = useRef<{ project: ProjectFile; objectId: string; params: Record<string, unknown> } | null>(null);

  const applyPropertyUpdate = async (project: ProjectFile, objectId: string, newParams: Record<string, unknown>) => {
    const operationId = operationIdRef.current;
    try {
      const scene = sceneFromProject(project);
      const current = scene.find(item => item.id === objectId);
      if (!current) return;
      const replacement = { ...createSceneObject(current.object_type, newParams, current.origin), id: current.id, name: current.name };
      const updatedScene = scene.map(item => item.id === objectId ? replacement : item);
      const geom = combineScene(updatedScene);
      if (operationId !== operationIdRef.current) return;
      const updatedProj: ProjectFile = {
        ...project,
        scene: updatedScene,
        geometry: geom,
        properties: geom.properties,
      };

      recordEdit(project);
      setProjects((prev) => prev.map((p) => (p.id === project.id ? updatedProj : p)));
      setSelectedProject(updatedProj);
      setGeometry(geom);
      setLayers(prev => layersForGeometry(geom, prev));

    } catch (e) {
      console.error(e);
      if (operationId === operationIdRef.current) setGenerationError(e instanceof Error ? e.message : 'Could not update the design.');
    }
  };

  const handleUpdateProperties = (newParams: Record<string, unknown>) => {
    const project = selectedProject;
    if (!project || !selectedObject) return;
    if (selectedObject.params.data_source) return;
    operationIdRef.current++;
    setIsGenerating(false);
    pendingUpdateRef.current = { project, objectId: selectedObject.id, params: newParams };
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      updateTimeoutRef.current = null;
      const pending = pendingUpdateRef.current;
      pendingUpdateRef.current = null;
      if (pending) applyPropertyUpdate(pending.project, pending.objectId, pending.params);
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
        '  set provider <name>       - Set active provider (deepseek|local)',
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
      if (['local', 'deepseek'].includes(p)) {
        setAiConfig((prev) => ({ ...prev, provider: p as AppState['aiConfig']['provider'] }));
        setCommandHistory((prev) => [...prev, `Command: set provider ${p}`, `System: Active AI provider switched to ${p.toUpperCase()}.`]);
        return;
      }
    }

    const currentParams = { ...selectedObject?.params };
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
        if (selectedObject && targetField && targetField in currentParams) {
          currentParams[targetField] = val;
          if (targetField === 'bench_width') currentParams._design_driver = 'bench_width';
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
      if (selectedObject && targetField && targetField in currentParams) {
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

    // Drawing-sheet chrome (frame, title block, north arrow, scale bar) is
    // included in the 2D vector exports when sheet mode is ON.
    const hiddenLayers = new Set(layers.filter(l => !l.visible).map(l => l.name));
    let exportGeom: GeometryData = {
      ...geometry,
      primitives: geometry.primitives.filter(p => !hiddenLayers.has(p.layer)),
      meshes: geometry.meshes.filter(m => !m.layer || !hiddenLayers.has(m.layer)),
    };
    if (sheetMode && (format === 'svg' || format === 'pdf')) {
      const frame = buildSheetFrame(geometry, {
        projectName: selectedProject?.name ?? 'Untitled',
        objectType: selectedProject?.object_type ?? '',
      });
      exportGeom = {
        ...geometry,
          primitives: [...exportGeom.primitives, ...frame.primitives],
        bounds: frame.bounds,
      };
    }

    try {
      try {
        const blob = await apiClient.exportFile(format, exportGeom);
        apiClient.downloadBlob(blob, `minecad_export.${format}`);
        setCommandHistory((prev) => [...prev, `Success: Exported minecad_export.${format}.`]);
        return;
      } catch (err) {
        console.warn('Export API unavailable; using offline exporter:', err);
      }

      // All formats remain available while offline.
      if (format === 'obj') {
        const data = exportOBJ(exportGeom);
        apiClient.downloadText(data, 'minecad_export.obj', 'text/plain');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.obj (client-side).']);
      } else if (format === 'stl') {
        const data = exportSTL(exportGeom);
        apiClient.downloadText(data, 'minecad_export.stl', 'application/octet-stream');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.stl (client-side).']);
      } else if (format === 'svg') {
        const data = exportSVG(exportGeom);
        apiClient.downloadText(data, 'minecad_export.svg', 'image/svg+xml');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.svg (client-side).']);
      } else if (format === 'dxf') {
        const data = exportDXF(exportGeom);
        apiClient.downloadText(data, 'minecad_export.dxf', 'application/dxf');
        setCommandHistory((prev) => [...prev, 'Success: Exported minecad_export.dxf (client-side).']);
      } else if (format === 'pdf') {
        const blob = exportPDF(exportGeom);
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

  // Switch project files from sidebar selection
  const handleSelectProject = (proj: ProjectFile) => {
    proj = withScene(proj);
    operationIdRef.current++;
    setIsGenerating(false);
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    pendingUpdateRef.current = null;
    setSelectedProject(proj);
    setProjects(prev => prev.map(item => item.id === proj.id ? proj : item));
    setSelectedObjectId(sceneFromProject(proj)[0]?.id ?? null);
    setSceneFeedback([]);
    setGeometry(proj.geometry);
    if (proj.geometry) {
      setLayers(layersForGeometry(proj.geometry));
    }
    setCommandHistory((prev) => [...prev, `System: Loaded workspace "${proj.name}".`]);
  };

  const handleSelectSceneObject = (id: string) => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    pendingUpdateRef.current = null;
    setSelectedObjectId(id);
  };

  const handleMoveSceneObject = (id: string, x: number, y: number) => {
    if (!selectedProject || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (sceneFromProject(selectedProject).find(item => item.id === id)?.params.data_source) return;
    operationIdRef.current++;
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    pendingUpdateRef.current = null;
    const scene = sceneFromProject(selectedProject).map(item => item.id === id ? { ...item, origin: { x, y } } : item);
    const combined = combineScene(scene);
    const updated = { ...selectedProject, scene, geometry: combined, properties: combined.properties };
    recordEdit(selectedProject);
    setProjects(prev => prev.map(project => project.id === updated.id ? updated : project));
    setSelectedProject(updated);
    setGeometry(combined);
    setLayers(prev => layersForGeometry(combined, prev));
  };

  const handleDeleteSceneObject = (id: string) => {
    if (!selectedProject) return;
    operationIdRef.current++;
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    pendingUpdateRef.current = null;
    const scene = sceneFromProject(selectedProject).filter(item => item.id !== id);
    const combined = combineScene(scene);
    const updated = { ...selectedProject, scene, geometry: combined, properties: combined.properties,
      object_type: scene.length === 1 ? scene[0].object_type : 'mine_layout' };
    recordEdit(selectedProject);
    setProjects(prev => prev.map(project => project.id === updated.id ? updated : project));
    setSelectedProject(updated);
    setGeometry(combined);
    setSelectedObjectId(scene[0]?.id ?? null);
    setLayers(layersForGeometry(combined));
  };

  const handleRenameProject = (project: ProjectFile, rawName: string) => {
    const name = rawName.trim().slice(0, 120);
    if (!name || name === project.name) return;
    const updated = { ...project, name };
    setProjects(prev => prev.map(p => p.id === project.id ? updated : p));
    if (selectedProject?.id === project.id) setSelectedProject(updated);
  };

  const handleDuplicateProject = (project: ProjectFile) => {
    const copy = { ...project, id: crypto.randomUUID(), name: `${project.name} copy`, created_at: new Date().toISOString() };
    setProjects(prev => [copy, ...prev]);
    handleSelectProject(copy);
  };

  const handleDeleteProject = (project: ProjectFile) => {
    if (!window.confirm(`Delete "${project.name}" from this browser? Download a project file first if you need a backup.`)) return;
    if (selectedProject?.id === project.id) {
      operationIdRef.current++;
      setIsGenerating(false);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      pendingUpdateRef.current = null;
    }
    const remaining = projects.filter(p => p.id !== project.id);
    setProjects(remaining);
    if (selectedProject?.id === project.id) {
      const next = remaining[0] || null;
      setSelectedProject(next);
      setSelectedObjectId(sceneFromProject(next)[0]?.id ?? null);
      setGeometry(next?.geometry || null);
      setLayers(next?.geometry ? layersForGeometry(next.geometry) : []);
    }
  };

  const handleDownloadProject = (project: ProjectFile) => {
    const filename = `${project.name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'minecad-project'}.minecad.json`;
    apiClient.downloadText(JSON.stringify({ version: 1, project }, null, 2), filename, 'application/json');
  };

  const handleImportProject = async (file: File) => {
    try {
      if (file.size > 25_000_000) throw new Error('Project file exceeds the 25 MB import limit.');
      const data = JSON.parse(await file.text());
      const incoming = data.project || data;
      if (!isProjectFile(incoming)) throw new Error('This is not a MineCAD project file.');
      const project = withScene({ ...incoming, id: crypto.randomUUID(), name: incoming.name.slice(0, 120), created_at: new Date().toISOString() });
      setProjects(prev => [project, ...prev]);
      handleSelectProject(project);
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not import the project.');
    }
  };

  const handleImportSurvey = async (file: File) => {
    try {
      if (file.size > 500_000) throw new Error('Survey CSV exceeds the 500 KB import limit.');
      const project = withScene(importSurveyCsv(await file.text(), file.name));
      setProjects(prev => [project, ...prev]);
      handleSelectProject(project);
      setWorkspaceError('');
      setGenerationMethod('Imported survey CSV (unverified)');
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Could not import the survey CSV.');
    }
  };

  // Restore real project data, including geometry. Seed demonstrations only on
  // the first visit; the earlier sample flag caused them to vanish on reload.
  useEffect(() => {
    let cancelled = false;
    const seed = () => {
      const samples: Array<{ name: string; object_type: string; params: Record<string, unknown> }> = [
        { name: 'Demo: Open Pit Copper', object_type: 'open_pit',
          params: { bench_height: 10, bench_width: 8, num_benches: 6, pit_length: 400, pit_width: 250, haul_road_width: 24, batter_angle: 72 } },
        { name: 'Demo: Room & Pillar Coal', object_type: 'room_and_pillar',
          params: { room_width: 6, pillar_width: 9, num_rooms_x: 6, num_rooms_y: 4, room_height: 3, entry_width: 5 } },
        { name: 'Demo: Longwall Panel', object_type: 'longwall_panel',
          params: { face_width: 180, panel_length: 600, seam_height: 3.2, num_supports: 120, shearer_position: 65 } },
      ];
      const seeded: ProjectFile[] = samples.map((s, i) => {
        const geom = clientGeometry.generateGeometry(s.object_type, s.params);
        return withScene({
          id: `demo-${i}`,
          name: s.name,
          object_type: s.object_type,
          created_at: new Date().toISOString(),
          geometry: geom,
          properties: geom.properties,
        });
      });
      const selected = seeded[0];
      setProjects(seeded);
      setSelectedProject(selected);
      setSelectedObjectId(sceneFromProject(selected)[0]?.id ?? null);
      setGeometry(selected.geometry);
      setLayers(layersForGeometry(selected.geometry!));
    };
    loadWorkspace().then(saved => {
      if (cancelled) return;
      const valid = (saved?.projects?.filter(isProjectFile) || []).map(withScene);
      if (saved && Array.isArray(saved.projects)) {
        const selected = valid.find(p => p.id === saved.selectedId) || valid[0] || null;
        setProjects(valid);
        setSelectedProject(selected);
        setSelectedObjectId(sceneFromProject(selected)[0]?.id ?? null);
        setGeometry(selected?.geometry || null);
        setLayers(selected?.geometry ? layersForGeometry(selected.geometry) : []);
      } else seed();
    }).catch(() => {
      if (!cancelled) { seed(); setWorkspaceError('Automatic saving is unavailable in this browser. Download project files to keep your work.'); }
    }).finally(() => { if (!cancelled) setWorkspaceReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;
    saveWorkspace({ projects, selectedId: selectedProject?.id || null })
      .then(() => setWorkspaceError(''))
      .catch(() => setWorkspaceError('Automatic saving failed. Download your project file now.'));
  }, [projects, selectedProject?.id, workspaceReady]);

  return (
    <div className="h-dvh w-screen flex flex-col overflow-hidden bg-bg-base text-fg">
      {workspaceError && <div role="alert" className="px-3 py-1.5 text-xs bg-danger/15 text-danger">{workspaceError}</div>}
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
        sheetMode={sheetMode}
        setSheetMode={setSheetMode}
        onUndo={() => restoreEdit('undo')}
        onRedo={() => restoreEdit('redo')}
        canUndo={Boolean(selectedProject && editHistory.current[selectedProject.id]?.past.length)}
        canRedo={Boolean(selectedProject && editHistory.current[selectedProject.id]?.future.length)}
      />

      {/* Main workspace layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Keep the drawing wide on laptops and tablets. */}
        <div className="hidden xl:flex shrink-0 flex-col">
          <LeftSidebar
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={handleSelectProject}
            onLoadTemplate={handleLoadTemplate}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onDuplicateProject={handleDuplicateProject}
            onDownloadProject={handleDownloadProject}
            onImportProject={handleImportProject}
            onImportSurvey={handleImportSurvey}
            collapsed={leftCollapsed}
            setCollapsed={setLeftCollapsed}
          />
        </div>

        {/* Mobile drawer: project files / templates */}
        {leftDrawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 xl:hidden"
              onClick={() => setLeftDrawerOpen(false)}
              aria-hidden
            />
            <div role="dialog" aria-modal="true" aria-label="Projects and templates" className="fixed inset-y-0 left-0 z-[60] flex w-[85vw] max-w-80 flex-col bg-surface-raised border-r border-edge shadow-[var(--shadow-pop)] xl:hidden">
              <LeftSidebar
                projects={projects}
                selectedProject={selectedProject}
                onSelectProject={(p) => { handleSelectProject(p); setLeftDrawerOpen(false); }}
                onLoadTemplate={(t) => { handleLoadTemplate(t); setLeftDrawerOpen(false); }}
                onRenameProject={handleRenameProject}
                onDeleteProject={handleDeleteProject}
                onDuplicateProject={handleDuplicateProject}
                onDownloadProject={handleDownloadProject}
                onImportProject={handleImportProject}
                onImportSurvey={handleImportSurvey}
                collapsed={false}
                setCollapsed={() => setLeftDrawerOpen(false)}
              />
            </div>
          </>
        )}

        {/* Center Viewports + CLI / AI Box */}
        <main className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden bg-bg-base min-w-0">
          <div className="shrink-0 h-10 flex items-center gap-2 px-3 lg:px-5 bg-surface-sunken border-b border-edge">
            <button type="button" onClick={() => { setLeftDrawerOpen(true); setRightDrawerOpen(false); }} className="btn xl:hidden h-8 w-8 border border-edge" title="Open projects and templates" aria-label="Open projects and templates">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
            </button>
            <div className="min-w-0 flex-1 flex items-center gap-2 text-xs">
              <span className="font-medium text-fg truncate">{selectedProject?.name ?? 'Untitled design'}</span>
              <span className="text-fg-faint shrink-0">/</span>
              <span className="text-fg-muted shrink-0">{activeView.toUpperCase()} viewport</span>
            </div>
            <span className="hidden sm:inline-flex rounded border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">Concept design</span>
            <button type="button" onClick={() => { setRightDrawerOpen(true); setLeftDrawerOpen(false); }} className="btn xl:hidden h-8 px-2.5 border border-edge text-[11px]" title="Open objects, properties and layers" aria-label="Open objects, properties and layers">Objects <span className="text-accent">{activeScene.length}</span></button>
          </div>
          <PromptBox
            onGenerate={handleGeneratePrompt}
            isGenerating={isGenerating}
            note={parseNote}
            error={generationError}
            method={generationMethod}
            feedback={sceneFeedback}
            componentCount={activeScene.length}
          />
          {/* Canvas area */}
          <div className="relative shrink-0 h-[min(46dvh,400px)] lg:h-auto lg:flex-1 bg-bg-base border-b border-edge min-h-[220px] lg:min-h-[280px]">
            {activeView === '2d' ? (
              <Canvas2D
                geometry={geometry}
                layers={layers}
                sceneObjects={activeScene}
                selectedObjectId={selectedObject?.id ?? null}
                onSelectObject={handleSelectSceneObject}
                onMoveObject={handleMoveSceneObject}
                onDeleteObject={handleDeleteSceneObject}
                fitKey={selectedProject ? `${selectedProject.id}:${activeScene.length}` : null}
                sheetMode={sheetMode}
                sheetProjectName={selectedProject?.name ?? 'Untitled'}
                sheetObjectType={selectedProject?.object_type ?? ''}
              />
            ) : (
              <Viewport3D
                geometry={geometry}
                layers={layers}
                selectedObjectId={selectedObject?.id ?? null}
                onSelectObject={handleSelectSceneObject}
                viewMode={viewMode3D}
                showSectionView={showSectionView}
                sectionHeight={sectionHeight}
              />
            )}
          </div>

          <details className="shrink-0 border-t border-edge bg-surface-sunken">
            <summary className="cursor-pointer px-3 py-1.5 text-[10px] font-mono text-fg-muted hover:text-fg">Command history and advanced CLI</summary>
            <CommandLine history={commandHistory} onCommandSubmit={handleCommandLineSubmit} activeProvider={aiConfig.provider} />
          </details>
        </main>

        {/* Right Properties Panel */}
        <div className="hidden xl:flex shrink-0 flex-col">
          <RightSidebar
            geometry={selectedObject?.geometry ?? geometry}
            scene={activeScene}
            selectedObjectId={selectedObject?.id ?? null}
            onSelectSceneObject={handleSelectSceneObject}
            onMoveSceneObject={handleMoveSceneObject}
            onDeleteSceneObject={handleDeleteSceneObject}
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
              className="fixed inset-0 z-40 bg-black/60 xl:hidden"
              onClick={() => setRightDrawerOpen(false)}
              aria-hidden
            />
            <div role="dialog" aria-modal="true" aria-label="Properties and layers" className="fixed inset-y-0 right-0 z-[60] flex w-[85vw] max-w-80 flex-col bg-surface-raised border-l border-edge shadow-[var(--shadow-pop)] xl:hidden">
              <RightSidebar
                geometry={selectedObject?.geometry ?? geometry}
                scene={activeScene}
                selectedObjectId={selectedObject?.id ?? null}
                onSelectSceneObject={handleSelectSceneObject}
                onMoveSceneObject={handleMoveSceneObject}
                onDeleteSceneObject={handleDeleteSceneObject}
                layers={layers}
                setLayers={setLayers}
                onUpdateParams={handleUpdateProperties}
                collapsed={false}
                setCollapsed={() => setRightDrawerOpen(false)}
              />
            </div>
          </>
        )}

      </div>
      <LegalFooter />
      <OnboardingTour />
    </div>
  );
}
