import type { Edge, Node } from '@xyflow/react';
import type { ComponentDef, HoseData, PythonDef } from './types';
import { TUBE_TYPES } from './constants';
import { pythonColors } from './python';
import type { FitResult } from './autofit';

export interface PartRow {
  section: 'Utstyr' | 'Koblinger' | 'Slanger' | 'Pytonrør';
  artnr: string;
  name: string;
  maker: string;
  category: string;
  qty: number;
  unit: 'stk' | 'm';
  note: string;
}

export function tubeTypeName(id: string) {
  return TUBE_TYPES.find((t) => t.id === id)?.name ?? id;
}

function round1(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeParts(nodes: Node[], edges: Edge[], pythons: PythonDef[], fits?: Map<string, { s: FitResult; t: FitResult }>): PartRow[] {
  const comp = new Map<string, PartRow>();
  if (fits) {
    for (const e of edges) {
      if (e.type !== 'hose') continue;
      const f = fits.get(e.id);
      if (!f) continue;
      for (const r of [f.s, f.t]) {
        if (r.status !== 'ok' || !r.def) continue;
        const def = r.def;
        const key = (def.artnr || '') + '|' + def.name + '|' + (def.maker || '');
        const row = comp.get(key);
        if (row) { row.qty += 1; row.note = row.note || 'slangeende'; }
        else comp.set(key, { section: 'Koblinger', artnr: def.artnr || '', name: def.name, maker: def.maker || '', category: def.category, qty: 1, unit: 'stk', note: 'slangeende' });
      }
    }
  }
  for (const n of nodes) {
    if (n.type !== 'comp') continue;
    const def = (n.data as any).def as ComponentDef;
    const key = (def.artnr || '') + '|' + def.name + '|' + (def.maker || '');
    const section: PartRow['section'] = def.group === 'Utstyr' ? 'Utstyr' : 'Koblinger';
    const r = comp.get(key);
    if (r) { r.qty += 1; if (r.note === 'slangeende') r.note = ''; }
    else comp.set(key, { section, artnr: def.artnr || '', name: def.name, maker: def.maker || '', category: def.category, qty: 1, unit: 'stk', note: '' });
  }

  const hoses = new Map<string, PartRow & { missing: number; count: number }>();
  for (const e of edges) {
    if (e.type !== 'hose') continue;
    const h = e.data as HoseData;
    if (h.counted === false) continue;
    const key = `${h.tube}|${h.size}|${h.color || ''}`;
    let r = hoses.get(key);
    if (!r) {
      r = { section: 'Slanger', artnr: '', name: `${tubeTypeName(h.tube)} ${h.size}${h.color ? ' ' + h.color.toLowerCase() : ''}`, maker: '', category: 'Slange', qty: 0, unit: 'm', note: '', missing: 0, count: 0 };
      hoses.set(key, r);
    }
    r.count += 1;
    if (h.length == null || isNaN(h.length)) r.missing += 1;
    else r.qty = round1(r.qty + h.length);
  }
  for (const r of hoses.values()) {
    const bits = [`${r.count} strekk`];
    if (r.missing) bits.push(`${r.missing} uten lengde`);
    r.note = bits.join(', ');
  }

  const pys = new Map<string, PartRow & { missing: number; count: number }>();
  for (const py of pythons) {
    const key = `${py.products}|${py.productSize}|${py.coolCount}|${py.coolSize}|${py.artnr || ''}`;
    let r = pys.get(key);
    if (!r) {
      r = {
        section: 'Pytonrør', artnr: py.artnr || '', name: `Pytonrør ${py.products}+${py.coolCount} (${py.products}×${py.productSize} + ${py.coolCount}×${py.coolSize})`,
        maker: '', category: 'Pytonrør', qty: 0, unit: 'm', note: '', missing: 0, count: 0,
      };
      pys.set(key, r);
    }
    r.count += 1;
    if (py.length == null || isNaN(py.length)) r.missing += 1;
    else r.qty = round1(r.qty + py.length);
    const cols = pythonColors(py).join(', ');
    r.note = [r.note, `${py.name}: ${cols}`].filter(Boolean).join(' | ');
  }
  for (const r of pys.values()) if (r.missing) r.note += ` (${r.missing} uten lengde)`;

  const order: PartRow['section'][] = ['Utstyr', 'Koblinger', 'Slanger', 'Pytonrør'];
  const rows = [...comp.values(), ...hoses.values(), ...pys.values()].map((r) => {
    const { missing, count, ...rest } = r as any;
    return rest as PartRow;
  });
  rows.sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section) || a.category.localeCompare(b.category, 'no') || a.name.localeCompare(b.name, 'no'));
  return rows;
}

export function formatQty(r: PartRow) {
  if (r.unit === 'm') return `${r.qty.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m`;
  return `${r.qty} stk`;
}
