import type { ComponentDef, PortDef, Side } from '../lib/types';

type P = [side: Side, at: number, name: string, kind: PortDef['kind'], size: string, medium?: string, extra?: Partial<PortDef>];

const G = '5/16"'; // standard gass-slange
const L = '3/8"'; // standard væske-slange

function def(
  id: string, name: string, category: string, symbol: string, w: number, h: number, ports: P[], note?: string,
): ComponentDef {
  return {
    id: 'start-' + id,
    name,
    group: 'Utstyr',
    category,
    symbol,
    w,
    h,
    source: 'start',
    note,
    ports: ports.map(([side, at, pname, kind, size, medium, extra], i) => ({
      id: 'p' + (i + 1),
      name: pname,
      side,
      pos: side === 'left' || side === 'right' ? at / h : at / w,
      kind,
      size,
      medium: medium ?? 'any',
      ...(extra ?? {}),
    })),
  };
}

function cooler(id: string, name: string, lines: number, category = 'Øl'): ComponentDef {
  const h = 20 * (lines + 1) + 60;
  const ports: P[] = [];
  for (let i = 0; i < lines; i++) ports.push(['left', 20 + i * 20, `Produkt inn ${i + 1}`, 'push', L, 'any', { link: 'l' + (i + 1) }]);
  for (let i = 0; i < lines; i++) ports.push(['right', 20 + i * 20, `Produkt ut ${i + 1}`, 'push', L, 'any', { link: 'l' + (i + 1) }]);
  ports.push(['right', h - 40, 'Kjøleloop ut', 'push', '1/2"', 'any', { link: 'kl' }]);
  ports.push(['right', h - 20, 'Kjøleloop retur', 'push', '1/2"', 'any', { link: 'kl' }]);
  return def(id, name, category, 'cooler', 140, h, ports, 'Kjøler med kjøleloop for pytonrør');
}

function tower(id: string, name: string, taps: number): ComponentDef {
  const w = 20 * (taps + 2) + 20;
  const ports: P[] = [];
  for (let i = 0; i < taps; i++) ports.push(['bottom', 20 + i * 20, `Produkt inn ${i + 1}`, 'push', L, 'any', { link: 'l' + (i + 1) }]);
  ports.push(['bottom', 20 + taps * 20, 'Kjøleloop inn', 'push', '1/2"', 'any', { link: 'k' }]);
  ports.push(['bottom', 40 + taps * 20, 'Kjøleloop ut', 'push', '1/2"', 'any', { link: 'k' }]);
  return def(id, name, 'Øl', 'tower', w, 100, ports);
}

function postmixCooler(sirups: number): ComponentDef {
  const h = 20 * (sirups + 5) + 20;
  const ports: P[] = [
    ['left', 20, 'Vann inn', 'push', L, 'vann'],
    ['left', 40, 'CO₂ inn', 'push', G, 'co2'],
  ];
  for (let i = 0; i < sirups; i++) ports.push(['left', 80 + i * 20, `Sirup inn ${i + 1}`, 'push', L, 'sirup', { link: 's' + (i + 1) }]);
  ports.push(['right', 20, 'Kullsyrevann ut', 'push', L, 'kullsyrevann']);
  ports.push(['right', 40, 'Stille vann ut', 'push', L, 'vann']);
  for (let i = 0; i < sirups; i++) ports.push(['right', 80 + i * 20, `Sirup ut ${i + 1}`, 'push', L, 'sirup', { link: 's' + (i + 1) }]);
  ports.push(['right', h - 40, 'Kjøleloop ut', 'push', '1/2"', 'any', { link: 'kl' }]);
  ports.push(['right', h - 20, 'Kjøleloop retur', 'push', '1/2"', 'any', { link: 'kl' }]);
  return def(`postmixkjoler-${sirups}`, `Postmixkjøler m/karbonator, ${sirups} sirup`, 'Postmix', 'cooler', 160, h, ports);
}

function postmixValve(sirups: number): ComponentDef {
  const h = 20 * (sirups + 2) + 20;
  const ports: P[] = [
    ['left', 20, 'Kullsyrevann inn', 'push', L, 'kullsyrevann'],
    ['left', 40, 'Stille vann inn', 'push', L, 'vann'],
  ];
  for (let i = 0; i < sirups; i++) ports.push(['left', 60 + i * 20, `Sirup inn ${i + 1}`, 'push', L, 'sirup']);
  return def(`postmixkran-${sirups}`, sirups === 1 ? 'Postmixventil, 1 sirup' : `Postmixventil, ${sirups} sirup`, 'Postmix', 'tap', 80, h, ports);
}

function regulator(id: string, name: string, gas: string, outs: number, primary: boolean): ComponentDef {
  const h = outs <= 1 ? 60 : 20 * (outs + 1);
  const ports: P[] = [
    primary
      ? ['left', h / 2, 'Inn (flaske)', 'thread', gas === 'n2' ? 'W24.32' : 'W21.8', gas, { std: gas === 'n2' ? 'W24.32' : 'W21.8', gender: 'F', link: 'g' }]
      : ['left', h / 2, 'Inn', 'push', G, gas, { link: 'g' }],
  ];
  if (outs <= 1) ports.push(['right', h / 2, 'Ut', 'push', G, gas, { link: 'g' }]);
  else for (let i = 0; i < outs; i++) ports.push(['right', 20 + i * 20, `Ut ${i + 1}`, 'push', G, gas, { link: 'g' }]);
  return def(id, name, 'Gass', 'regulator', 60, h, ports);
}

export const STARTER: ComponentDef[] = [
  // ---- Gass
  def('co2-flaske', 'CO₂-flaske', 'Gass', 'gas-bottle', 60, 100, [['top', 30, 'Flaskeventil', 'thread', 'W21.8', 'co2', { std: 'W21.8', gender: 'M' }]]),
  def('n2-flaske', 'N₂-flaske', 'Gass', 'gas-bottle', 60, 100, [['top', 30, 'Flaskeventil', 'thread', 'W24.32', 'n2', { std: 'W24.32', gender: 'M' }]]),
  def('blandgass-flaske', 'Blandgassflaske (CO₂/N₂)', 'Gass', 'gas-bottle', 60, 100, [['top', 30, 'Flaskeventil', 'thread', 'W24.32', 'blandgass', { std: 'W24.32', gender: 'M' }]]),
  regulator('reg-co2-1', 'Primærregulator CO₂, 1 uttak', 'co2', 1, true),
  regulator('reg-co2-2', 'Primærregulator CO₂, 2 uttak', 'co2', 2, true),
  regulator('reg-n2-1', 'Primærregulator N₂, 1 uttak', 'n2', 1, true),
  regulator('reg-sek-1', 'Sekundærregulator (veggregulator)', 'any', 1, false),
  regulator('reg-sek-2', 'Sekundærregulator, 2 uttak', 'any', 2, false),
  def('gassfordeler-4', 'Gassfordeler 4-veis m/ventiler', 'Gass', 'manifold', 100, 60, [
    ['left', 30, 'Inn', 'push', G, 'any', { link: 'g' }],
    ['bottom', 20, 'Ut 1', 'push', G, 'any', { link: 'g' }],
    ['bottom', 40, 'Ut 2', 'push', G, 'any', { link: 'g' }],
    ['bottom', 60, 'Ut 3', 'push', G, 'any', { link: 'g' }],
    ['bottom', 80, 'Ut 4', 'push', G, 'any', { link: 'g' }],
  ]),
  def('gassblander', 'Gassblander CO₂/N₂', 'Gass', 'mixer', 80, 60, [
    ['left', 20, 'CO₂ inn', 'push', G, 'co2'],
    ['left', 40, 'N₂ inn', 'push', G, 'n2'],
    ['right', 30, 'Blandgass ut', 'push', G, 'blandgass'],
  ]),
  def('n2-generator', 'N₂-generator', 'Gass', 'n2gen', 80, 60, [
    ['left', 30, 'Trykkluft inn', 'push', G, 'luft'],
    ['right', 30, 'N₂ ut', 'push', G, 'n2'],
  ]),
  def('manometer', 'Manometer', 'Gass', 'gauge', 40, 40, [['bottom', 20, 'Tilkobling', 'other', '', 'any']]),
  def('luftkompressor', 'Luftkompressor', 'Gass', 'compressor', 100, 80, [['right', 30, 'Trykkluft ut', 'push', L, 'luft']], 'Luftkompressor for gassdrevne pumper eller N₂-generator'),

  // ---- Øl
  def('olfat', 'Ølfat m/kobling', 'Øl', 'keg', 60, 80, [
    ['top', 20, 'Gass inn', 'push', G, 'any'],
    ['top', 40, 'Øl ut', 'push', L, 'ol'],
  ]),
  cooler('olkjoler-2', 'Ølkjøler, 2 linjer', 2),
  cooler('olkjoler-4', 'Ølkjøler, 4 linjer', 4),
  cooler('olkjoler-6', 'Ølkjøler, 6 linjer', 6),
  cooler('olkjoler-8', 'Ølkjøler, 8 linjer', 8),
  tower('tarn-1', 'Øltårn, 1 kran', 1),
  tower('tarn-2', 'Øltårn, 2 kraner', 2),
  tower('tarn-3', 'Øltårn, 3 kraner', 3),
  tower('tarn-4', 'Øltårn, 4 kraner', 4),
  def('olkran', 'Ølkran', 'Øl', 'tap', 60, 60, [['left', 30, 'Øl inn', 'push', L, 'ol']]),
  def('fob', 'Skumstopper (FOB)', 'Øl', 'fob', 40, 80, [
    ['bottom', 20, 'Inn', 'push', L, 'any', { link: 'a' }],
    ['top', 20, 'Ut', 'push', L, 'any', { link: 'a' }],
  ]),

  // ---- Postmix
  def('bib', 'Bag-in-box (sirup)', 'Postmix', 'bib', 80, 60, [['right', 30, 'Sirup ut', 'push', L, 'sirup']]),
  def('bib-pumpe', 'Pumpe', 'Postmix', 'pump', 60, 60, [
    ['left', 30, 'Sirup inn', 'push', L, 'sirup', { link: 's' }],
    ['right', 30, 'Sirup ut', 'push', L, 'sirup', { link: 's' }],
    ['top', 30, 'Drivgass inn', 'push', G, 'any'],
  ]),
  def('bagveksler', 'Bagveksler', 'Postmix', 'bibswitch', 60, 60, [
    ['bottom', 20, 'Sirup inn 1', 'push', L, 'sirup', { link: 's' }],
    ['bottom', 40, 'Sirup inn 2', 'push', L, 'sirup', { link: 's' }],
    ['top', 30, 'Sirup ut', 'push', L, 'sirup', { link: 's' }],
  ], 'Bytter automatisk til neste BIB når den første er tom'),
  def('karbonator', 'Karbonator', 'Postmix', 'carbonator', 120, 80, [
    ['left', 20, 'Vann inn', 'push', L, 'vann'],
    ['left', 60, 'CO₂ inn', 'push', G, 'co2'],
    ['right', 40, 'Kullsyrevann ut', 'push', L, 'kullsyrevann'],
  ]),
  postmixCooler(4),
  postmixCooler(6),
  postmixValve(1),
  postmixValve(4),

  // ---- Vann
  def('vanninntak', 'Vanninntak (stoppekran)', 'Vann', 'water-in', 60, 40, [['right', 20, 'Vann ut', 'push', L, 'vann']]),
  def('trykkreduksjon', 'Trykkreduksjonsventil', 'Vann', 'prv', 60, 60, [
    ['left', 30, 'Inn', 'push', L, 'vann', { link: 'a' }],
    ['right', 30, 'Ut', 'push', L, 'vann', { link: 'a' }],
  ]),
  def('vannfilter', 'Vannfilter m/filterhode', 'Vann', 'filter', 60, 100, [
    ['left', 20, 'Inn', 'push', L, 'vann', { link: 'a' }],
    ['right', 20, 'Ut', 'push', L, 'vann', { link: 'a' }],
  ]),
  def('vannkjoler', 'Vannkjøler m/kullsyre', 'Vann', 'cooler', 140, 80, [
    ['left', 20, 'Vann inn', 'push', L, 'vann'],
    ['left', 60, 'CO₂ inn', 'push', G, 'co2'],
    ['right', 20, 'Kaldt stille vann ut', 'push', L, 'vann'],
    ['right', 40, 'Kullsyrevann ut', 'push', L, 'kullsyrevann'],
  ]),
  def('vannkran', 'Vannkran (stille + kullsyre)', 'Vann', 'tap', 60, 60, [
    ['left', 20, 'Stille vann inn', 'push', L, 'vann'],
    ['left', 40, 'Kullsyrevann inn', 'push', L, 'kullsyrevann'],
  ]),
  def('avlop', 'Avløp', 'Vann', 'drain', 60, 60, [['top', 30, 'Inn', 'other', '', 'avlop']]),

  // ---- Annet
  def('ismaskin', 'Ismaskin', 'Annet', 'icemaker', 80, 80, [
    ['left', 40, 'Vann inn', 'thread', '3/4"', 'vann', { std: 'BSP', gender: 'M' }],
    ['bottom', 40, 'Avløp', 'other', '', 'avlop'],
  ]),
  def('kaffemaskin', 'Kaffemaskin', 'Annet', 'coffee', 80, 80, [
    ['left', 40, 'Vann inn', 'thread', '3/8"', 'vann', { std: 'BSP', gender: 'M' }],
    ['bottom', 40, 'Avløp', 'other', '', 'avlop'],
  ]),
  def('boks', 'Generell enhet', 'Annet', 'box', 80, 40, [
    ['left', 20, 'Inn', 'push', L, 'any'],
    ['right', 20, 'Ut', 'push', L, 'any'],
  ]),
];
