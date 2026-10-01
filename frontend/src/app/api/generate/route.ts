import { generateGeometry, parseEditCommand, parsePromptLocal } from '@/lib/geometryEngine';
import type { GenerateResponse } from '@/types';

export const runtime = 'nodejs';

const OBJECT_TYPES = new Set([
  'open_pit', 'room_and_pillar', 'ventilation', 'conveyor', 'blast_pattern',
  'decline', 'mine_survey_traverse', 'topographic_contours',
  'borehole_lithology', 'longwall_panel', 'cut_fill_volume',
]);

function failure(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

async function parseDeepSeek(prompt: string, key: string, model: string) {
  if (!key || key.length > 256) throw new Error('Enter a valid DeepSeek API key in AI settings.');
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: ['deepseek-chat', 'deepseek-reasoner'].includes(model) ? model : 'deepseek-chat',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Extract one conceptual mining CAD design. Reply with JSON only: {"object_type":"open_pit|room_and_pillar|ventilation|conveyor|blast_pattern|decline|mine_survey_traverse|topographic_contours|borehole_lithology|longwall_panel|cut_fill_volume","params":{}}. Include only parameters explicitly requested; all distances in metres and angles in degrees.' },
        { role: 'user', content: prompt },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`DeepSeek request failed (${res.status}). Check your API key and try again.`);
  const body = await res.json();
  const raw = String(body.choices?.[0]?.message?.content ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const parsed = JSON.parse(raw) as { object_type?: unknown; params?: unknown };
  if (!OBJECT_TYPES.has(String(parsed.object_type)) || !parsed.params || typeof parsed.params !== 'object' || Array.isArray(parsed.params)) {
    throw new Error('DeepSeek returned a design this app could not interpret.');
  }
  return { objectType: String(parsed.object_type), params: parsed.params as Record<string, unknown> };
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 16384) return failure('Request is too large.', 413);
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 2000) return failure('Enter a prompt of 1–2000 characters.', 400);
    const provider = body.ai_provider || 'local';
    if (!['local', 'deepseek'].includes(provider)) return failure(`${provider} is unavailable on the hosted app. Choose Local or DeepSeek.`, 400);

    const current = body.current_properties && typeof body.current_properties === 'object'
      ? body.current_properties as Record<string, unknown> : null;
    const edited = current ? parseEditCommand(prompt, current) : null;
    let objectType: string;
    let params: Record<string, unknown>;
    let method: string;
    let interpretation: string;

    if (edited) {
      objectType = String(current?._object_type || 'open_pit');
      params = edited;
      method = 'edit';
      interpretation = 'Applied the requested parameter edit.';
    } else if (provider === 'deepseek') {
      const result = await parseDeepSeek(prompt, String(body.ai_api_key || ''), String(body.ai_model || 'deepseek-chat'));
      objectType = result.objectType;
      params = { ...current, ...result.params };
      method = 'deepseek';
      interpretation = `DeepSeek interpreted this as ${objectType.replaceAll('_', ' ')}. Review every parameter before use.`;
    } else {
      const parsed = parsePromptLocal(prompt);
      if (!parsed.recognized) return failure('Could not identify a design type or parameter. Try an example prompt.', 400);
      objectType = parsed.object_type || 'open_pit';
      params = { ...current, ...parsed.params };
      method = 'local';
      interpretation = parsed.interpretation;
    }
    if (!OBJECT_TYPES.has(objectType)) return failure('Unknown design type.', 400);
    if (objectType === 'open_pit') {
      if (/\boverall\s+slope|\bslope\s+angle|\bsteeper|\bshallower/i.test(prompt)) params._design_driver = 'overall_slope';
      else if (/\bbench\s+width/i.test(prompt)) params._design_driver = 'bench_width';
    }
    const geometry = generateGeometry(objectType, params);
    geometry.properties._object_type = objectType;
    const response: GenerateResponse = {
      success: true, object_type: objectType, params: geometry.properties,
      geometry, parse_method: method, interpretation, error: '',
    };
    return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.';
    return failure(message, 400);
  }
}
