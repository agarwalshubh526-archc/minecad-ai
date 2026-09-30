export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 8192) return Response.json({ success: false, error: 'Request is too large.' }, { status: 413 });
    const body = await request.json();
    const prompt = String(body.prompt || '').trim();
    const key = String(body.api_key || '');
    if (!prompt || prompt.length > 2000 || !key || key.length > 256) {
      return Response.json({ success: false, error: 'Enter a question and a valid DeepSeek API key.' }, { status: 400 });
    }
    const model = ['deepseek-chat', 'deepseek-reasoner'].includes(body.model) ? body.model : 'deepseek-chat';
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: 'Answer mining CAD questions concisely. Explain assumptions and flag when site-specific engineering review is required.' },
        { role: 'user', content: prompt },
      ] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return Response.json({ success: false, error: `DeepSeek request failed (${res.status}).` }, { status: 502 });
    const result = await res.json();
    return Response.json({ success: true, response: String(result.choices?.[0]?.message?.content || '') }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ success: false, error: 'DeepSeek is temporarily unavailable.' }, { status: 502 });
  }
}
