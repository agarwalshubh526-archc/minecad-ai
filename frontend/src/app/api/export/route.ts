import { exportDXF, exportSVG, exportOBJ, exportSTL } from '@/lib/cadExport';
import { exportPDF } from '@/lib/pdfExport';
import type { GeometryData } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 3_000_000) {
      return Response.json({ error: 'Export is too large.' }, { status: 413 });
    }
    const body = await request.json();
    const format = String(body.format || '').toLowerCase();
    const geom = body.geometry_data as GeometryData;
    if (!geom || !Array.isArray(geom.primitives) || !Array.isArray(geom.meshes) || !Array.isArray(geom.layers) || !geom.bounds) {
      return Response.json({ error: 'Invalid geometry.' }, { status: 400 });
    }
    const types: Record<string, string> = {
      dxf: 'application/dxf', svg: 'image/svg+xml', pdf: 'application/pdf',
      obj: 'text/plain', stl: 'model/stl',
    };
    if (!types[format]) return Response.json({ error: 'Unsupported export format.' }, { status: 400 });
    const data = format === 'dxf' ? exportDXF(geom)
      : format === 'svg' ? exportSVG(geom)
      : format === 'obj' ? exportOBJ(geom)
      : format === 'stl' ? exportSTL(geom)
      : await exportPDF(geom).arrayBuffer();
    return new Response(data, {
      headers: {
        'Content-Type': types[format],
        'Content-Disposition': `attachment; filename="minecad_export.${format}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'Export failed.' }, { status: 400 });
  }
}
