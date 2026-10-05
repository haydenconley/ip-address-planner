import { parseRange, blocks } from '/ip.mjs';
const $ = selector => document.querySelector(selector);
const form = $('#form'), editor = $('#editor');
let records = [], editing = null, deleting = null;
const number = n => n.toLocaleString();
async function api(url, options) {
  const response = await fetch(url, options); const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.'); return result;
}
function notice(message, failure = false) { $('#notice').textContent = message; $('#notice').className = failure ? 'failure' : ''; $('#notice').hidden = false; }
function element(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function render() {
  const previous = $('#filter').value;
  const environments = [...new Set(records.map(r => r.environment))].sort();
  $('#filter').replaceChildren(new Option('All environments', ''), ...environments.map(e => new Option(e, e)));
  $('#filter').value = environments.includes(previous) ? previous : '';
  $('#environments').replaceChildren(...[...new Set(['Home', 'Lab', ...environments])].map(e => new Option(e, e)));
  $('#total').textContent = records.length;
  blocks.forEach((b, i) => { const count = records.filter(r => r.block === b.cidr).length; $(`#block-${i}`).textContent = `${count} tracked range${count === 1 ? '' : 's'}`; });
  const query = $('#search').value.toLowerCase().trim();
  const visible = records.filter(r => (!$('#filter').value || r.environment === $('#filter').value) && [r.name, r.environment, r.range, r.notes].some(v => v.toLowerCase().includes(query))).sort((a, b) => a.environment.localeCompare(b.environment) || a.start - b.start);
  $('#rows').replaceChildren();
  for (const record of visible) {
    const tr = document.createElement('tr'); const name = document.createElement('td');
    name.append(element('strong', record.name), element('span', record.environment, 'environment'));
    const range = element('td', record.range, 'mono'); range.append(element('span', record.prefix === null ? 'Address pool' : `Subnet · ${record.block}`, 'subline'));
    const count = element('td', number(record.count), 'mono');
    const notes = element('td', record.notes || '—', 'notes'); const actions = document.createElement('td'); const group = element('div', '', 'actions');
    const edit = element('button', 'Edit', 'text-button'); edit.setAttribute('aria-label', `Edit ${record.name}`); edit.onclick = () => openEditor(record);
    const remove = element('button', 'Delete', 'text-button delete'); remove.setAttribute('aria-label', `Delete ${record.name}`); remove.onclick = () => { deleting = record; $('#delete-description').textContent = `${record.name} · ${record.range}`; $('#delete-error').hidden = true; $('#delete-dialog').showModal(); };
    group.append(edit, remove); actions.append(group); tr.append(name, range, count, notes, actions); $('#rows').append(tr);
  }
  $('#empty').hidden = visible.length > 0;
  $('#empty h3').textContent = records.length ? 'No matching ranges' : 'No ranges yet';
  $('#empty p').textContent = records.length ? 'Try a different search or environment.' : 'Add your first subnet or address pool to start your inventory.';
  $('#empty-add').hidden = records.length > 0;
  $('#summary').textContent = `${visible.length} of ${records.length} ranges · ${number(visible.reduce((sum, r) => sum + r.count, 0))} addresses across listed ranges`;
}
function preview() {
  try { const range = parseRange(form.elements.range.value); $('#preview').textContent = `${range.first} → ${range.last}\n${number(range.count)} total addresses · ${range.block}${range.prefix !== null ? '\nCount includes all addresses in the subnet.' : ''}`; }
  catch (err) { $('#preview').textContent = form.elements.range.value ? err.message : 'Enter a range to see its address boundaries.'; }
}
function openEditor(record = null) {
  editing = record?.id || null; form.reset();
  for (const key of ['name', 'environment', 'range', 'notes']) form.elements[key].value = record?.[key] || '';
  $('#form-title').textContent = editing ? 'Edit range' : 'Add a range'; $('#form-error').hidden = true; preview(); editor.showModal(); form.elements.name.focus();
}
$('#add').onclick = () => openEditor(); $('#empty-add').onclick = () => openEditor();
$('#close').onclick = $('#cancel').onclick = () => editor.close();
form.elements.range.oninput = preview;
$('#search').oninput = render; $('#filter').onchange = render;
form.onsubmit = async event => {
  event.preventDefault(); $('#save').disabled = true; $('#form-error').hidden = true;
  try {
    const payload = Object.fromEntries(new FormData(form));
    const result = await api(editing ? `/api/ranges/${editing}` : '/api/ranges', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    records = editing ? records.map(r => r.id === editing ? result : r) : [...records, result];
    editor.close(); render(); notice(`Saved “${result.name}”.`);
  } catch (err) { $('#form-error').textContent = err.message; $('#form-error').hidden = false; }
  finally { $('#save').disabled = false; }
};
$('#confirm-delete').onclick = async () => {
  $('#confirm-delete').disabled = true;
  try { await api(`/api/ranges/${deleting.id}`, { method: 'DELETE' }); records = records.filter(r => r.id !== deleting.id); $('#delete-dialog').close(); render(); notice(`Deleted “${deleting.name}”.`); }
  catch (err) { $('#delete-error').textContent = err.message; $('#delete-error').hidden = false; }
  finally { $('#confirm-delete').disabled = false; }
};
async function load() { try { records = await api('/api/ranges'); render(); } catch { $('#summary').textContent = 'Inventory unavailable'; notice('Could not load your inventory. Check that the local server is running, then reload this page.', true); $('#add').disabled = true; } }
await load();
if (document.modelContext?.registerTool) {
  try { await document.modelContext.registerTool({ name: 'list_network_ranges', description: 'Read the current local network range inventory.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: async () => { records = await api('/api/ranges'); render(); return records; } }); } catch (err) { console.warn('Optional browser tool unavailable', err); }
}
