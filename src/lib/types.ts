export type Side = 'left' | 'right' | 'top' | 'bottom';

export type ConnKind = 'push' | 'stem' | 'thread' | 'hosetail' | 'tube' | 'other';

export type Gender = 'M' | 'F';

export interface PortDef {
  id: string;
  name: string;
  side: Side;
  /** 0..1 langs siden */
  pos: number;
  kind: ConnKind;
  /** f.eks. 3/8" eller 8mm, eller gjengestørrelse 1/2" */
  size: string;
  /** gjengestandard: BSP, BSPT, NPTF, UNF, UNS, UN, MFL, W21.8 ... */
  std?: string;
  gender?: Gender;
  /** medium som går gjennom porten. 'any' = alle */
  medium?: string;
  /** farge på porten (brukes for pytonrør) */
  color?: string;
  /** porter med samme link er koblet sammen inni komponenten (f.eks. kjøler inn1/ut1) */
  link?: string;
  /** strømningsretning: inn, ut eller begge veier. Mangler = tolkes fra navnet */
  flow?: PortFlow;
}

export type PortFlow = 'in' | 'out' | 'both';

export interface ComponentDef {
  id: string;
  name: string;
  artnr?: string;
  maker?: string;
  /** hovedkategori, f.eks. "Koblinger" eller "Utstyr" */
  group: string;
  /** underkategori, f.eks. "Øl" eller "Acetal grå (tomme)" */
  category: string;
  symbol: string;
  w: number;
  h: number;
  ports: PortDef[];
  note?: string;
  source: 'dmfit' | 'start' | 'user';
  /** søkeord */
  tags?: string;
  /** koblingsform uten størrelse (familiekode, f.eks. «UC»). Får størrelse når den kobles til */
  generic?: string;
  /** oppførsel i drift-modus (mangler = automatisk ut fra symbol) */
  sim?: { role?: SimRole; needs?: string[] };
}

export type SimRole = 'auto' | 'source' | 'bib' | 'container' | 'pump' | 'power' | 'machine' | 'tap' | 'drain' | 'passive';

export interface CompNodeData extends Record<string, unknown> {
  def: ComponentDef;
  rotation: number; // 0, 90, 180, 270
  flip?: boolean;
  label?: string;
  note?: string;
  /** valgt medium for porter som ellers tar alle medier */
  medium?: string;
  /** smak (BIB) */
  flavor?: string;
  /** lagt inn automatisk (skjøt mellom åpne ender) */
  auto?: boolean;
}

export interface PythonEndData extends Record<string, unknown> {
  pythonId: string;
  end: 'A' | 'B';
  rotation: number;
}

export interface TextNodeData extends Record<string, unknown> {
  text: string;
  size?: number;
}

export interface HoseData extends Record<string, unknown> {
  kind: 'hose';
  tube: string; // 'PE'
  size: string; // 3/8"
  medium: string; // 'auto' eller medium-id
  color: string; // fysisk slangefarge
  length: number | null; // meter
  counted: boolean;
  note?: string;
  name?: string;
  /** knekkpunkter i tegningen (flow-koordinater). undefined = automatisk bane */
  points?: { x: number; y: number }[];
  /** overstyring av automatisk kobling i hver ende: undefined = auto, 'none' = ingen, ellers komponent-id */
  fitS?: string;
  fitT?: string;
  /** retning slangen går ut av porten: undefined = automatisk (vinkel hvis vinkelkobling), 'straight' = rett ut, ellers sving mot opp/ned/venstre/høyre */
  dirS?: HoseDir;
  dirT?: HoseDir;
}

export type HoseDir = 'straight' | 'up' | 'down' | 'left' | 'right';

export interface DirectData extends Record<string, unknown> {
  kind: 'direct';
}

export interface PythonBodyData extends Record<string, unknown> {
  kind: 'python';
  pythonId: string;
  points?: { x: number; y: number }[];
}

export interface PythonDef {
  id: string;
  name: string;
  products: number; // 2..10
  productSize: string;
  productColors: string[];
  coolSize: string;
  coolCount: number; // alltid 2
  /** medium i kjøleloopen: vann eller kullsyrevann */
  coolMedium?: string;
  /** medium per produktslange */
  productMedia?: string[];
  /** innhold/navn per produktslange, f.eks. «Pilsner» */
  productNames?: string[];
  length: number | null;
  artnr?: string;
  note?: string;
}

export interface ProjectInfo {
  kunde: string;
  prosjekt: string;
  adresse: string;
  dato: string;
  tegnetAv: string;
  notat: string;
}

export interface ProjectFile {
  app: 'BarFlow';
  version: number;
  info: ProjectInfo;
  nodes: any[];
  edges: any[];
  pythons: PythonDef[];
  ignored?: string[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface Warning {
  id: string;
  target: { type: 'edge' | 'node'; id: string };
  text: string;
  /** brukeren har krysset av for å ignorere – vises bare i lista */
  ignored?: boolean;
}

/** Ferdig oppsett av komponenter, slanger og koblinger som kan settes inn igjen */
export interface Blueprint {
  id: string;
  name: string;
  category: string;
  /** posisjoner relativt til øvre venstre hjørne */
  nodes: any[];
  edges: any[];
  pythons: PythonDef[];
  w: number;
  h: number;
  created: string;
}
