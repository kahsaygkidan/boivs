import { BRAND, stamp, saveBlob } from './shared.js';

export async function exportWord(rep, base) {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, Footer, AlignmentType, PageNumber, PageOrientation } = d;
  const hex = BRAND.slice(1);
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const line = { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' };
  const cell = (text, { w, bold, color, fill } = {}) => new TableCell({
    width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    borders: { top: none, left: none, right: none, bottom: line },
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold, color, size: 20 })] })],
  });

  const children = [
    new Paragraph({ children: [new TextRun({ text: 'BENEFICIAL OWNER RECORD', color: '64748B', size: 16, bold: true })] }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: rep.title, bold: true, size: 44, color: hex })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `${rep.subtitle}  |  ${rep.status}`, color: '475569', size: 20 })] }),
  ];

  rep.sections.forEach((s) => {
    children.push(new Paragraph({
      spacing: { before: 280, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'C7D4F5', space: 2 } },
      children: [new TextRun({ text: s.title.toUpperCase(), bold: true, size: 20, color: hex })],
    }));
    const rows = s.kind === 'rows'
      ? s.rows.map(([l, v]) => new TableRow({ children: [cell(l, { w: 32, bold: true, color: '64748B' }), cell(v, { w: 68 })] }))
      : [
        new TableRow({ tableHeader: true, children: s.head.map((h) => cell(h, { bold: true, color: hex, fill: 'E8EEFC' })) }),
        ...s.rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
      ];
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  });

  const doc = new Document({
    creator: 'BO Verification System', title: `${rep.title} – ${rep.subtitle}`,
    sections: [{
      properties: { page: { size: { orientation: rep.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `Confidential — Generated ${rep.generatedAt}  |  Page `, size: 16, color: '94A3B8' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8' }),
            ],
          })],
        }),
      },
      children,
    }],
  });
  saveBlob(await Packer.toBlob(doc), `${base}_${stamp()}.docx`);
}
