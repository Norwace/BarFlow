import type { Edge, Node } from '@xyflow/react';
import type { ComponentDef, PythonDef } from './types';
import { nodeDef } from './compat';

export interface Highlight { nodes: Set<string>; edges: Set<string>; ports: Set<string> }

/**
 * Finner alt som henger sammen med startpunktet: slanger, koblinger og utstyr.
 * Går gjennom koblinger (alle porter henger sammen) og gjennom utstyr der portene
 * har samme «link» (f.eks. inn 1 og ut 1 i en kjøler), og gjennom pytonrøret.
 */
export function connectedSet(nodes: Node[], edges: Edge[], pythons: PythonDef[], start: { nodes?: string[]; edges?: string[]; ports?: string[] }): Highlight {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  const ports = new Map<string, string[]>();
  for (const n of nodes) {
    const d = nodeDef(n, pythons) as ComponentDef | null;
    if (!d) continue;
    const isFitting = n.type === 'comp' && d.group !== 'Utstyr';
    const list: string[] = [];
    for (const p of d.ports) {
      const pt = `${n.id}:${p.id}`;
      list.push(pt);
      if (!adj.has(pt)) adj.set(pt, new Set());
      if (isFitting || n.type === 'hoseEnd') link(pt, `${n.id}:*`);
      else if (p.link) link(pt, n.type === 'pyEnd' ? `py:${(n.data as any).pythonId}:${p.link}` : `${n.id}:link:${p.link}`);
    }
    ports.set(n.id, list);
  }
  const edgeOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type === 'python') continue;
    const a = `${e.source}:${e.sourceHandle}`, b = `${e.target}:${e.targetHandle}`;
    link(a, b);
    for (const k of [a, b]) {
      if (!edgeOf.has(k)) edgeOf.set(k, []);
      edgeOf.get(k)!.push(e.id);
    }
  }
  const queue: string[] = [...(start.ports ?? [])];
  for (const id of start.nodes ?? []) queue.push(...(ports.get(id) ?? []));
  for (const id of start.edges ?? []) {
    const e = edges.find((x) => x.id === id);
    if (!e) continue;
    if (e.type === 'python') {
      // pytonrøret: alle slangene i det
      for (const n of nodes) if (n.type === 'pyEnd' && (n.data as any).pythonId === (e.data as any).pythonId) queue.push(...(ports.get(n.id) ?? []));
    } else queue.push(`${e.source}:${e.sourceHandle}`, `${e.target}:${e.targetHandle}`);
  }
  const seen = new Set<string>(queue);
  while (queue.length) {
    const p = queue.pop()!;
    for (const q of adj.get(p) ?? []) if (!seen.has(q)) { seen.add(q); queue.push(q); }
  }
  const hn = new Set<string>(), he = new Set<string>(), hp = new Set<string>();
  for (const p of seen) {
    const nid = p.split(':')[0];
    if (p.startsWith('py:') || p.endsWith(':*') || p.includes(':link:')) continue;
    hn.add(nid);
    hp.add(p);
    for (const e of edgeOf.get(p) ?? []) he.add(e);
  }
  for (const id of start.nodes ?? []) hn.add(id);
  for (const id of start.edges ?? []) he.add(id);
  // pytonrør-kroppen lyser når begge ender er med
  for (const e of edges) if (e.type === 'python' && hn.has(e.source) && hn.has(e.target)) he.add(e.id);
  return { nodes: hn, edges: he, ports: hp };
}
