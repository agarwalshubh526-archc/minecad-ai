import { planSceneLocal, type ScenePlan } from '@/lib/scenePlanner';
import { DESIGN_LABELS } from '@/lib/sceneModel';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 16384) return Response.json({ error: 'Request is too large.' }, { status: 413 });
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 2000) return Response.json({ error: 'Enter a prompt of 1–2000 characters.' }, { status: 400 });
    const local = planSceneLocal(prompt);
    if (local.unsupported.length) return Response.json({ error: `These requested components are not available yet: ${local.unsupported.join(', ')}. No partial design was created.` }, { status: 422 });
    if (body.provider !== 'deepseek') return Response.json(local);
    const key = String(body.api_key || '');
    if (!key || key.length > 256) return Response.json({ error: 'Enter a valid DeepSeek API key in AI settings.' }, { status: 400 });
    const model = ['deepseek-chat', 'deepseek-reasoner'].includes(body.model) ? body.model : 'deepseek-chat';
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, temperature: 0.1,
        messages: [
          { role: 'system', content: `Extract ALL requested conceptual mine components. Respond with JSON only: {"action":"replace|add","objects":[{"object_type":"supported_type","params":{}}],"unsupported":["unsupported component"]}. Supported types: ${Object.keys(DESIGN_LABELS).join(', ')}. Each component needs its own parameters. Do not invent geometry or map an unsupported component to another type. Use metres and degrees. A prompt beginning create/design/generate means replace; add/modify means add or update.` },
          { role: 'user', content: prompt },
        ],
      }),
      cache: 'no-store', signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) return Response.json({ error: `DeepSeek request failed (${response.status}).` }, { status: 502 });
    const data = await response.json();
    const raw = String(data.choices?.[0]?.message?.content ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.objects) || parsed.objects.length > 8 || !Array.isArray(parsed.unsupported)) throw new Error('DeepSeek returned an invalid scene plan.');
    const unsupported = [...new Set([...local.unsupported, ...parsed.unsupported.filter((v: unknown) => typeof v === 'string')])];
    const objects = parsed.objects.map((item: { object_type?: unknown; params?: unknown }) => {
      if (typeof item.object_type !== 'string' || !(item.object_type in DESIGN_LABELS) || !item.params || typeof item.params !== 'object' || Array.isArray(item.params)) {
        throw new Error('DeepSeek returned a component this app cannot build.');
      }
      return { object_type: item.object_type, params: item.params as Record<string, unknown> };
    });
    const plan: ScenePlan = {
      action: parsed.action === 'replace' ? 'replace' : 'add', objects, unsupported,
      assumptions: [
        'AI interpreted the prompt; review every parameter.',
        ...(objects.length > 1 ? ['Components are placed side by side; connections and clashes are not validated.'] : []),
      ],
      interpretation: objects.map((item: { object_type: string }) => DESIGN_LABELS[item.object_type]).join(' + '),
    };
    return Response.json(plan, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not plan the scene.' }, { status: 400 });
  }
}
