declare const __APP_VERSION__: string;

/** Versjon fra package.json, f.eks. «0.12.0» */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

/** Kort visning: 0.12.0 → v0.12, 0.11.1 → v0.11.1 */
export const VERSION_LABEL = APP_VERSION ? 'v' + APP_VERSION.replace(/\.0$/, '') : '';
