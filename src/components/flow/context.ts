import { createContext, useContext } from 'react';
import type { Analysis } from '../../lib/compat';
import type { SimResult } from '../../lib/sim';

export const AnalysisContext = createContext<Analysis | null>(null);
export const useAnalysis = () => useContext(AnalysisContext);

export interface DragHint {
  insertEdge?: string | null;
  snapPort?: { x: number; y: number } | null;
}
export const DragHintContext = createContext<DragHint>({});

/** Det som henger sammen med valgt element (lyser opp) */
export interface HighlightSet {
  nodes: Set<string>;
  edges: Set<string>;
  /** «nodeId:portId» som lyser (brukes for slangene i pytonrør) */
  ports: Set<string>;
  /** glødfarge per node og slange */
  nodeColor: Map<string, string>;
  edgeColor: Map<string, string>;
}
export const HighlightContext = createContext<HighlightSet | null>(null);
export const useHighlight = () => useContext(HighlightContext);

/** Resultat fra drift-modus (null når den er av) */
export const SimContext = createContext<SimResult | null>(null);
export const useSim = () => useContext(SimContext);
