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

  const scenePlan = await post('/api/scene-plan', { prompt: 'Create an open pit with 5 benches and a conveyor 200m long', provider: 'local' });
  assert.equal(scenePlan.status, 200);
  const plan = await scenePlan.json();
  assert.deepEqual(plan.objects.map(item => item.object_type), ['open_pit', 'conveyor']);
  assert.equal(plan.objects[0].params.num_benches, 5);
  const leadingDimension = await post('/api/scene-plan', { prompt: 'Create an open pit with 5 benches and a 200m conveyor', provider: 'local' });
  const leadingPlan = await leadingDimension.json();
  assert.equal(leadingPlan.objects[1].params.length, 200);

  const blastContext = await post('/api/scene-plan', { prompt: 'Create a blast pattern for a quarry', provider: 'local' });
  assert.deepEqual((await blastContext.json()).objects.map(item => item.object_type), ['blast_pattern']);

  const ventilation = await post('/api/scene-plan', { prompt: 'Add a ventilation network with 6m shaft diameter', provider: 'local' });
  assert.equal(ventilation.status, 200);
  assert.deepEqual((await ventilation.json()).objects.map(item => item.object_type), ['ventilation']);

  const unsupported = await post('/api/scene-plan', { prompt: 'Create an open pit and a tailings dam', provider: 'local' });
  assert.equal(unsupported.status, 422);
  assert.match((await unsupported.json()).error, /tailings dam/);

  const slope40 = await post('/api/generate-direct', { object_type: 'open_pit', params: { overall_slope: 40, num_benches: 5 } });
  const slope70 = await post('/api/generate-direct', { object_type: 'open_pit', params: { overall_slope: 70, num_benches: 5 } });
  assert.equal(slope40.status, 200);
  assert.equal(slope70.status, 200);
  const pit40 = (await slope40.json()).geometry;
  const pit70 = (await slope70.json()).geometry;
  assert.notDeepEqual(pit40.meshes.map(mesh => mesh.vertices), pit70.meshes.map(mesh => mesh.vertices));
  assert.ok(Math.abs(pit40.properties.overall_slope - 40) < 0.1);
  assert.ok(Math.abs(pit70.properties.overall_slope - 70) < 0.1);
  const impossibleSlope = await post('/api/generate-direct', { object_type: 'open_pit', params: { overall_slope: 80, batter_angle: 75 } });
  assert.equal(impossibleSlope.status, 400);

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
