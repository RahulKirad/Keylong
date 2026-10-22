import { jsPDF } from 'jspdf';
import { tripMeta } from './tripData';
import { listTravellerNames } from './travellerBrief';
import { getIdProof, idTypeLabel, type IdProof } from './idProofStore';

export type IdRosterRow = {
  travellerName: string;
  proof?: IdProof;
};

export function listIdRoster(): IdRosterRow[] {
  return listTravellerNames().map((travellerName) => ({
    travellerName,
    proof: getIdProof(travellerName),
  }));
}

function paintTable(
  doc: jsPDF,
  y: number,
  headers: string[],
  rows: string[][],
  widths: number[],
): number {
  const x0 = 14;
  const lineH = 7;
  const drawHeader = (top: number) => {
    doc.setFillColor(23, 56, 75);
    doc.rect(x0, top, widths.reduce((sum, width) => sum + width, 0), lineH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = x0 + 1.5;
    headers.forEach((header, index) => {
      doc.text(header, x, top + 4.8);
      x += widths[index];
    });
    return top + lineH;
  };

  let cursor = drawHeader(y);
  rows.forEach((row, rowIndex) => {
    const wrapped = row.map((cell, index) => doc.splitTextToSize(cell || '—', widths[index] - 3));
    const height = Math.max(lineH, ...wrapped.map((lines) => lines.length * 4 + 3));
    if (cursor + height > 280) {
      doc.addPage();
      cursor = drawHeader(18);
    }
    if (rowIndex % 2 === 0) {
      doc.setFillColor(245, 247, 246);
      doc.rect(x0, cursor, widths.reduce((sum, width) => sum + width, 0), height, 'F');
    }
    doc.setTextColor(28, 52, 64);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let x = x0 + 1.5;
    wrapped.forEach((lines, index) => {
      doc.text(lines, x, cursor + 4.5);
      x += widths[index];
    });
    cursor += height;
  });
  if (!rows.length) {
    doc.setTextColor(90, 106, 112);
    doc.setFont('helvetica', 'italic');
    doc.text('No travellers listed yet.', x0, cursor + 6);
    cursor += 10;
  }
  return cursor + 8;
}

function fileStatus(proof?: IdProof): string {
  if (!proof?.fileDataUrl) return 'No file';
  if (proof.fileDataUrl.startsWith('data:image')) return 'Photo saved';
  if (proof.fileDataUrl.startsWith('data:application/pdf')) return 'PDF saved';
  return proof.fileName || 'File saved';
}

export function downloadBulkIdProofPdf(): void {
  const roster = listIdRoster();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(23, 56, 75);
  doc.text('Winter Himachal — Group ID proof list', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 80, 88);
  doc.text(`${tripMeta.dates} · Full roster for hotel check-in`, 14, y);
  y += 6;
  doc.text(`Generated ${new Date().toLocaleString('en-IN')} · ${roster.length} travellers`, 14, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(23, 56, 75);
  doc.text('Everyone at a glance', 14, y);
  y += 6;

  y = paintTable(
    doc,
    y,
    ['Traveller', 'ID type', 'Number', 'Name on card', 'Document', 'Note'],
    roster.map(({ travellerName, proof }) => [
      travellerName,
      proof ? idTypeLabel(proof.idType) : '—',
      proof?.idNumber || 'Not saved',
      proof?.nameOnId || travellerName,
      fileStatus(proof),
      proof?.note || '—',
    ]),
    [28, 24, 36, 36, 28, 30],
  );

  roster.forEach(({ travellerName, proof }, index) => {
    doc.addPage();
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(23, 56, 75);
    doc.text(`${index + 1}. ${travellerName}`, 14, y);
    y += 8;

    y = paintTable(
      doc,
      y,
      ['Field', 'Detail'],
      [
        ['Traveller', travellerName],
        ['ID type', proof ? idTypeLabel(proof.idType) : 'Not saved'],
        ['ID number', proof?.idNumber || 'Not saved'],
        ['Name on card', proof?.nameOnId || travellerName],
        ['Note', proof?.note || '—'],
        ['Document', fileStatus(proof)],
        [
          'Updated',
          proof?.updatedAt ? new Date(proof.updatedAt).toLocaleString('en-IN') : '—',
        ],
      ],
      [48, 134],
    );

    if (proof?.fileDataUrl?.startsWith('data:image')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(23, 56, 75);
      doc.text('Uploaded ID document', 14, y);
      y += 4;
      try {
        const props = doc.getImageProperties(proof.fileDataUrl);
        const maxW = 170;
        const maxH = 120;
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        if (y + h > 285) {
          doc.addPage();
          y = 18;
        }
        doc.addImage(proof.fileDataUrl, 14, y, w, h);
        y += h + 6;
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(120, 132, 136);
        doc.text('Photo could not be drawn in this PDF.', 14, y + 4);
      }
    } else if (proof?.fileDataUrl?.startsWith('data:application/pdf')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 80, 88);
      doc.text(
        `A PDF file is saved on this phone${proof.fileName ? ` (${proof.fileName})` : ''}. Open ID proof → Show for check-in to view it.`,
        14,
        y + 4,
        { maxWidth: 180 },
      );
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(120, 132, 136);
      doc.text('No ID document uploaded for this traveller yet.', 14, y + 4);
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(120, 132, 136);
    doc.text(`Winter Himachal · Group ID list · page ${page} of ${pageCount}`, 14, 290);
  }

  doc.save('winter-himachal-group-id-proofs.pdf');
}
