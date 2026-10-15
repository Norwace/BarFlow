import type { ComponentDef, PortDef, PortFlow } from './types';

/** Gjett retning ut fra portnavnet («Vann inn», «Sirup ut», «Kjøleloop retur» …) */
export function inferFlow(name: string): PortFlow {
  const n = ` ${name.toLowerCase()} `;
  if (/[\s(](ut|uttak|ut\d)[\s)\d]/.test(n) || n.includes('flaskeventil')) return 'out';
  if (/[\s(](inn|retur|tilkobling)[\s)\d]/.test(n)) return 'in';
  if (n.includes('avløp')) return 'out';
  return 'both';
}

/** Retning på porten. Koblinger og slanger går begge veier */
export function portFlow(p: PortDef, def?: ComponentDef): PortFlow {
  if (p.flow) return p.flow;
  if (p.kind === 'tube') return 'both';
  if (def && def.group !== 'Utstyr') return 'both';
  return inferFlow(p.name);
}

export const FLOW_NAMES: Record<PortFlow, string> = { in: 'Inn', out: 'Ut', both: 'Begge veier' };
