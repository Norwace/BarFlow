import ExcelJS from 'exceljs';
import type { PartRow } from './parts';
import type { ProjectInfo } from './types';
import type { Edge, Node } from '@xyflow/react';
import type { HoseData, PythonDef } from './types';
import { tubeTypeName } from './parts';
import { mediumName } from './constants';
import type { FitResult } from './autofit';

export interface HoseDetail { from: string; to: string; h: HoseData; medium?: string; flavor?: string; fitFrom: string; fitTo: string }

export async function buildExcel(rows: PartRow[], info: ProjectInfo, hoseDetails: HoseDetail[], pythons: PythonDef[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BarFlow';
  wb.created = new Date();
  const ws = wb.addWorksheet('Deleliste', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [
    { key: 'artnr', width: 18 },
    { key: 'name', width: 52 },
    { key: 'maker', width: 12 },
    { key: 'qty', width: 10 },
    { key: 'unit', width: 7 },
    { key: 'note', width: 40 },
  ];
  const title = ws.addRow(['Deleliste' + (info.prosjekt ? ' – ' + info.prosjekt : '')]);
  title.font = { bold: true, size: 16 };
  const meta: [string, string][] = [['Kunde', info.kunde], ['Adresse', info.adresse], ['Dato', info.dato], ['Tegnet av', info.tegnetAv]];
  for (const [k, v] of meta) {
    if (!v) continue;
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
  }
  ws.addRow([]);
  const sections: PartRow['section'][] = ['Utstyr', 'Koblinger', 'Slanger', 'Pytonrør'];
  for (const sec of sections) {
    const rs = rows.filter((r) => r.section === sec);
    if (!rs.length) continue;
    const sh = ws.addRow([sec]);
    sh.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    sh.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }; });
    for (let i = 1; i <= 6; i++) sh.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const hr = ws.addRow(['Art.nr', 'Beskrivelse', 'Produsent', 'Antall', 'Enhet', 'Merknad']);
    hr.font = { bold: true };
    hr.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; c.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } }; });
    for (const r of rs) {
      const row = ws.addRow([r.artnr, r.name, r.maker, r.qty, r.unit, r.note]);
      row.getCell(4).numFmt = r.unit === 'm' ? '0.0#' : '0';
      row.getCell(4).alignment = { horizontal: 'right' };
      row.eachCell({ includeEmpty: true }, (c) => { c.border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } }; });
    }
    ws.addRow([]);
  }

  if (hoseDetails.length) {
    const ws2 = wb.addWorksheet('Slanger');
    ws2.columns = [
      { header: 'Navn', key: 'name', width: 16 },
      { header: 'Fra', key: 'from', width: 34 },
      { header: 'Til', key: 'to', width: 34 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Dimensjon', key: 'size', width: 11 },
      { header: 'Medium', key: 'medium', width: 14 },
      { header: 'Farge', key: 'color', width: 10 },
      { header: 'Lengde (m)', key: 'len', width: 11 },
      { header: 'Kobling fra-ende', key: 'ff', width: 16 },
      { header: 'Kobling til-ende', key: 'ft', width: 16 },
      { header: 'Notat', key: 'note', width: 30 },
    ];
    ws2.getRow(1).font = { bold: true };
    for (const d of hoseDetails) {
      ws2.addRow({ name: d.h.name ?? '', ff: d.fitFrom, ft: d.fitTo, from: d.from, to: d.to, type: tubeTypeName(d.h.tube), size: d.h.size, medium: [d.medium ? mediumName(d.medium) : '', d.flavor ?? ''].filter(Boolean).join(' – '), color: d.h.color || (d.flavor ? `(${d.flavor})` : ''), len: d.h.length ?? '', note: (d.h.counted === false ? '(telles ikke) ' : '') + (d.h.note ?? '') });
    }
  }
  if (pythons.length) {
    const ws3 = wb.addWorksheet('Pytonrør');
    ws3.columns = [
      { header: 'Navn', key: 'name', width: 22 },
      { header: 'Oppbygning', key: 'cfg', width: 30 },
      { header: 'Produktslanger (farge – innhold)', key: 'cols', width: 70 },
      { header: 'Kjøleloop', key: 'cool', width: 16 },
      { header: 'Lengde (m)', key: 'len', width: 11 },
      { header: 'Art.nr', key: 'art', width: 14 },
    ];
    ws3.getRow(1).font = { bold: true };
    for (const p of pythons) {
      ws3.addRow({ name: p.name, cfg: `${p.products}×${p.productSize} (stripete) + ${p.coolCount}×${p.coolSize} kjøl (hvit/svart)`, cols: p.productColors.slice(0, p.products).map((c, i) => {
        const what = [p.productNames?.[i], p.productMedia?.[i] && p.productMedia[i] !== 'any' ? mediumName(p.productMedia[i]) : ''].filter(Boolean).join(', ');
        return `${i + 1}: ${c}${what ? ' – ' + what : ''}`;
      }).join('; '), cool: mediumName(p.coolMedium ?? 'vann'), len: p.length ?? '', art: p.artnr ?? '' });
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

export function hoseDetailRows(
  nodes: Node[], edges: Edge[], nameOf: (n?: Node, handle?: string | null) => string, mediumOf: (id: string) => string | undefined,
  fitsOf: (id: string) => { s: FitResult; t: FitResult } | undefined,
  flavorOf: (id: string) => string | undefined = () => undefined,
): HoseDetail[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ft = (f?: FitResult) => (f?.status === 'ok' ? f.def?.artnr || f.def?.name || '' : f?.status === 'missing' ? 'MANGLER' : '');
  return edges
    .filter((e) => e.type === 'hose')
    .map((e) => {
      const f = fitsOf(e.id);
      return { from: nameOf(byId.get(e.source), e.sourceHandle), to: nameOf(byId.get(e.target), e.targetHandle), h: e.data as HoseData, medium: mediumOf(e.id), flavor: flavorOf(e.id), fitFrom: ft(f?.s), fitTo: ft(f?.t) };
    });
}
