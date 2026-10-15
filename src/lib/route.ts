import { Position } from '@xyflow/react';

export interface Pt { x: number; y: number }
export type RouteStyle = 'smoothstep' | 'straight' | 'bezier';

export function posDir(p?: Position | null): Pt | null {
  switch (p) {
    case Position.Left: return { x: -1, y: 0 };
    case Position.Right: return { x: 1, y: 0 };
    case Position.Top: return { x: 0, y: -1 };
    case Position.Bottom: return { x: 0, y: 1 };
    default: return null;
  }
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
const snap10 = (v: number) => Math.round(v / 10) * 10;

/** Automatiske hjørner mellom to stubbpunkter (ortogonalt) */
export function autoCorners(a: Pt, aDir: Pt | null, b: Pt, bDir: Pt | null): Pt[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (near(dx, 0) || near(dy, 0)) {
    // på linje – men hvis stubbene peker mot hverandre feil vei trengs en omvei
    return [];
  }
  const ah = aDir ? aDir.x !== 0 : Math.abs(dx) >= Math.abs(dy);
  const bh = bDir ? bDir.x !== 0 : ah;
  if (ah && bh) {
    const mx = snap10((a.x + b.x) / 2);
    return [{ x: mx, y: a.y }, { x: mx, y: b.y }];
  }
  if (!ah && !bh) {
    const my = snap10((a.y + b.y) / 2);
    return [{ x: a.x, y: my }, { x: b.x, y: my }];
  }
  if (ah && !bh) return [{ x: b.x, y: a.y }];
  return [{ x: a.x, y: b.y }];
}

export interface RouteGeom {
  /** punktene som tegnes */
  pts: Pt[];
  /** for hvert tegnet segment: indeks for ankerparet det tilhører */
  segOf: number[];
  anchors: Pt[];
  /** indeks i anchors der dataPoints starter */
  dataStart: number;
  /** effektive knekkpunkter (brukerens eller automatiske) */
  dataPts: Pt[];
  auto: boolean;
  d: string;
  label: { x: number; y: number; horizontal: boolean };
  /** første og siste retning (for symboler i endene) */
  startDir: Pt;
  endDir: Pt;
  /** retning etter vinkel i endene (når slangen går ut i vinkel) */
  startTurn?: Pt;
  endTurn?: Pt;
}

function cleanPolyline(pts: Pt[], segOf: number[]): { pts: Pt[]; segOf: number[] } {
  const P: Pt[] = [];
  const S: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (P.length && near(P[P.length - 1].x, p.x) && near(P[P.length - 1].y, p.y)) continue;
    if (P.length) S.push(segOf[i - 1] ?? 0);
    P.push(p);
  }
  // fjern rette mellompunkter
  const P2: Pt[] = [P[0]];
  const S2: number[] = [];
  for (let i = 1; i < P.length; i++) {
    if (i < P.length - 1) {
      const a = P2[P2.length - 1], b = P[i], c = P[i + 1];
      const col = (near(a.x, b.x) && near(b.x, c.x)) || (near(a.y, b.y) && near(b.y, c.y));
      if (col && S[i - 1] === S[i]) continue;
    }
    S2.push(S[i - 1]);
    P2.push(P[i]);
  }
  return { pts: P2, segOf: S2 };
}

/** Utvid ankerliste til ortogonal polyline */
function orthoExpand(anchors: Pt[], startH: boolean | null): { pts: Pt[]; segOf: number[] } {
  const pts: Pt[] = [anchors[0]];
  const segOf: number[] = [];
  let prevH = startH;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (near(a.x, b.x) || near(a.y, b.y)) {
      if (!(near(a.x, b.x) && near(a.y, b.y))) prevH = near(a.y, b.y);
      pts.push(b);
      segOf.push(i);
      continue;
    }
    const h = prevH ?? Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const c = h ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    pts.push(c); segOf.push(i);
    pts.push(b); segOf.push(i);
    prevH = !h;
  }
  return { pts, segOf };
}

function roundedPath(pts: Pt[], r = 9): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const la = Math.hypot(p.x - a.x, p.y - a.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
    const rr = Math.min(r, la / 2, lb / 2);
    if (rr < 0.5) { d += ` L${p.x},${p.y}`; continue; }
    const p1 = { x: p.x - ((p.x - a.x) / la) * rr, y: p.y - ((p.y - a.y) / la) * rr };
    const p2 = { x: p.x + ((b.x - p.x) / lb) * rr, y: p.y + ((b.y - p.y) / lb) * rr };
    d += ` L${p1.x},${p1.y} Q${p.x},${p.y} ${p2.x},${p2.y}`;
  }
  const l = pts[pts.length - 1];
  d += ` L${l.x},${l.y}`;
  return d;
}

function curvePath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.5 / 3 * 2;
    const c1 = { x: p1.x + (p2.x - p0.x) * t / 2, y: p1.y + (p2.y - p0.y) * t / 2 };
    const c2 = { x: p2.x - (p3.x - p1.x) * t / 2, y: p2.y - (p3.y - p1.y) * t / 2 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

function labelSpot(pts: Pt[], skipEnds: boolean): RouteGeom['label'] {
  let best = -1, bi = 0;
  const from = skipEnds && pts.length > 3 ? 1 : 0;
  const to = skipEnds && pts.length > 3 ? pts.length - 2 : pts.length - 1;
  for (let i = from; i < to; i++) {
    const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (L > best) { best = L; bi = i; }
  }
  const a = pts[bi], b = pts[bi + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, horizontal: Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) };
}

function unit(a: Pt, b: Pt): Pt {
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
}

/** Hvor langt ut fra porten vinkelen sitter */
export const ELBOW_LEN = 20;

export function computeRoute(
  S: Pt, sDir: Pt | null, T: Pt, tDir: Pt | null, points: Pt[] | undefined, style: RouteStyle, stub = 16,
  sTurn: Pt | null = null, tTurn: Pt | null = null,
): RouteGeom {
  const anchors: Pt[] = [S];
  // vinkel i enden: kort rett stykke ut av porten, så 90° sving
  const sA = sDir && sTurn ? { x: S.x + sDir.x * ELBOW_LEN, y: S.y + sDir.y * ELBOW_LEN } : null;
  const tA = tDir && tTurn ? { x: T.x + tDir.x * ELBOW_LEN, y: T.y + tDir.y * ELBOW_LEN } : null;
  const sD = sA ? sTurn : sDir, tD = tA ? tTurn : tDir;
  const sB = sA ?? S, tB = tA ?? T;
  const S1 = sD ? { x: sB.x + sD.x * stub, y: sB.y + sD.y * stub } : null;
  const T1 = tD ? { x: tB.x + tD.x * stub, y: tB.y + tD.y * stub } : null;
  if (sA) anchors.push(sA);
  if (S1) anchors.push(S1);
  const dataStart = anchors.length;
  const auto = !points;
  const dataPts = points ?? autoCorners(S1 ?? sB, sD, T1 ?? tB, tD);
  anchors.push(...dataPts);
  if (T1) anchors.push(T1);
  if (tA) anchors.push(tA);
  anchors.push(T);

  let pts: Pt[], segOf: number[];
  if (style === 'smoothstep') {
    const r = orthoExpand(anchors, sDir ? sDir.x !== 0 : null);
    ({ pts, segOf } = cleanPolyline(r.pts, r.segOf));
  } else {
    pts = anchors;
    segOf = anchors.slice(0, -1).map((_, i) => i);
    ({ pts, segOf } = cleanPolyline(pts, segOf));
  }
  const d = style === 'bezier' ? curvePath(pts) : style === 'smoothstep' ? roundedPath(pts) : roundedPath(pts, 0);
  const label = labelSpot(pts, !!(sDir || tDir));
  const startDir = pts.length > 1 ? unit(pts[0], pts[1]) : { x: 1, y: 0 };
  const endDir = pts.length > 1 ? unit(pts[pts.length - 1], pts[pts.length - 2]) : { x: -1, y: 0 };
  return { pts, segOf, anchors, dataStart, dataPts, auto, d, label, startDir, endDir, startTurn: sA ? sTurn ?? undefined : undefined, endTurn: tA ? tTurn ?? undefined : undefined };
}

/** Hvor i datapunktlista et nytt punkt skal inn, gitt segmentindeks i tegningen */
export function insertIndexFor(geom: RouteGeom, segIndex: number): number {
  const pair = geom.segOf[segIndex] ?? 0;
  return Math.max(0, Math.min(geom.dataPts.length, pair + 1 - geom.dataStart));
}

export function nearestSegment(geom: RouteGeom, p: Pt): { index: number; dist: number; at: Pt } {
  let best = { index: 0, dist: Infinity, at: p };
  for (let i = 0; i < geom.pts.length - 1; i++) {
    const a = geom.pts[i], b = geom.pts[i + 1];
    const vx = b.x - a.x, vy = b.y - a.y;
    const L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
    const q = { x: a.x + vx * t, y: a.y + vy * t };
    const dd = Math.hypot(q.x - p.x, q.y - p.y);
    if (dd < best.dist) best = { index: i, dist: dd, at: q };
  }
  return best;
}

/** Snapp punkt til rutenett og til naboers akser */
export function snapPoint(p: Pt, neighbors: (Pt | undefined)[], tol = 8): Pt {
  let x = snap10(p.x), y = snap10(p.y);
  for (const n of neighbors) {
    if (!n) continue;
    if (Math.abs(p.x - n.x) < tol) x = n.x;
    if (Math.abs(p.y - n.y) < tol) y = n.y;
  }
  return { x, y };
}

export type HoseDirName = 'straight' | 'up' | 'down' | 'left' | 'right';
const DIRV: Record<string, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/**
 * Retning etter vinkelen i en slangeende, eller null for rett ut.
 * mode undefined = automatisk: vinkel bare når koblingen er en vinkel, og da mot den andre enden.
 */
export function endTurn(mode: HoseDirName | undefined, portDir: Pt | null, elbowFitting: boolean, me: Pt, other: Pt): Pt | null {
  if (!portDir) return null;
  if (mode === 'straight') return null;
  if (mode && DIRV[mode]) {
    const v = DIRV[mode];
    // må stå vinkelrett på porten
    if (v.x * portDir.x + v.y * portDir.y === 0) return v;
    if (!elbowFitting) return null;
  } else if (!elbowFitting) return null;
  const a = { x: -portDir.y, y: portDir.x }, b = { x: portDir.y, y: -portDir.x };
  const dx = other.x - me.x, dy = other.y - me.y;
  return dx * a.x + dy * a.y >= 0 ? a : b;
}

/** Navn på retning (for valgknapper) */
export function dirName(v: Pt): HoseDirName {
  return v.x > 0 ? 'right' : v.x < 0 ? 'left' : v.y < 0 ? 'up' : 'down';
}
