export const blocks = [
  { cidr: '10.0.0.0/8', start: 167772160, end: 184549375 },
  { cidr: '172.16.0.0/12', start: 2886729728, end: 2887778303 },
  { cidr: '192.168.0.0/16', start: 3232235520, end: 3232301055 },
];
export function ipNumber(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value)) throw new Error('Enter a valid IPv4 address (without leading zeros).');
  const parts = value.split('.').map(Number);
  if (parts.some(n => n > 255)) throw new Error('IPv4 octets must be between 0 and 255.');
  return parts.reduce((n, part) => n * 256 + part, 0);
}
export function ipString(n) { return [24, 16, 8, 0].map(shift => Math.floor(n / 2 ** shift) % 256).join('.'); }
export function parseRange(value) {
  if (typeof value !== 'string') throw new Error('Enter a CIDR subnet or a start–end address range.');
  value = value.trim();
  let start, end, label, prefix = null;
  if (value.includes('/')) {
    const match = value.match(/^([^/]+)\/(0|[1-9]|[12]\d|3[0-2])$/);
    if (!match) throw new Error('Use CIDR notation with a prefix from 0 to 32.');
    const ip = ipNumber(match[1]); prefix = Number(match[2]);
    const size = 2 ** (32 - prefix); start = Math.floor(ip / size) * size; end = start + size - 1;
    label = `${ipString(start)}/${prefix}`;
    if (ip !== start) throw new Error(`Use the subnet network address: ${label}.`);
  } else {
    const parts = value.split(/\s*[-–]\s*/);
    if (parts.length !== 2) throw new Error('Use a CIDR subnet or two IPv4 addresses separated by a dash.');
    start = ipNumber(parts[0]); end = ipNumber(parts[1]);
    if (end < start) throw new Error('The end address must be at or after the start address.');
    label = `${ipString(start)} – ${ipString(end)}`;
  }
  const block = blocks.find(b => start >= b.start && end <= b.end);
  if (!block) throw new Error('The entire range must fit inside 10.0.0.0/8, 172.16.0.0/12, or 192.168.0.0/16 (RFC 1918).');
  return { range: label, start, end, first: ipString(start), last: ipString(end), count: end - start + 1, prefix, block: block.cidr };
}
export function validateRecord(input, records = [], id = null) {
  if (!input || typeof input !== 'object') throw new Error('A range record is required.');
  const text = (key, max, required = false) => {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error(`${key} must be text.`);
    const value = (input[key] || '').trim();
    if (required && !value) throw new Error(`${key === 'name' ? 'Name' : 'Environment'} is required.`);
    if (value.length > max) throw new Error(`${key} must be at most ${max} characters.`);
    return value;
  };
  const name = text('name', 80, true), environment = text('environment', 60, true), notes = text('notes', 1000);
  const subnet = parseRange(input.range);
  const conflict = records.find(r => r.id !== id && r.environment.toLowerCase() === environment.toLowerCase() && subnet.start <= r.end && subnet.end >= r.start);
  if (conflict) throw new Error(`Overlaps “${conflict.name}” (${conflict.range}) in ${conflict.environment}. Separate environments may reuse addresses.`);
  return { name, environment, notes, ...subnet };
}
