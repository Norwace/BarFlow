import type { Node } from '@xyflow/react';
import type { ComponentDef, PortDef, PythonDef, Side } from './types';
import { portPoint, transformPoint, transformSide, rotatedSize, Pt } from './geometry';
import { nodeDef, HOSE_END_SIZE } from './compat';
import { normSize } from './geometry';

export function nodeRot(n: Node): { rotation: number; flip: boolean } {
  const d = n.data as any;
  return { rotation: d.rotation ?? 0, flip: !!d.flip };
}

/** Portens posisjon i nodens (roterte) ramme */
export function portLocal(def: ComponentDef, p: PortDef, rotation: number, flip: boolean): Pt {
  return transformPoint(portPoint(p, def.w, def.h), def.w, def.h, rotation, flip);
}

export function portAbs(n: Node, portId: string, pythons: PythonDef[]): Pt | null {
  if (n.type === 'hoseEnd') return { x: n.position.x + HOSE_END_SIZE / 2, y: n.position.y + HOSE_END_SIZE / 2 };
  const def = nodeDef(n, pythons);
  if (!def) return null;
  const p = def.ports.find((q) => q.id === portId);
  if (!p) {
    if (portId === 'body' && n.type === 'pyEnd') {
      const { rotation, flip } = nodeRot(n);
      const loc = transformPoint({ x: 0, y: def.h / 2 }, def.w, def.h, rotation, flip);
      return { x: n.position.x + loc.x, y: n.position.y + loc.y };
    }
    return null;
  }
  const { rotation, flip } = nodeRot(n);
  const loc = portLocal(def, p, rotation, flip);
  return { x: n.position.x + loc.x, y: n.position.y + loc.y };
}

export function portSideAbs(n: Node, p: PortDef): Side {
  const { rotation, flip } = nodeRot(n);
  return transformSide(p.side, rotation, flip);
}

const OPP: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
export function opposite(s: Side): Side {
  return OPP[s];
}

export function rotationFor(p: PortDef, desired: Side): number {
  for (const r of [0, 90, 180, 270]) if (transformSide(p.side, r, false) === desired) return r;
  return 0;
}

export function sideToward(from: Pt, to: Pt): Side {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/** Posisjon (øvre venstre hjørne) slik at porten havner på punktet */
export function positionForPort(def: ComponentDef, p: PortDef, rotation: number, at: Pt): Pt {
  const loc = portLocal(def, p, rotation, false);
  return { x: at.x - loc.x, y: at.y - loc.y };
}

export function nodeSize(def: ComponentDef, rotation: number) {
  return rotatedSize(def.w, def.h, rotation);
}

const STD_FAMILY: Record<string, string> = { BSP: 'BSP', BSPP: 'BSP', BSPT: 'BSP', NPTF: 'NPT', NPT: 'NPT', NPS: 'NPS', NPSM: 'NPS', NPSH: 'NPS' };
const fam = (s?: string) => { const u = (s ?? '').toUpperCase(); return STD_FAMILY[u] ?? u; };

/** Kan port b kobles direkte (uten slange) mot a? */
export function directCompatible(a: PortDef, b: PortDef): boolean {
  const k = [a.kind, b.kind].sort().join('+');
  // tom størrelse = koblingsform som får størrelse når den kobles til
  if (k === 'push+stem' || k === 'push+tube') return !a.size || !b.size || normSize(a.size) === normSize(b.size);
  if (k === 'thread+thread') return fam(a.std) === fam(b.std) && normSize(a.size) === normSize(b.size) && (!a.gender || !b.gender || a.gender !== b.gender);
  return false;
}

/** Størrelse en ny slange fra denne porten bør ha */
export function hoseSizeFor(p?: PortDef, q?: PortDef): string {
  for (const x of [p, q]) if (x && (x.kind === 'push' || x.kind === 'tube') && x.size) return x.size;
  for (const x of [p, q]) if (x && x.kind === 'hosetail' && x.size) return x.size;
  return '3/8"';
}
