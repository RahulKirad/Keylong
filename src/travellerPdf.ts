import { jsPDF } from 'jspdf';
import { tripMeta } from './tripData';
import { briefForName, type PersonalBrief, type PersonalTopic } from './travellerBrief';
import { idTypeLabel } from './idProofStore';

function inr(amount: number): string {
  return `INR ${amount.toLocaleString('en-IN')}`;
}

function headerImage(name: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const sky = ctx.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, '#10283a');
  sky.addColorStop(1, '#1c4560');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1600, 360);
  ctx.fillStyle = '#f4e7c4';
  for (let i = 0; i < 48; i += 1) {
    const x = (i * 97) % 1560 + 16;
    const y = (i * 53) % 180 + 16;
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 2.4 : 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#071018';
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.lineTo(180, 190);
  ctx.lineTo(340, 230);
  ctx.lineTo(520, 150);
  ctx.lineTo(760, 220);
  ctx.lineTo(980, 140);
  ctx.lineTo(1220, 210);
  ctx.lineTo(1600, 160);
  ctx.lineTo(1600, 360);
  ctx.lineTo(0, 360);
  ctx.fill();
  ctx.fillStyle = '#e5c17a';
  ctx.fillRect(0, 336, 1600, 24);
  ctx.fillStyle = '#f7f4ec';
  ctx.font = '700 54px Georgia, serif';
  ctx.fillText('Winter Himachal', 56, 88);
  ctx.font = '500 28px Georgia, serif';
  ctx.fillStyle = '#e5c17a';
  ctx.fillText(`${name}'s trip record`, 56, 136);
  ctx.font = '400 22px sans-serif';
  ctx.fillStyle = '#d5e2e8';
  ctx.fillText(tripMeta.dates, 56, 176);
  const initial = (name.trim()[0] || 'T').toUpperCase();
  ctx.fillStyle = '#e5c17a';
  ctx.beginPath();
  ctx.arc(1460, 110, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#17384b';
  ctx.font = '700 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(initial, 1460, 128);
  ctx.textAlign = 'left';
  return canvas.toDataURL('image/png');
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
    doc.text('Nothing recorded yet.', x0, cursor + 6);
    cursor += 10;
  }
  return cursor + 8;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  if (y > 260) {
    doc.addPage();
    y = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(23, 56, 75);
  doc.text(title, 14, y);
  return y + 6;
}

function moneyRows(brief: PersonalBrief): string[][] {
  const ledger = brief.ledger;
  const spent = ledger ? ledger.totalSpentAsPayer : brief.expenses.reduce((sum, expense) => sum + expense.amountInr, 0);
  const balance = ledger ? ledger.balanceRemaining : 0;
  const received = ledger ? ledger.receivedFrom.reduce((sum, item) => sum + item.amount, 0) : 0;
  const given = ledger ? ledger.gaveToOthers.reduce((sum, item) => sum + item.amount, 0) : 0;
  return [
    ['Total amount spent', inr(spent)],
    ['Cash', inr(ledger?.cashSpent || 0)],
    ['Online', inr(ledger?.onlineSpent || 0)],
    ['Spent from balance', inr(ledger?.spentFromBalanceTotal || 0)],
    ['Balance left', balance > 0 ? inr(balance) : `${inr(0)} — none held`],
    ['Money received', inr(received)],
    ['Money given to others', inr(given)],
  ];
}

export function downloadPersonalPdf(name: string, topics: PersonalTopic[]): void {
  const brief: PersonalBrief = briefForName(name);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const image = headerImage(name);
  if (image) doc.addImage(image, 'PNG', 0, 0, 210, 47);
  let y = 56;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 80, 88);
  doc.text('Personal record for this trip. Totals include everything spent and any balance still held.', 14, y);
  y += 8;

  y = sectionTitle(doc, 'Money totals', y);
  y = paintTable(doc, y, ['Item', 'Amount'], moneyRows(brief), [110, 72]);

  if (topics.includes('tasks')) {
    y = sectionTitle(doc, 'Assigned tasks', y);
    y = paintTable(
      doc,
      y,
      ['Day', 'Date', 'Task'],
      brief.tasks.map((task) => [
        task.tripDayNumber != null ? `Day ${task.tripDayNumber}` : '—',
        task.dateLabel || '—',
        task.task,
      ]),
      [28, 36, 118],
    );
  }

  if (topics.includes('expenses')) {
    y = sectionTitle(doc, 'Expenses', y);
    y = paintTable(
      doc,
      y,
      ['Date', 'Description', 'Category', 'Amount', 'Method'],
      (() => {
        const rows = brief.expenses.map((expense) => [
          expense.dateLabel || expense.tripDate,
          expense.description,
          expense.category,
          inr(expense.amountInr),
          expense.paymentMethod,
        ]);
        if (rows.length) {
          rows.push([
            'Total',
            `${brief.expenses.length} entries`,
            '—',
            inr(brief.expenses.reduce((sum, expense) => sum + expense.amountInr, 0)),
            '—',
          ]);
        }
        return rows;
      })(),
      [32, 62, 36, 32, 20],
    );
  }

  if (topics.includes('transfers')) {
    y = sectionTitle(doc, 'Money given or received', y);
    y = paintTable(
      doc,
      y,
      ['Date', 'From', 'To', 'Amount', 'Note'],
      brief.transfers.map((transfer) => [
        transfer.dateLabel || transfer.tripDate,
        transfer.fromPersonName,
        transfer.toPersonName,
        inr(transfer.amountInr),
        transfer.note || '—',
      ]),
      [32, 36, 36, 32, 46],
    );
  }

  if (topics.includes('identity')) {
    y = sectionTitle(doc, 'ID proof', y);
    const proof = brief.identity;
    y = paintTable(
      doc,
      y,
      ['Field', 'Detail'],
      proof
        ? [
            ['Traveller', brief.name],
            ['Type', idTypeLabel(proof.idType)],
            ['Number', proof.idNumber || '—'],
            ['Name on card', proof.nameOnId || brief.name],
            ['Note', proof.note || '—'],
          ]
        : [],
      [50, 132],
    );
    if (proof?.fileDataUrl?.startsWith('data:image') && y < 200) {
      try {
        const props = doc.getImageProperties(proof.fileDataUrl);
        const maxW = 120;
        const maxH = 78;
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        doc.addImage(proof.fileDataUrl, 14, y, props.width * ratio, props.height * ratio);
      } catch {
        // The number table is still in the PDF if the photo cannot be drawn.
      }
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(120, 132, 136);
    doc.text(`Winter Himachal · ${name} · page ${page} of ${pageCount}`, 14, 290);
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'traveller';
  doc.save(`winter-himachal-${slug}-record.pdf`);
}
