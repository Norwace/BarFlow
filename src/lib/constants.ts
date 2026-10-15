export interface Medium {
  id: string;
  name: string;
  color: string;
  dash?: string;
  /** prikker oppå streken (farge) */
  dots?: string;
}

export const MEDIA: Medium[] = [
  { id: 'co2', name: 'CO₂', color: '#7b8494' },
  { id: 'n2', name: 'N₂', color: '#7c4dff' },
  { id: 'blandgass', name: 'Blandgass', color: '#c026d3' },
  { id: 'luft', name: 'Trykkluft', color: '#cbd5e1' },
  { id: 'vann', name: 'Vann', color: '#2563eb' },
  { id: 'kullsyrevann', name: 'Kullsyrevann', color: '#06b6d4', dots: '#4b5563' },
  { id: 'ol', name: 'Øl', color: '#d97706' },
  { id: 'sirup', name: 'Sirup', color: '#92400e' },
  { id: 'kjol', name: 'Kjøl (loop)', color: '#16a34a' },
  { id: 'avlop', name: 'Avløp', color: '#475569', dash: '8 4' },
  { id: 'annet', name: 'Annet', color: '#64748b' },
];

export const MEDIUM_ANY = 'any';

export function mediumById(id?: string): Medium | undefined {
  return MEDIA.find((m) => m.id === id);
}

export function mediumName(id?: string): string {
  if (!id || id === MEDIUM_ANY) return 'Alle';
  if (id === 'auto') return 'Automatisk';
  return mediumById(id)?.name ?? id;
}

export const TUBE_SIZES = ['5/32"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '4mm', '6mm', '8mm', '10mm', '12mm', '15mm', '22mm'];

export const TUBE_TYPES = [
  { id: 'PE', name: 'PE-slange' },
  { id: 'PE-barriere', name: 'Barriereslange' },
  { id: 'PVC', name: 'PVC/armert slange' },
  { id: 'annet', name: 'Annen slange' },
];

export const TUBE_COLORS = ['', 'Natur', 'Blå', 'Lyseblå', 'Rød', 'Rosa', 'Svart', 'Grønn', 'Limegrønn', 'Gul', 'Lysegul', 'Hvit', 'Grå', 'Oransje', 'Lilla', 'Brun', 'Lysebrun'];

export const TUBE_COLOR_HEX: Record<string, string> = {
  Natur: '#c9bd94', Blå: '#2563eb', Rød: '#dc2626', Svart: '#111827', Grønn: '#16a34a', Gul: '#eab308',
  Hvit: '#ffffff', Grå: '#9ca3af', Oransje: '#ea580c', Lilla: '#9333ea', Brun: '#78350f',
  Lyseblå: '#7dd3fc', Limegrønn: '#a3e635', Lysebrun: '#c4935a', Rosa: '#f472b6', Lysegul: '#fde047',
};

/** Farger som trenger mørk kant for å synes på hvit bakgrunn */
export const LIGHT_COLORS = new Set(['Hvit', 'Natur', 'Gul', 'Lysegul', 'Lyseblå', 'Limegrønn']);

/** Farger for produktslanger i pytonrør */
export const PYTHON_COLORS = [
  { name: 'Rød', hex: '#dc2626' },
  { name: 'Blå', hex: '#2563eb' },
  { name: 'Grønn', hex: '#16a34a' },
  { name: 'Gul', hex: '#eab308' },
  { name: 'Hvit', hex: '#f8fafc' },
  { name: 'Svart', hex: '#111827' },
  { name: 'Oransje', hex: '#ea580c' },
  { name: 'Lilla', hex: '#9333ea' },
  { name: 'Brun', hex: '#78350f' },
  { name: 'Grå', hex: '#9ca3af' },
  { name: 'Natur', hex: '#e5e7eb' },
  { name: 'Rosa', hex: '#f472b6' },
  { name: 'Lyseblå', hex: '#7dd3fc' },
  { name: 'Limegrønn', hex: '#a3e635' },
  { name: 'Lysebrun', hex: '#c4935a' },
  { name: 'Lysegul', hex: '#fde047' },
];

export function pythonColorHex(name: string): string {
  return PYTHON_COLORS.find((c) => c.name === name)?.hex ?? '#9ca3af';
}

export const DEFAULT_PYTHON_ORDER = ['Rød', 'Blå', 'Grønn', 'Gul', 'Oransje', 'Lilla', 'Brun', 'Svart', 'Grå', 'Rosa'];

/** medier som kan gå i en produktslange */
export const PRODUCT_MEDIA = ['any', 'ol', 'sirup', 'vann', 'kullsyrevann', 'annet'];
export const COOL_MEDIA = ['vann', 'kullsyrevann'];

/** Smaker for BIB (navn og slangefarge) */
export interface Flavor { name: string; color: string }
export const DEFAULT_FLAVORS: Flavor[] = [
  { name: 'Bringebær', color: 'Rosa' },
  { name: 'Tyttebær', color: 'Oransje' },
  { name: 'Grønn iste', color: 'Grønn' },
  { name: 'Sitron', color: 'Lysegul' },
  { name: 'Cola', color: 'Brun' },
  { name: 'Cola sukkerfri', color: 'Lysebrun' },
  { name: 'Pære', color: 'Lyseblå' },
];

/** Dimensjoner for gjengeporter */
export const THREAD_SIZES = ['1/8"', '1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '7/8"', '1"', '1 1/4"', 'W21.8', 'W24.32', 'M10', 'M12', 'M14', 'M16', 'M18', 'M22'];
/** Dimensjoner for slanger, push-fit og stammer */
export const PORT_SIZES = ['5/32"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '4mm', '6mm', '8mm', '10mm', '12mm', '15mm', '22mm'];

export const THREAD_STDS = ['BSP', 'BSPT', 'NPTF', 'UNF', 'UNS', 'UN', 'MFL', 'W21.8', 'Metrisk', 'Annet'];

export const KIND_NAMES: Record<string, string> = {
  push: 'Push-fit (tar slange)',
  stem: 'Stamme (plugges i push-fit)',
  thread: 'Gjenger',
  hosetail: 'Slangestuss',
  other: 'Annet',
};

export const KIND_SHORT: Record<string, string> = {
  push: 'push',
  stem: 'stamme',
  thread: 'gjenge',
  hosetail: 'stuss',
  other: 'annet',
};

export const GRID = 10;
