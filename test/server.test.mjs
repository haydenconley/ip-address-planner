import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
test('API validates, saves, updates, persists across restart, and deletes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lab-ip-test-'));
  const port = 13210; const base = `http://127.0.0.1:${port}`; let child;
  async function start() {
    child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), LAB_IP_DATA_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'] });
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Test server exited before startup.'); }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Server startup timed out')), 5000); timer.unref(); })]);
  }
  async function stop() { const exited = once(child, 'exit'); child.kill(); await exited; child = null; }
  const mutate = (url, method, data) => fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  try {
    await start();
    assert.equal((await fetch(base)).status, 200);
    const input = { name: 'Home LAN', environment: 'Home', range: '192.168.10.0/24', notes: '<script>example</script>' };
    const created = await mutate('/api/ranges', 'POST', input); assert.equal(created.status, 201); const record = await created.json();
    assert.equal((await mutate('/api/ranges', 'POST', input)).status, 400);
    assert.equal((await mutate('/api/ranges', 'POST', { ...input, range: '8.8.8.8/32' })).status, 400);
    assert.equal((await fetch(`${base}/api/ranges`, { headers: { Origin: 'https://example.com' } })).status, 403);
    assert.equal((await mutate(`/api/ranges/${record.id}`, 'PUT', { ...input, name: 'Updated LAN' })).status, 200);
    await stop(); await start();
    const persisted = await (await fetch(`${base}/api/ranges`)).json(); assert.equal(persisted.length, 1); assert.equal(persisted[0].name, 'Updated LAN');
    assert.equal((await mutate(`/api/ranges/${record.id}`, 'DELETE')).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/ranges`)).json(), []);
  } finally { if (child) await stop(); await rm(directory, { recursive: true, force: true }); }
});
