import type { HoseData } from './types';
import { mediumById, TUBE_COLOR_HEX, LIGHT_COLORS, type Flavor } from './constants';

export interface HoseLook {
  color: string;
  /** lys farge som trenger mørk kant */
  light: boolean;
  dash?: string;
  /** prikker oppå streken (kullsyrevann) */
  dots?: string;
  /** navn på fargen som vises (for tekst) */
  flavor?: string;
  /** kantfarge (lyse slanger) */
  outline?: string;
  /** lyse striper inni slangen (trykkluft) */
  stripe?: string;
}

export function flavorColorName(flavor: string | undefined, flavors: Flavor[]): string | undefined {
  if (!flavor) return undefined;
  return flavors.find((f) => f.name === flavor)?.color;
}

/** Hvordan slangen tegnes: egen farge > smak fra BIB > medium */
export function hoseLook(h: HoseData, medium: string | undefined, flavor: string | undefined, flavors: Flavor[]): HoseLook {
  const m = mediumById(medium);
  const dots = m?.dots;
  if (h.color && TUBE_COLOR_HEX[h.color]) return { color: TUBE_COLOR_HEX[h.color], light: LIGHT_COLORS.has(h.color), dots, flavor };
  const fc = flavorColorName(flavor, flavors);
  if (fc && TUBE_COLOR_HEX[fc]) return { color: TUBE_COLOR_HEX[fc], light: LIGHT_COLORS.has(fc), dots, flavor };
  // trykkluft: lys grå slange med grå kant og hvite striper
  if (medium === 'luft') return { color: '#cbd5e1', light: true, outline: '#64748b', stripe: '#ffffff', dots };
  return { color: m?.color ?? '#334155', light: false, dash: m?.dash, dots };
}

/**
 * Drift: slangen får fargen til mediet som faktisk er i den.
 * Er det samme medium som i tegningen, beholdes vanlig farge (egen farge, smak).
 */
export function shownHose(h: HoseData, medium: string | undefined, flavor: string | undefined, simMedia?: string[]): { data: HoseData; medium?: string; flavor?: string; mixed?: string[] } {
  if (simMedia && simMedia.length > 1) return { data: h, medium, flavor, mixed: simMedia };
  if (simMedia && simMedia.length === 1) {
    const i = simMedia[0].indexOf('|');
    const m = i < 0 ? simMedia[0] : simMedia[0].slice(0, i);
    const f = i < 0 ? undefined : simMedia[0].slice(i + 1);
    if (m === medium && (!f || f === flavor)) return { data: h, medium, flavor };
    return { data: { ...h, color: '' }, medium: m, flavor: f };
  }
  return { data: h, medium, flavor };
}

/** Synlig glød-farge (lyse farger blir litt mørkere så de synes på hvitt) */
export function glowColor(hex: string): string {
  const v = parseInt(hex.replace('#', ''), 16);
  if (isNaN(v)) return hex;
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 200) return hex;
  const k = 0.72;
  const h2 = (x: number) => Math.round(x * k).toString(16).padStart(2, '0');
  return `#${h2(r)}${h2(g)}${h2(b)}`;
}

/** Lys utgave av en farge (fyll i symboler, så teksten synes) */
export function tintColor(hex: string, amount = 0.5): string {
  const v = parseInt(hex.replace('#', ''), 16);
  if (isNaN(v)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix((v >> 16) & 255)}${mix((v >> 8) & 255)}${mix(v & 255)}`;
}
