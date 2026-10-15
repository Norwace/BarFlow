import type { PortDef, Side } from './types';

export interface Pt { x: number; y: number }

export function portPoint(p: PortDef, w: number, h: number): Pt {
  switch (p.side) {
    case 'left': return { x: 0, y: p.pos * h };
    case 'right': return { x: w, y: p.pos * h };
    case 'top': return { x: p.pos * w, y: 0 };
    case 'bottom': return { x: p.pos * w, y: h };
  }
}

export function inward(side: Side): Pt {
  switch (side) {
    case 'left': return { x: 1, y: 0 };
    case 'right': return { x: -1, y: 0 };
    case 'top': return { x: 0, y: 1 };
    case 'bottom': return { x: 0, y: -1 };
  }
}

const ROT_SIDE: Record<Side, Side> = { left: 'top', top: 'right', right: 'bottom', bottom: 'left' };
const FLIP_SIDE: Record<Side, Side> = { left: 'right', right: 'left', top: 'top', bottom: 'bottom' };

/** Roterer/speiler et punkt i (w,h)-rammen. Rotasjon med klokka. */
export function transformPoint(pt: Pt, w: number, h: number, rotation: number, flip?: boolean): Pt {
  let x = flip ? w - pt.x : pt.x;
  let y = pt.y;
  const r = ((rotation % 360) + 360) % 360;
  if (r === 90) return { x: h - y, y: x };
  if (r === 180) return { x: w - x, y: h - y };
  if (r === 270) return { x: y, y: w - x };
  return { x, y };
}

export function transformSide(side: Side, rotation: number, flip?: boolean): Side {
  let s = flip ? FLIP_SIDE[side] : side;
  const steps = (((rotation % 360) + 360) % 360) / 90;
  for (let i = 0; i < steps; i++) s = ROT_SIDE[s];
  return s;
}

export function rotatedSize(w: number, h: number, rotation: number) {
  const r = ((rotation % 360) + 360) % 360;
  return r === 90 || r === 270 ? { w: h, h: w } : { w, h };
}

/** SVG-transform som tegner (w,h)-rammen inn i rotert boks */
export function svgTransform(w: number, h: number, rotation: number, flip?: boolean): string {
  const r = ((rotation % 360) + 360) % 360;
  const parts: string[] = [];
  if (r === 90) parts.push(`translate(${h} 0) rotate(90)`);
  else if (r === 180) parts.push(`translate(${w} ${h}) rotate(180)`);
  else if (r === 270) parts.push(`translate(0 ${w}) rotate(270)`);
  if (flip) parts.push(`translate(${w} 0) scale(-1 1)`);
  return parts.join(' ');
}

/** Tall-verdi for en dimensjon i tommer (til tegning av rørtykkelse) */
export function sizeInches(size?: string): number {
  if (!size) return 0.375;
  const s = size.replace(/["”\s]/g, '').toLowerCase();
  const mm = s.match(/^(\d+(?:[.,]\d+)?)mm$/);
  if (mm) return parseFloat(mm[1].replace(',', '.')) / 25.4;
  const frac = s.match(/^(\d+)\/(\d+)/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const n = parseFloat(s.replace(',', '.'));
  if (!isNaN(n)) return n > 3 ? n / 25.4 : n;
  return 0.375;
}

export function normSize(size?: string): string {
  return (size ?? '').replace(/["”\s]/g, '').replace(',', '.').toLowerCase();
}
