// MineCAD AI — Backend API Client

import type { GenerateResponse, GeometryData } from '@/types';

// Same-origin by default so requests go through the /api rewrite in next.config.ts
// (NEXT_PUBLIC_BACKEND_URL is the rewrite target, read server-side).
// Set NEXT_PUBLIC_API_URL to talk to a backend directly (must be in CSP connect-src).
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function parseErrorResponse(res: Response): Promise<Error> {
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string') return new Error(data.error);
  } catch {
    // not JSON — fall through to status text
  }
  return new Error(`Request failed: ${res.status} ${res.statusText}`);
}

export async function generateFromPrompt(
  prompt: string,
  aiProvider = 'local',
  aiModel = '',
  aiBaseUrl = 'http://localhost:11434',
  aiApiKey = '',
  currentProperties?: Record<string, unknown>,
): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      prompt,
      ai_provider: aiProvider,
      ai_model: aiModel,
      ai_base_url: aiBaseUrl,
      ai_api_key: aiApiKey,
      current_properties: currentProperties || null,
    }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return res.json();
}

export async function generateDirect(
  objectType: string,
  params: Record<string, unknown>,
): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/api/generate-direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ object_type: objectType, params }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return res.json();
}

export async function exportFile(format: string, geometryData: GeometryData): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ format, geometry_data: geometryData }),
  });
  if (!res.ok) throw await parseErrorResponse(res);
  return res.blob();
}

export async function chatWithDeepSeek(
  prompt: string,
  apiKey = '',
  model = 'deepseek-chat',
  baseUrl = 'https://api.deepseek.com',
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/deepseek/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        prompt,
        model,
        api_key: apiKey,
        base_url: baseUrl,
      }),
    });
    if (!res.ok) {
      const err = await parseErrorResponse(res);
      return { success: false, error: err.message };
    }
    return res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking synchronously can cancel the download before the browser
  // claims the blob (racy in Chrome/Firefox) — defer it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}
