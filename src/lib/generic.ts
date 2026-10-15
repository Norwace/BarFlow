import type { ComponentDef } from './types';
import { normSize } from './geometry';

/** Koblingsformer som får størrelse når de kobles til slange eller port */
export const GENERIC_SHAPES = [
  { fam: 'UC', base: 'AUC 0606', name: 'Rett skjøt' },
  { fam: 'EU', base: 'AEU 0606', name: 'Vinkel' },
  { fam: 'TU', base: 'ATU 060606', name: 'T-stykke' },
  { fam: 'UB', base: 'AUB 0606', name: 'U-bend' },
  { fam: 'TWD', base: 'ATWD 0606', name: 'Y-stykke' },
  { fam: 'HUC', base: 'AHUC 0606', name: 'Håndventil' },
];

export const GENERIC_CAT = 'Form – størrelse velges automatisk';

export function makeGenerics(dmfit: ComponentDef[]): ComponentDef[] {
  const out: ComponentDef[] = [];
  for (const g of GENERIC_SHAPES) {
    const b = dmfit.find((d) => d.artnr === g.base);
    if (!b) continue;
    out.push({
      ...b,
      id: `gen-${g.fam}`,
      name: g.name,
      artnr: undefined,
      category: GENERIC_CAT,
      generic: g.fam,
      note: `${g.fam} – størrelse velges når den kobles til slange eller port`,
      ports: b.ports.map((p) => ({ ...p, size: '' })),
      tags: `${g.name} form automatisk størrelse`,
    });
  }
  return out;
}

const famOf = (d: ComponentDef) => (d.note ?? '').split(' – ')[0];

/** Riktig DMfit-kobling i valgt størrelse (grå acetal først) */
export function resolveGeneric(fam: string, size: string, lib: ComponentDef[]): ComponentDef | null {
  const s = normSize(size);
  const fits = lib.filter((d) => !d.generic && famOf(d) === fam && d.ports.every((p) => normSize(p.size) === s));
  if (!fits.length) return null;
  const pref = ['Acetal grå (tommer)', 'Håndventiler', 'Acetal hvit (tommer)', 'Polypropylen hvit (tommer)'];
  fits.sort((a, b) => {
    const ia = pref.indexOf(a.category), ib = pref.indexOf(b.category);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || (a.artnr ?? '').localeCompare(b.artnr ?? '');
  });
  return fits[0];
}
