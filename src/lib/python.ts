import type { ComponentDef, PortDef, PythonDef } from './types';
import { DEFAULT_PYTHON_ORDER, pythonColorHex } from './constants';
import { uid } from './ids';

export const PY_SPACING = 20;
export const PY_W = 50;

export function newPython(products = 4): PythonDef {
  return {
    id: uid('py'),
    name: 'Pytonrør',
    products,
    productSize: '3/8"',
    productColors: DEFAULT_PYTHON_ORDER.slice(0, products),
    coolSize: '1/2"',
    coolCount: 2,
    coolMedium: 'kullsyrevann',
    productMedia: Array(products).fill('any'),
    productNames: Array(products).fill(''),
    length: null,
  };
}

export function pythonColors(py: PythonDef): string[] {
  const out: string[] = [];
  for (let i = 0; i < py.products; i++) out.push(py.productColors[i] ?? DEFAULT_PYTHON_ORDER[i % DEFAULT_PYTHON_ORDER.length]);
  return out;
}

export function pythonEndDef(py: PythonDef, end: 'A' | 'B'): ComponentDef {
  const n = py.products + py.coolCount;
  const h = PY_SPACING * (n + 1);
  const colors = pythonColors(py);
  const ports: PortDef[] = [];
  for (let i = 0; i < py.products; i++) {
    const nm = py.productNames?.[i];
    ports.push({
      id: `p${i + 1}`,
      name: `Produkt ${i + 1} (${colors[i]})${nm ? ' – ' + nm : ''}`,
      side: 'right',
      pos: (PY_SPACING * (i + 1)) / h,
      kind: 'tube',
      size: py.productSize,
      medium: py.productMedia?.[i] ?? 'any',
      color: pythonColorHex(colors[i]),
      link: `p${i + 1}`,
    });
  }
  // kjøleloop: én hvit og én svart slange
  for (let j = 0; j < py.coolCount; j++) {
    ports.push({
      id: `k${j + 1}`,
      name: `Kjøleloop ${j + 1} (${j === 0 ? 'hvit' : 'svart'}, ${py.coolMedium === 'kullsyrevann' ? 'kullsyrevann' : 'vann'})`,
      side: 'right',
      pos: (PY_SPACING * (py.products + j + 1)) / h,
      kind: 'tube',
      size: py.coolSize,
      medium: py.coolMedium ?? 'vann',
      color: j === 0 ? '#ffffff' : '#111827',
      link: `k${j + 1}`,
    });
  }
  return {
    id: `python-${py.id}-${end}`,
    name: `${py.name} ende ${end}`,
    group: 'Pytonrør',
    category: 'Pytonrør',
    symbol: 'python-end',
    w: PY_W,
    h,
    ports,
    source: 'start',
  };
}

export function pythonLabel(py: PythonDef): string {
  return `${py.products}+${py.coolCount}`;
}
