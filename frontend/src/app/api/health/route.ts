export const runtime = 'nodejs';

export function GET() {
  return Response.json({ status: 'ok', service: 'MineCAD AI', version: '1.1.0' });
}
