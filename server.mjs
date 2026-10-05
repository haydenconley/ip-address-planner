import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateRecord } from './ip.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3210);
const dataDir = process.env.LAB_IP_DATA_DIR || path.join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const dataFile = path.join(dataDir, 'ranges.json');
let records = [];
if (existsSync(dataFile)) {
  const saved = JSON.parse(readFileSync(dataFile, 'utf8'));
  if (!Array.isArray(saved)) throw new Error('Invalid inventory file. Restore a valid ranges.json backup.');
  for (const row of saved) {
    if (typeof row.id !== 'string' || records.some(r => r.id === row.id)) throw new Error('Invalid record ID in inventory.');
    records.push({ id: row.id, ...validateRecord(row, records) });
  }
}
function save(next) {
  writeFileSync(`${dataFile}.tmp`, JSON.stringify(next, null, 2), { encoding: 'utf8', flush: true });
  renameSync(`${dataFile}.tmp`, dataFile);
  records = next;
}
const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/ip.mjs': ['../ip.mjs', 'text/javascript'] };
const server = http.createServer(async (req, res) => {
  const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!allowedHosts.includes(req.headers.host)) return send(403, { error: 'Invalid host.' });
  if (req.headers.origin && !allowedHosts.some(h => req.headers.origin === `http://${h}`)) return send(403, { error: 'Only local app requests are allowed.' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  try {
    if (url.pathname === '/api/ranges' && req.method === 'GET') return send(200, records);
    const match = url.pathname.match(/^\/api\/ranges\/([\w-]+)$/);
    if (req.method === 'DELETE' && match) {
      if (!records.some(r => r.id === match[1])) return send(404, { error: 'Range no longer exists.' });
      save(records.filter(r => r.id !== match[1])); return send(200, { ok: true });
    }
    if ((req.method === 'POST' && url.pathname === '/api/ranges') || (req.method === 'PUT' && match)) {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required.' });
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) return send(413, { error: 'Request is too large.' }); }
      let input; try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON.' }); }
      const id = match?.[1] || randomUUID();
      if (req.method === 'PUT' && !records.some(r => r.id === id)) return send(404, { error: 'Range no longer exists.' });
      let record; try { record = { id, ...validateRecord(input, records, id) }; } catch (err) { return send(400, { error: err.message }); }
      save(req.method === 'POST' ? [...records, record] : records.map(r => r.id === id ? record : r));
      return send(req.method === 'POST' ? 201 : 200, record);
    }
    if (req.method === 'GET' && assets[url.pathname]) {
      const [file, type] = assets[url.pathname]; res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      return res.end(readFileSync(path.join(root, 'public', file)));
    }
    send(404, { error: 'Not found.' });
  } catch (err) { console.error(err); send(500, { error: 'Could not read or save the inventory. Your change was not saved; check the server and try again.' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Lab IP Address Manager: http://127.0.0.1:${port}`));
