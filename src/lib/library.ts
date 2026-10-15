import type { Blueprint, ComponentDef } from './types';
import { DEFAULT_FLAVORS, type Flavor } from './constants';
import { STARTER } from '../data/starter';
import dmfitRaw from '../data/dmfit.json';
import { api } from './api';

import { makeGenerics } from './generic';

export const BUILTIN: ComponentDef[] = [...STARTER, ...makeGenerics(dmfitRaw as ComponentDef[]), ...(dmfitRaw as ComponentDef[])];

export interface UserLibrary {
  version: 1;
  /** egne komponenter og endrede innebygde (samme id overstyrer) */
  items: ComponentDef[];
  /** skjulte innebygde id-er */
  hidden: string[];
  favorites: string[];
  /** smaker for BIB med farge */
  flavors?: Flavor[];
  /** egen rekkefølge i biblioteket: «items:<gruppe>» og «cat:<seksjon>» */
  order?: Record<string, string[]>;
  /** lagrede oppsett */
  blueprints?: Blueprint[];
  /** favorittslanger (høyreklikk på tomt sted) */
  hoseFavs?: HoseFav[];
}

export interface HoseFav { id: string; name?: string; size: string; color: string; medium: string; tube: string }

export function flavorsOf(lib: UserLibrary): Flavor[] {
  return lib.flavors ?? DEFAULT_FLAVORS;
}

export function emptyUserLib(): UserLibrary {
  return { version: 1, items: [], hidden: [], favorites: [] };
}

export async function loadUserLibrary(): Promise<UserLibrary> {
  try {
    const raw = await api.loadLibrary();
    if (!raw) return emptyUserLib();
    const parsed = JSON.parse(raw);
    return { ...emptyUserLib(), ...parsed };
  } catch {
    return emptyUserLib();
  }
}

export async function saveUserLibrary(lib: UserLibrary) {
  await api.saveLibrary(JSON.stringify(lib, null, 1));
}

export function effectiveLibrary(user: UserLibrary): ComponentDef[] {
  const overrides = new Map(user.items.map((i) => [i.id, i]));
  const hidden = new Set(user.hidden);
  const out: ComponentDef[] = [];
  for (const b of BUILTIN) {
    if (hidden.has(b.id)) continue;
    out.push(overrides.get(b.id) ?? b);
    overrides.delete(b.id);
  }
  for (const u of overrides.values()) if (!hidden.has(u.id)) out.push(u);
  return out;
}

export function isBuiltin(id: string) {
  return BUILTIN.some((b) => b.id === id);
}
