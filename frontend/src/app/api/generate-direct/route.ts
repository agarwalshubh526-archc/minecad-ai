import { generateGeometry } from '@/lib/geometryEngine';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 16384) return Response.json({ success: false, error: 'Request is too large.' }, { status: 413 });
    const body = await request.json();
    if (typeof body.object_type !== 'string' || !body.params || typeof body.params !== 'object') {
      return Response.json({ success: false, error: 'Invalid design request.' }, { status: 400 });
    }
    const geometry = generateGeometry(body.object_type, body.params);
    geometry.properties._object_type = body.object_type;
    return Response.json({ success: true, object_type: body.object_type, params: geometry.properties, geometry, parse_method: 'direct', error: '' });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Generation failed.' }, { status: 400 });
  }
}
