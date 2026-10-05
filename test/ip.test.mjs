import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange, validateRecord } from '../ip.mjs';
test('all RFC 1918 blocks and endpoints are valid', () => {
  for (const [range, count] of [['10.0.0.0/8', 16777216], ['172.16.0.0/12', 1048576], ['192.168.0.0/16', 65536], ['10.255.255.255/32', 1], ['172.31.255.254/31', 2], ['192.168.0.1 - 192.168.0.10', 10]]) assert.equal(parseRange(range).count, count);
});
test('reject public, other special-use, crossing, and malformed ranges', () => {
  for (const range of ['8.8.8.8/32', '127.0.0.0/8', '169.254.0.0/16', '100.64.0.0/10', '172.15.255.255/32', '172.32.0.0/16', '192.169.0.0/16', '10.0.0.0/7', '0.0.0.0/0', '192.168.0.1/24', '192.168.0.0/33', '192.168.256.0/24', '010.0.0.0/8', '10.0.0.2 - 10.0.0.1', '10.255.255.255 - 11.0.0.0', '::1/128']) assert.throws(() => parseRange(range), undefined, range);
});
test('overlap is inclusive, environment-scoped, and allows edits and adjacency', () => {
  const existing = { id: 'one', ...validateRecord({ name: 'Main', environment: 'Lab', range: '10.0.0.0/24' }) };
  const input = { name: 'New', environment: 'lab', range: '10.0.0.255/32' };
  assert.throws(() => validateRecord(input, [existing]), /Overlaps/);
  assert.doesNotThrow(() => validateRecord({ ...input, environment: 'Home' }, [existing]));
  assert.doesNotThrow(() => validateRecord({ ...input, range: '10.0.1.0/24' }, [existing]));
  assert.doesNotThrow(() => validateRecord(existing, [existing], 'one'));
  assert.throws(() => validateRecord({ ...input, name: '' }), /Name/);
});
