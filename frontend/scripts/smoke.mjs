import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = 3111;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'ignore',
});
server.on('error', error => { throw error; });

const post = (path, body) => fetch(`${origin}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) { ready = true; break; }
    } catch { /* wait for startup */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'health endpoint did not start');

  const generated = await post('/api/generate', { prompt: 'open pit with 5 benches 10m high', ai_provider: 'local' });
  assert.equal(generated.status, 200);
  const result = await generated.json();
  assert.equal(result.object_type, 'open_pit');
  assert.equal(result.geometry.properties.num_benches, 5);

  const unknown = await post('/api/generate', { prompt: 'hello', ai_provider: 'local' });
  assert.equal(unknown.status, 400);
  const noKey = await post('/api/generate', { prompt: 'open pit', ai_provider: 'deepseek' });
  assert.equal(noKey.status, 400);

  const bounded = await post('/api/generate-direct', { object_type: 'room_and_pillar', params: { num_rooms_x: 500, num_rooms_y: 500 } });
  assert.equal(bounded.status, 200);
  assert.ok((await bounded.json()).geometry.meshes.length < 1000, 'generator accepted an excessive mesh count');

  const drawing = { ...result.geometry, primitives: [
    ...result.geometry.primitives,
    { type: 'arc', cx: 0, cy: 0, r: 5, startAngle: 0, endAngle: 90, layer: 'TEST', color: 1 },
    { type: 'hatch', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 2 }], pattern: 'SOLID', layer: 'TEST', color: 2 },
  ] };
  for (const format of ['dxf', 'svg', 'pdf', 'obj', 'stl']) {
    const response = await post('/api/export', { format, geometry_data: drawing });
    assert.equal(response.status, 200, `${format} export failed`);
    const data = await response.arrayBuffer();
    assert.ok(data.byteLength > 100, `${format} export was empty`);
    if (format === 'dxf') assert.match(new TextDecoder().decode(data), /\nARC\n/);
    if (format === 'svg') assert.match(new TextDecoder().decode(data), /<polygon points=/);
  }
  console.log('Frontend route smoke checks passed.');
} finally {
  server.kill('SIGTERM');
}
