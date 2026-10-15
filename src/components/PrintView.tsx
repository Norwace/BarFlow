import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { computeParts } from '../lib/parts';
import { PartsTable } from './PartsPanel';
import { analyze } from '../lib/compat';
import { MEDIA, TUBE_COLOR_HEX } from '../lib/constants';
import { flavorsOf } from '../lib/library';

const PAGE: Record<string, { w: number; h: number }> = { A4: { w: 297, h: 210 }, A3: { w: 420, h: 297 } };

export default function PrintView() {
  const [img, setImg] = useState<{ url: string; w: number; h: number } | null>(null);
  const st = useStore();
  useEffect(() => {
    (window as any).__bfSetPrint = (i: any) => setImg(i);
    return () => { delete (window as any).__bfSetPrint; };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('bf-printing', !!img);
  }, [img]);
  const an = useMemo(() => (img ? analyze(st.nodes, st.edges, st.pythons, st.library, st.settings.autoFittings, new Set(st.ignored)) : null), [img]);
  const rows = useMemo(() => (img && an ? computeParts(st.nodes, st.edges, st.pythons, an.fits) : []), [img, an]);
  const usedMedia = useMemo(() => {
    if (!img) return [];
    if (!an) return [];
    const s = new Set([...an.hoseMedium.values()].filter(Boolean) as string[]);
    return MEDIA.filter((m) => s.has(m.id));
  }, [img]);
  const usedFlavors = useMemo(() => {
    if (!img || !an) return [];
    const s = new Set(an.hoseFlavor.values());
    return flavorsOf(st.userLib).filter((f) => s.has(f.name));
  }, [img]);
  if (!img) return null;
  const pg = PAGE[st.settings.pageSize] ?? PAGE.A3;
  const m = 8; // mm marg (settes også i main)
  const W = pg.w - 2 * m, H = pg.h - 2 * m;
  const info = st.info;
  const tb = (
    <div className="pv-tb">
      <div className="pv-logo">BarFlow</div>
      <div className="c"><span>Kunde</span>{info.kunde || '–'}</div>
      <div className="c"><span>Prosjekt</span>{info.prosjekt || '–'}</div>
      <div className="c"><span>Dato</span>{info.dato || '–'}</div>
      <div className="c"><span>Adresse</span>{info.adresse || '–'}</div>
      <div className="c"><span>Tegnet av</span>{info.tegnetAv || '–'}</div>
      <div className="c"><span>Side</span>1</div>
    </div>
  );
  return createPortal(
    <div className="pv" style={{ ['--pw' as any]: `${W}mm`, ['--ph' as any]: `${H}mm` }}>
      <style>{`@page { size: ${st.settings.pageSize} landscape; margin: ${m}mm; }`}</style>
      <section className="pv-page" style={{ width: `${W}mm`, height: `${H}mm` }}>
        <div className="pv-draw">
          <img src={img.url} alt="Tegning" />
        </div>
        <div className="pv-foot">
          <div className="pv-legend">
            {usedMedia.map((md) => (
              <span key={md.id}><i style={{ background: md.dots ? `radial-gradient(circle, ${md.dots} 1.2px, transparent 1.6px) 0 50% / 6px 100% repeat-x, ${md.color}` : md.color }} />{md.name}</span>
            ))}
            {usedFlavors.map((f) => (
              <span key={'f' + f.name}><i style={{ background: TUBE_COLOR_HEX[f.color] ?? '#999' }} />{f.name}</span>
            ))}
            {st.pythons.length > 0 && <span><i style={{ background: '#111827', height: 6 }} />Pytonrør</span>}
            {info.notat && <div className="pv-note">{info.notat}</div>}
          </div>
          {tb}
        </div>
      </section>
      <section className="pv-page list" style={{ width: `${W}mm`, minHeight: `${H}mm` }}>
        <div className="pv-lh">
          <h1>Deleliste</h1>
          <div className="mut">{[info.prosjekt, info.kunde, info.adresse, info.dato].filter(Boolean).join(' · ')}</div>
        </div>
        <PartsTable rows={rows} />
      </section>
    </div>,
    document.getElementById('print-root')!,
  );
}
