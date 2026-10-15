import React from 'react';
import type { ComponentDef, PortDef } from './types';
import { portPoint, inward, sizeInches, Pt } from './geometry';
import { mediumById } from './constants';

const INK = '#1f2937';
const BODY = '#f3f4f6';
const SW = 2;

export interface SymbolInfo {
  key: string;
  name: string;
  group: 'Kobling' | 'Utstyr';
}

export const SYMBOLS: SymbolInfo[] = [
  { key: 'fit', name: 'Kobling (rett/vinkel/T/Y)', group: 'Kobling' },
  { key: 'fit-valve', name: 'Stengeventil', group: 'Kobling' },
  { key: 'fit-check', name: 'Tilbakeslagsventil', group: 'Kobling' },
  { key: 'fit-filter', name: 'Silfilter', group: 'Kobling' },
  { key: 'fit-plug', name: 'Plugg / endestopp', group: 'Kobling' },
  { key: 'fit-bulkhead', name: 'Skottgjennomføring', group: 'Kobling' },
  { key: 'fit-manifold', name: 'Fordeler', group: 'Kobling' },
  { key: 'cooler', name: 'Kjøler', group: 'Utstyr' },
  { key: 'carbonator', name: 'Karbonator', group: 'Utstyr' },
  { key: 'regulator', name: 'Regulator', group: 'Utstyr' },
  { key: 'gas-bottle', name: 'Gassflaske', group: 'Utstyr' },
  { key: 'keg', name: 'Fat', group: 'Utstyr' },
  { key: 'bib', name: 'Bag-in-box', group: 'Utstyr' },
  { key: 'bibswitch', name: 'Bagveksler', group: 'Utstyr' },
  { key: 'pump', name: 'Pumpe', group: 'Utstyr' },
  { key: 'tap', name: 'Kran', group: 'Utstyr' },
  { key: 'tower', name: 'Tårn', group: 'Utstyr' },
  { key: 'filter', name: 'Vannfilter', group: 'Utstyr' },
  { key: 'water-in', name: 'Vanninntak', group: 'Utstyr' },
  { key: 'drain', name: 'Avløp', group: 'Utstyr' },
  { key: 'manifold', name: 'Gassfordeler', group: 'Utstyr' },
  { key: 'prv', name: 'Trykkreduksjonsventil', group: 'Utstyr' },
  { key: 'gauge', name: 'Manometer', group: 'Utstyr' },
  { key: 'fob', name: 'Skumstopper (FOB)', group: 'Utstyr' },
  { key: 'mixer', name: 'Gassblander', group: 'Utstyr' },
  { key: 'n2gen', name: 'N₂-generator', group: 'Utstyr' },
  { key: 'compressor', name: 'Luftkompressor', group: 'Utstyr' },
  { key: 'icemaker', name: 'Ismaskin', group: 'Utstyr' },
  { key: 'coffee', name: 'Kaffemaskin', group: 'Utstyr' },
  { key: 'box', name: 'Generell boks', group: 'Utstyr' },
];

function pipeWidth(p: PortDef): number {
  const s = p.kind === 'thread' ? 0.375 : sizeInches(p.size);
  return Math.max(7, Math.min(13, 5 + 12 * s));
}

function add(a: Pt, b: Pt, k = 1): Pt {
  return { x: a.x + b.x * k, y: a.y + b.y * k };
}

/** Tegner koblinger automatisk ut fra portene */
function FittingSymbol({ def }: { def: ComponentDef }) {
  const { w, h, ports } = def;
  const hub: Pt = { x: w / 2, y: h / 2 };
  const variant = def.symbol.replace(/^fit-?/, '') || 'plain';

  // nav for vinkel: bruk krysningspunktet til portene
  if (ports.length === 2) {
    const [a, b] = ports;
    const va = inward(a.side);
    const vb = inward(b.side);
    if (va.x !== 0 && vb.y !== 0) { hub.x = portPoint(b, w, h).x; hub.y = portPoint(a, w, h).y; }
    else if (va.y !== 0 && vb.x !== 0) { hub.x = portPoint(a, w, h).x; hub.y = portPoint(b, w, h).y; }
  }
  if (variant === 'manifold') {
    // fordeler: navet er en bjelke
  }

  const segs = ports.map((p) => {
    const P = portPoint(p, w, h);
    const v = inward(p.side);
    const endLen = p.kind === 'stem' ? 11 : p.kind === 'thread' ? 9 : 4;
    const start = add(P, v, endLen);
    // ett trinn rett inn før vi går mot navet
    const knee = add(P, v, Math.max(endLen + 4, 10));
    let d: string;
    if (variant === 'manifold') {
      const along = v.x !== 0 ? { x: hub.x, y: P.y } : { x: P.x, y: hub.y };
      d = `M${start.x},${start.y} L${along.x},${along.y}`;
    } else {
      // gå rett inn til vi er på linje med navet, så til navet
      const mid = v.x !== 0 ? { x: hub.x, y: P.y } : { x: P.x, y: hub.y };
      d = `M${start.x},${start.y} L${knee.x},${knee.y} L${mid.x},${mid.y} L${hub.x},${hub.y}`;
    }
    return { p, P, v, d, width: pipeWidth(p), start };
  });

  const manifoldBar = (() => {
    if (variant !== 'manifold') return null;
    const xs = segs.map((s) => (s.v.x !== 0 ? hub.x : s.P.x));
    const ys = segs.map((s) => (s.v.y !== 0 ? hub.y : s.P.y));
    const x0 = Math.min(...xs, hub.x), x1 = Math.max(...xs, hub.x);
    const y0 = Math.min(...ys, hub.y), y1 = Math.max(...ys, hub.y);
    return `M${x0},${y0} L${x1},${y1}`;
  })();

  const maxW = Math.max(...segs.map((s) => s.width), 8);

  return (
    <g>
      {/* ytre kontur */}
      {segs.map((s, i) => (
        <path key={'o' + i} d={s.d} stroke={INK} strokeWidth={s.width} fill="none" strokeLinejoin="round" strokeLinecap="butt" />
      ))}
      {manifoldBar && <path d={manifoldBar} stroke={INK} strokeWidth={maxW + 2} strokeLinecap="square" fill="none" />}
      {/* innside */}
      {segs.map((s, i) => (
        <path key={'i' + i} d={s.d} stroke={BODY} strokeWidth={s.width - 3.5} fill="none" strokeLinejoin="round" strokeLinecap="butt" />
      ))}
      {manifoldBar && <path d={manifoldBar} stroke={BODY} strokeWidth={maxW - 1.5} strokeLinecap="square" fill="none" />}
      {/* ender */}
      {segs.map((s, i) => <PortEnd key={'e' + i} p={s.p} P={s.P} v={s.v} width={s.width} />)}
      <HubDecor variant={variant} hub={hub} segs={segs} w={w} h={h} />
    </g>
  );
}

function PortEnd({ p, P, v, width }: { p: PortDef; P: Pt; v: Pt; width: number }) {
  const horiz = v.x !== 0;
  if (p.kind === 'stem') {
    const e = add(P, v, 12);
    const sw = Math.max(5, width - 4);
    return (
      <g>
        <line x1={P.x} y1={P.y} x2={e.x} y2={e.y} stroke={INK} strokeWidth={sw} />
        <line x1={P.x + v.x * 1.2} y1={P.y + v.y * 1.2} x2={e.x} y2={e.y} stroke="#fff" strokeWidth={sw - 3} />
      </g>
    );
  }
  if (p.kind === 'thread') {
    const len = 9;
    const half = width / 2 + 1;
    const rx = horiz ? Math.min(P.x, P.x + v.x * len) : P.x - half;
    const ry = horiz ? P.y - half : Math.min(P.y, P.y + v.y * len);
    const rw = horiz ? len : half * 2;
    const rh = horiz ? half * 2 : len;
    const lines = [];
    for (let k = 2; k < len; k += 2.5) {
      const a = add(P, v, k);
      lines.push(horiz
        ? <line key={k} x1={a.x} y1={a.y - half} x2={a.x + v.x * 2} y2={a.y + half} stroke={INK} strokeWidth={0.9} />
        : <line key={k} x1={a.x - half} y1={a.y} x2={a.x + half} y2={a.y + v.y * 2} stroke={INK} strokeWidth={0.9} />);
    }
    return (
      <g>
        <rect x={rx} y={ry} width={rw} height={rh} fill="#fff" stroke={INK} strokeWidth={1.4} />
        {lines}
      </g>
    );
  }
  if (p.kind === 'hosetail') {
    const pts: string[] = [];
    const half = width / 2 - 1;
    for (let k = 0; k < 2; k++) {
      const a = add(P, v, k * 5);
      const b = add(P, v, k * 5 + 5);
      if (horiz) pts.push(`M${a.x},${a.y - half + 2} L${b.x},${b.y - half} L${b.x},${b.y + half} L${a.x},${a.y + half - 2} Z`);
      else pts.push(`M${a.x - half + 2},${a.y} L${b.x - half},${b.y} L${b.x + half},${b.y} L${a.x + half - 2},${a.y} Z`);
    }
    return <path d={pts.join(' ')} fill="#fff" stroke={INK} strokeWidth={1.3} />;
  }
  if (p.kind === 'push' || p.kind === 'tube') {
    // spennhylse: mørk stolpe på tvers
    const a = add(P, v, 3);
    const half = width / 2 + 2;
    return horiz
      ? <line x1={a.x} y1={a.y - half} x2={a.x} y2={a.y + half} stroke={INK} strokeWidth={3} />
      : <line x1={a.x - half} y1={a.y} x2={a.x + half} y2={a.y} stroke={INK} strokeWidth={3} />;
  }
  return null;
}

function HubDecor({ variant, hub, segs, w, h }: { variant: string; hub: Pt; segs: { v: Pt; width: number }[]; w: number; h: number }) {
  const horiz = segs.length ? segs[0].v.x !== 0 : true;
  const s = 8;
  if (variant === 'valve') {
    const d = horiz
      ? `M${hub.x - s},${hub.y - s} L${hub.x + s},${hub.y + s} L${hub.x + s},${hub.y - s} L${hub.x - s},${hub.y + s} Z`
      : `M${hub.x - s},${hub.y - s} L${hub.x + s},${hub.y + s} L${hub.x - s},${hub.y + s} L${hub.x + s},${hub.y - s} Z`;
    const stem = horiz
      ? <g><line x1={hub.x} y1={hub.y} x2={hub.x} y2={hub.y - s - 6} stroke={INK} strokeWidth={1.6} /><line x1={hub.x - 6} y1={hub.y - s - 6} x2={hub.x + 6} y2={hub.y - s - 6} stroke={INK} strokeWidth={2.2} /></g>
      : <g><line x1={hub.x} y1={hub.y} x2={hub.x + s + 6} y2={hub.y} stroke={INK} strokeWidth={1.6} /><line x1={hub.x + s + 6} y1={hub.y - 6} x2={hub.x + s + 6} y2={hub.y + 6} stroke={INK} strokeWidth={2.2} /></g>;
    return <g>{stem}<path d={d} fill="#fff" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" /></g>;
  }
  if (variant === 'check') {
    const d = horiz
      ? `M${hub.x - s},${hub.y - s} L${hub.x + s - 2},${hub.y} L${hub.x - s},${hub.y + s} Z`
      : `M${hub.x - s},${hub.y - s} L${hub.x},${hub.y + s - 2} L${hub.x + s},${hub.y - s} Z`;
    const bar = horiz
      ? <line x1={hub.x + s} y1={hub.y - s} x2={hub.x + s} y2={hub.y + s} stroke={INK} strokeWidth={2.4} />
      : <line x1={hub.x - s} y1={hub.y + s} x2={hub.x + s} y2={hub.y + s} stroke={INK} strokeWidth={2.4} />;
    return <g><path d={d} fill="#fff" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />{bar}</g>;
  }
  if (variant === 'filter') {
    const r = 10;
    return (
      <g>
        <path d={`M${hub.x - r},${hub.y} L${hub.x},${hub.y - r} L${hub.x + r},${hub.y} L${hub.x},${hub.y + r} Z`} fill="#fff" stroke={INK} strokeWidth={1.6} />
        <line x1={horiz ? hub.x : hub.x - r} y1={horiz ? hub.y - r : hub.y} x2={horiz ? hub.x : hub.x + r} y2={horiz ? hub.y + r : hub.y} stroke={INK} strokeWidth={1.2} strokeDasharray="2 2" />
      </g>
    );
  }
  if (variant === 'plug') {
    return <rect x={hub.x - 6} y={hub.y - 8} width={12} height={16} rx={2} fill={INK} />;
  }
  if (variant === 'bulkhead') {
    const L = Math.max(w, h) * 0.45;
    return horiz ? (
      <g>
        <rect x={hub.x - 8} y={hub.y - 11} width={4} height={22} fill={INK} />
        <rect x={hub.x + 4} y={hub.y - 11} width={4} height={22} fill={INK} />
        <line x1={hub.x} y1={hub.y - L} x2={hub.x} y2={hub.y + L} stroke={INK} strokeWidth={2} strokeDasharray="4 2" />
      </g>
    ) : (
      <g>
        <rect x={hub.x - 11} y={hub.y - 8} width={22} height={4} fill={INK} />
        <rect x={hub.x - 11} y={hub.y + 4} width={22} height={4} fill={INK} />
        <line x1={hub.x - L} y1={hub.y} x2={hub.x + L} y2={hub.y} stroke={INK} strokeWidth={2} strokeDasharray="4 2" />
      </g>
    );
  }
  return null;
}

/* ---------------- Utstyr ---------------- */

const M = 10; // marg der portstubber går

function Stubs({ def }: { def: ComponentDef }) {
  return (
    <g>
      {def.ports.map((p) => {
        const P = portPoint(p, def.w, def.h);
        const v = inward(p.side);
        const e = add(P, v, M);
        const m = mediumById(p.medium);
        return <line key={p.id} x1={P.x} y1={P.y} x2={e.x} y2={e.y} stroke={p.color || m?.color || INK} strokeWidth={3} />;
      })}
    </g>
  );
}

function T({ x, y, children, size = 9, anchor = 'middle', weight = 700, fill = INK }: { x: number; y: number; children: React.ReactNode; size?: number; anchor?: string; weight?: number; fill?: string }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} textAnchor={anchor as any} dominantBaseline="middle" fill={fill} fontFamily="Segoe UI, Arial, sans-serif" style={{ userSelect: 'none' }}>
      {children}
    </text>
  );
}

function Snowflake({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const lines = [0, 60, 120].map((a) => {
    const rad = (a * Math.PI) / 180;
    return <line key={a} x1={cx - Math.cos(rad) * r} y1={cy - Math.sin(rad) * r} x2={cx + Math.cos(rad) * r} y2={cy + Math.sin(rad) * r} stroke="#0ea5e9" strokeWidth={1.6} />;
  });
  return <g>{lines}</g>;
}

function Bowtie({ cx, cy, s = 7, vertical = false }: { cx: number; cy: number; s?: number; vertical?: boolean }) {
  const d = vertical
    ? `M${cx - s},${cy - s} L${cx + s},${cy - s} L${cx - s},${cy + s} L${cx + s},${cy + s} Z`
    : `M${cx - s},${cy - s} L${cx + s},${cy + s} L${cx + s},${cy - s} L${cx - s},${cy + s} Z`;
  return <path d={d} fill="#fff" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />;
}

function EquipmentBody({ def, tint }: { def: ComponentDef; tint?: string }) {
  const x0 = M, y0 = M, bw = def.w - 2 * M, bh = def.h - 2 * M;
  const cx = x0 + bw / 2, cy = y0 + bh / 2;
  const frame = <rect x={x0} y={y0} width={bw} height={bh} rx={4} fill="#fff" stroke={INK} strokeWidth={SW} />;
  const gasMedium = def.ports.find((p) => p.medium && p.medium !== 'any')?.medium;

  switch (def.symbol) {
    case 'cooler': {
      const n = 7;
      const amp = Math.min(10, bh * 0.18);
      let d = `M${x0 + 10},${cy}`;
      const step = (bw - 20) / n;
      for (let i = 0; i < n; i++) d += ` L${x0 + 10 + step * (i + 0.5)},${cy + (i % 2 ? amp : -amp)}`;
      d += ` L${x0 + bw - 10},${cy}`;
      return (
        <g>
          {frame}
          <rect x={x0 + 5} y={y0 + 5} width={bw - 10} height={bh - 10} rx={3} fill="#eff6ff" stroke="#93c5fd" strokeWidth={1} />
          <path d={d} fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <Snowflake cx={x0 + bw - 14} cy={y0 + 14} r={7} />
        </g>
      );
    }
    case 'carbonator': {
      const tw = Math.min(bw * 0.32, 30), th = bh - 16;
      const pr = Math.min(12, bh * 0.25);
      return (
        <g>
          {frame}
          <rect x={x0 + 10} y={y0 + 8} width={tw} height={th} rx={tw / 2.5} fill="#ecfeff" stroke={INK} strokeWidth={1.6} />
          <line x1={x0 + 14} y1={y0 + 8 + th * 0.35} x2={x0 + 6 + tw} y2={y0 + 8 + th * 0.35} stroke="#06b6d4" strokeWidth={1.4} strokeDasharray="3 2" />
          <circle cx={x0 + bw - 12 - pr} cy={cy} r={pr} fill="#fff" stroke={INK} strokeWidth={1.6} />
          <path d={`M${x0 + bw - 12 - pr * 1.6},${cy - pr * 0.6} L${x0 + bw - 12 - pr * 0.1},${cy} L${x0 + bw - 12 - pr * 1.6},${cy + pr * 0.6} Z`} fill={INK} />
          <T x={x0 + 10 + tw / 2} y={y0 + 8 + th * 0.7} size={8}>CO₂</T>
        </g>
      );
    }
    case 'regulator': {
      const s = Math.min(bw, bh) * 0.2;
      return (
        <g>
          <rect x={x0} y={y0} width={bw} height={bh} rx={6} fill="#fff" stroke={INK} strokeWidth={SW} />
          <Bowtie cx={cx} cy={cy + s * 0.8} s={s} />
          <line x1={cx} y1={cy + s * 0.8} x2={cx} y2={cy - s * 0.9} stroke={INK} strokeWidth={1.6} />
          <path d={`M${cx - s * 1.3},${cy - s * 0.9} A${s * 1.3},${s * 1.1} 0 0 1 ${cx + s * 1.3},${cy - s * 0.9} Z`} fill="#e5e7eb" stroke={INK} strokeWidth={1.6} />
          <circle cx={x0 + bw - 9} cy={y0 + 9} r={6} fill="#fff" stroke={INK} strokeWidth={1.3} />
          <line x1={x0 + bw - 9} y1={y0 + 9} x2={x0 + bw - 5.5} y2={y0 + 5.5} stroke="#dc2626" strokeWidth={1.3} />
        </g>
      );
    }
    case 'gas-bottle': {
      const bx = x0 + bw * 0.12, bww = bw * 0.76;
      const top = y0 + 14;
      const col = gasMedium === 'n2' ? '#ede9fe' : gasMedium === 'blandgass' ? '#fae8ff' : '#e5e7eb';
      return (
        <g>
          <rect x={cx - 6} y={y0} width={12} height={10} fill="#fff" stroke={INK} strokeWidth={1.6} />
          <path d={`M${bx},${y0 + bh - 4} L${bx},${top + bww / 2} A${bww / 2},${bww / 2} 0 0 1 ${bx + bww},${top + bww / 2} L${bx + bww},${y0 + bh - 4} Q${bx + bww},${y0 + bh} ${bx + bww - 4},${y0 + bh} L${bx + 4},${y0 + bh} Q${bx},${y0 + bh} ${bx},${y0 + bh - 4} Z`} fill={col} stroke={INK} strokeWidth={SW} />
          <line x1={cx} y1={y0 + 10} x2={cx} y2={top + 2} stroke={INK} strokeWidth={2} />
          <T x={cx} y={y0 + bh * 0.62} size={Math.min(12, bww * 0.32)}>{gasMedium === 'n2' ? 'N₂' : gasMedium === 'blandgass' ? 'MIX' : 'CO₂'}</T>
        </g>
      );
    }
    case 'keg': {
      return (
        <g>
          <path d={`M${x0 + 6},${y0 + 6} Q${x0},${cy} ${x0 + 6},${y0 + bh - 2} L${x0 + bw - 6},${y0 + bh - 2} Q${x0 + bw},${cy} ${x0 + bw - 6},${y0 + 6} Z`} fill="#fef3c7" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <line x1={x0 + 3} y1={y0 + bh * 0.3} x2={x0 + bw - 3} y2={y0 + bh * 0.3} stroke={INK} strokeWidth={1.4} />
          <line x1={x0 + 3} y1={y0 + bh * 0.72} x2={x0 + bw - 3} y2={y0 + bh * 0.72} stroke={INK} strokeWidth={1.4} />
          <rect x={cx - 10} y={y0} width={20} height={7} rx={1.5} fill="#fff" stroke={INK} strokeWidth={1.6} />
          <line x1={cx} y1={y0 + 7} x2={cx} y2={y0 + bh - 8} stroke={INK} strokeWidth={1} strokeDasharray="2 2" />
        </g>
      );
    }
    case 'bib': {
      return (
        <g>
          {frame}
          <path d={`M${x0 + 8},${y0 + 10} Q${cx},${y0 + 2} ${x0 + bw - 8},${y0 + 10} L${x0 + bw - 10},${y0 + bh - 8} Q${cx},${y0 + bh - 2} ${x0 + 10},${y0 + bh - 8} Z`} fill={tint ?? '#fde68a'} stroke={INK} strokeWidth={1.3} />
          <line x1={x0 + 14} y1={y0 + 16} x2={x0 + bw - 18} y2={y0 + bh - 14} stroke={INK} strokeWidth={0.8} opacity={0.5} />
          <T x={cx} y={cy} size={10}>BIB</T>
        </g>
      );
    }
    case 'bibswitch': {
      // to innløp nede som møtes i en vippe og går ut på toppen
      const a = x0 + bw * 0.28, b = x0 + bw * 0.72;
      return (
        <g>
          {frame}
          <path d={`M${a},${y0 + bh} L${a},${cy + 4} L${cx},${cy - 6} M${b},${y0 + bh} L${b},${cy + 4} L${cx},${cy - 6} M${cx},${cy - 6} L${cx},${y0}`} fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <circle cx={cx} cy={cy - 6} r={3.2} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <path d={`M${cx - 8},${cy + 8} L${cx + 8},${cy + 8} M${cx + 4},${cy + 5} L${cx + 8},${cy + 8} L${cx + 4},${cy + 11}`} fill="none" stroke="#64748b" strokeWidth={1.2} />
        </g>
      );
    }
    case 'pump': {
      const r = Math.min(bw, bh) / 2 - 1;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={INK} strokeWidth={SW} />
          <path d={`M${cx - r * 0.55},${cy - r * 0.7} L${cx + r * 0.85},${cy} L${cx - r * 0.55},${cy + r * 0.7} Z`} fill={INK} />
        </g>
      );
    }
    case 'tap': {
      return (
        <g>
          <rect x={x0} y={cy - 7} width={bw * 0.75} height={14} rx={3} fill="#e5e7eb" stroke={INK} strokeWidth={SW} />
          <rect x={x0 + bw * 0.55} y={cy + 7} width={8} height={bh / 2 - 7} fill="#e5e7eb" stroke={INK} strokeWidth={1.6} />
          <rect x={x0 + bw * 0.25} y={y0} width={9} height={cy - 7 - y0} rx={3} fill={INK} />
        </g>
      );
    }
    case 'tower': {
      const n = Math.max(1, def.ports.filter((p) => p.medium !== 'kjol').length);
      const barY = y0 + 6;
      const taps = [];
      for (let i = 0; i < n; i++) {
        const tx = x0 + 10 + ((bw - 20) * (i + 0.5)) / n;
        taps.push(
          <g key={i}>
            <rect x={tx - 3} y={barY + 12} width={6} height={10} fill="#e5e7eb" stroke={INK} strokeWidth={1.3} />
            <rect x={tx - 3} y={barY - 10} width={6} height={10} rx={2} fill={INK} />
          </g>,
        );
      }
      return (
        <g>
          <rect x={x0} y={barY} width={bw} height={12} rx={6} fill="#e5e7eb" stroke={INK} strokeWidth={SW} />
          <rect x={cx - 9} y={barY + 12} width={18} height={bh - 18} fill="#e5e7eb" stroke={INK} strokeWidth={SW} />
          {taps}
        </g>
      );
    }
    case 'filter': {
      return (
        <g>
          <rect x={x0} y={y0} width={bw} height={14} rx={2} fill="#e5e7eb" stroke={INK} strokeWidth={SW} />
          <rect x={x0 + bw * 0.18} y={y0 + 14} width={bw * 0.64} height={bh - 14} rx={bw * 0.2} fill="#dbeafe" stroke={INK} strokeWidth={SW} />
          <line x1={cx} y1={y0 + 20} x2={cx} y2={y0 + bh - 8} stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
        </g>
      );
    }
    case 'water-in': {
      const hatch = [];
      for (let y = y0; y < y0 + bh; y += 6) hatch.push(<line key={y} x1={x0} y1={y + 6} x2={x0 + 6} y2={y} stroke={INK} strokeWidth={1} />);
      return (
        <g>
          <line x1={x0 + 6} y1={y0} x2={x0 + 6} y2={y0 + bh} stroke={INK} strokeWidth={2} />
          {hatch}
          <line x1={x0 + 6} y1={cy} x2={x0 + bw} y2={cy} stroke={INK} strokeWidth={3} />
          <Bowtie cx={x0 + 6 + (bw - 6) / 2} cy={cy} s={7} />
          <line x1={x0 + 6 + (bw - 6) / 2} y1={cy} x2={x0 + 6 + (bw - 6) / 2} y2={cy - 12} stroke={INK} strokeWidth={1.6} />
          <line x1={x0 + (bw - 6) / 2} y1={cy - 12} x2={x0 + 12 + (bw - 6) / 2} y2={cy - 12} stroke={INK} strokeWidth={2.2} />
        </g>
      );
    }
    case 'drain': {
      return (
        <g>
          <path d={`M${x0},${y0} L${x0 + bw},${y0} L${cx + 5},${cy} L${cx - 5},${cy} Z`} fill="#f1f5f9" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d={`M${cx},${cy} L${cx},${cy + bh * 0.25} Q${cx},${y0 + bh} ${cx + 10},${y0 + bh} Q${cx + 18},${y0 + bh} ${cx + 18},${cy + bh * 0.2}`} fill="none" stroke={INK} strokeWidth={3} />
        </g>
      );
    }
    case 'manifold': {
      const outs = def.ports.filter((p) => p.side === 'bottom' || p.side === 'top');
      return (
        <g>
          <rect x={x0} y={cy - 6} width={bw} height={12} rx={2} fill="#e5e7eb" stroke={INK} strokeWidth={SW} />
          {outs.map((p) => {
            const P = portPoint(p, def.w, def.h);
            const dir = p.side === 'bottom' ? 1 : -1;
            return (
              <g key={p.id}>
                <line x1={P.x} y1={cy + 6 * dir} x2={P.x} y2={P.y - dir * M} stroke={INK} strokeWidth={2} />
                <Bowtie cx={P.x} cy={cy + dir * (6 + (bh / 2 - 6) / 2)} s={5} vertical />
              </g>
            );
          })}
        </g>
      );
    }
    case 'prv': {
      const s = Math.min(bw, bh) * 0.22;
      let spring = `M${cx},${cy - s}`;
      for (let i = 0; i < 6; i++) spring += ` L${cx + (i % 2 ? -5 : 5)},${cy - s - 3 - i * 3}`;
      return (
        <g>
          <rect x={x0} y={y0} width={bw} height={bh} rx={4} fill="#fff" stroke={INK} strokeWidth={SW} />
          <Bowtie cx={cx} cy={cy + s * 0.6} s={s} />
          <path d={spring} fill="none" stroke={INK} strokeWidth={1.3} />
          <line x1={cx - s * 1.4} y1={cy + s * 1.8} x2={cx + s * 1.4} y2={cy - s * 0.6} stroke={INK} strokeWidth={1.3} />
          <path d={`M${cx + s * 1.4},${cy - s * 0.6} l-6,1 l3,4 Z`} fill={INK} />
        </g>
      );
    }
    case 'gauge': {
      const r = Math.min(bw, bh) / 2;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={INK} strokeWidth={SW} />
          <line x1={cx} y1={cy} x2={cx + r * 0.55} y2={cy - r * 0.55} stroke="#dc2626" strokeWidth={1.6} />
          <circle cx={cx} cy={cy} r={2} fill={INK} />
        </g>
      );
    }
    case 'fob': {
      return (
        <g>
          <rect x={x0 + bw * 0.2} y={y0} width={bw * 0.6} height={bh} rx={bw * 0.25} fill="#fef3c7" stroke={INK} strokeWidth={SW} />
          <circle cx={cx} cy={cy + bh * 0.1} r={Math.min(bw, bh) * 0.13} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <line x1={x0 + bw * 0.2 + 3} y1={cy - bh * 0.12} x2={x0 + bw * 0.8 - 3} y2={cy - bh * 0.12} stroke="#d97706" strokeWidth={1.2} strokeDasharray="3 2" />
        </g>
      );
    }
    case 'mixer': {
      return (
        <g>
          {frame}
          <path d={`M${x0 + 8},${y0 + bh * 0.3} Q${cx},${y0 + bh * 0.3} ${cx + 6},${cy} M${x0 + 8},${y0 + bh * 0.7} Q${cx},${y0 + bh * 0.7} ${cx + 6},${cy} L${x0 + bw - 10},${cy}`} fill="none" stroke={INK} strokeWidth={1.6} />
          <path d={`M${x0 + bw - 8},${cy} l-7,-4 l0,8 Z`} fill={INK} />
        </g>
      );
    }
    case 'compressor': {
      // ISO-symbol: sirkel med to linjer som møtes mot utløpet, over en tank
      const r = Math.min(bw * 0.28, bh * 0.36);
      const ccx = x0 + bw * 0.62, ccy = y0 + r + 3;
      const tankY = y0 + bh * 0.62;
      return (
        <g>
          <rect x={x0} y={tankY} width={bw} height={bh - (tankY - y0)} rx={(bh - (tankY - y0)) / 2} fill="#e5e7eb" stroke={INK} strokeWidth={SW} />
          <rect x={x0 + 8} y={y0 + 6} width={bw * 0.32} height={tankY - y0 - 6} rx={3} fill="#f8fafc" stroke={INK} strokeWidth={1.6} />
          <line x1={ccx} y1={ccy + r} x2={ccx} y2={tankY} stroke={INK} strokeWidth={2} />
          <circle cx={ccx} cy={ccy} r={r} fill="#fff" stroke={INK} strokeWidth={SW} />
          <path d={`M${ccx - r * 0.75},${ccy - r * 0.62} L${ccx + r * 0.82},${ccy - r * 0.22} M${ccx - r * 0.75},${ccy + r * 0.62} L${ccx + r * 0.82},${ccy + r * 0.22}`} stroke={INK} strokeWidth={1.6} />
          <circle cx={x0 + 8 + bw * 0.16} cy={y0 + 6 + (tankY - y0 - 6) / 2} r={Math.min(6, bw * 0.1)} fill="#fff" stroke={INK} strokeWidth={1.2} />
        </g>
      );
    }
    case 'n2gen': {
      return (
        <g>
          {frame}
          <T x={cx} y={cy} size={Math.min(14, bh * 0.35)} fill="#6d28d9">N₂</T>
        </g>
      );
    }
    case 'icemaker': {
      const s = Math.min(bw, bh) * 0.18;
      return (
        <g>
          {frame}
          <rect x={cx - s * 1.4} y={cy - s * 0.4} width={s * 1.2} height={s * 1.2} fill="#e0f2fe" stroke={INK} strokeWidth={1.2} transform={`rotate(-10 ${cx} ${cy})`} />
          <rect x={cx + s * 0.1} y={cy - s * 0.9} width={s * 1.2} height={s * 1.2} fill="#e0f2fe" stroke={INK} strokeWidth={1.2} transform={`rotate(12 ${cx} ${cy})`} />
        </g>
      );
    }
    case 'coffee': {
      const s = Math.min(bw, bh) * 0.22;
      return (
        <g>
          {frame}
          <path d={`M${cx - s},${cy - s * 0.6} L${cx + s},${cy - s * 0.6} L${cx + s * 0.8},${cy + s} L${cx - s * 0.8},${cy + s} Z`} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <path d={`M${cx + s},${cy - s * 0.3} q${s * 0.7},0 ${s * 0.5},${s * 0.6} q-${s * 0.1},${s * 0.4} -${s * 0.6},${s * 0.4}`} fill="none" stroke={INK} strokeWidth={1.4} />
        </g>
      );
    }
    default:
      return frame;
  }
}

export function SymbolArt({ def, tint }: { def: ComponentDef; tint?: string }) {
  if (def.symbol.startsWith('fit')) return <FittingSymbol def={def} />;
  return (
    <g>
      <Stubs def={def} />
      <EquipmentBody def={def} tint={tint} />
    </g>
  );
}

/** Liten forhåndsvisning (brukes i bibliotek) */
export function SymbolPreview({ def, size = 40 }: { def: ComponentDef; size?: number }) {
  const pad = 2;
  return (
    <svg width={size} height={size} viewBox={`${-pad} ${-pad} ${def.w + pad * 2} ${def.h + pad * 2}`} preserveAspectRatio="xMidYMid meet">
      <SymbolArt def={def} />
    </svg>
  );
}
