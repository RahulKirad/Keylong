import { jsPDF } from 'jspdf';
import { getTripMeta } from './itineraryStore';
import type { DebtSettlement, ExpenseRecord, TripMember } from './expenseStore';
import {
  buildNetBalances,
  buildPaySummaries,
  buildReceiveSummaries,
  buildSummedPairDebts,
  simplifySettlements,
} from './expenseSplit';

function inr(n: number): string {
  return `INR ${Math.round(n).toLocaleString('en-IN')}`;
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need <= 285) return y;
  doc.addPage();
  return 18;
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(23, 56, 75);
  doc.text(title, 14, y);
  doc.setDrawColor(212, 196, 150);
  doc.setLineWidth(0.4);
  doc.line(14, y + 2, 196, y + 2);
  return y + 8;
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
  const totalW = widths.reduce((s, w) => s + w, 0);
  const drawHeader = (top: number) => {
    doc.setFillColor(23, 56, 75);
    doc.rect(x0, top, totalW, lineH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = x0 + 1.5;
    headers.forEach((h, i) => {
      doc.text(h, x, top + 4.8);
      x += widths[i];
    });
    return top + lineH;
  };

  let cursor = drawHeader(y);
  rows.forEach((row, rowIndex) => {
    const wrapped = row.map((cell, i) => doc.splitTextToSize(cell || '—', widths[i] - 3));
    const height = Math.max(lineH, ...wrapped.map((lines) => lines.length * 4 + 3));
    if (cursor + height > 280) {
      doc.addPage();
      cursor = drawHeader(18);
    }
    if (rowIndex % 2 === 0) {
      doc.setFillColor(245, 247, 246);
      doc.rect(x0, cursor, totalW, height, 'F');
    }
    doc.setTextColor(28, 48, 58);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let x = x0 + 1.5;
    wrapped.forEach((lines, i) => {
      doc.text(lines, x, cursor + 4.5);
      x += widths[i];
    });
    cursor += height;
  });
  return cursor + 4;
}

/** Download full Splitwise settlement report (receive, pay, pairs, settle-up, nets). */
export function downloadExpenseSplitPdf(
  members: TripMember[],
  expenses: ExpenseRecord[],
  settlements: DebtSettlement[] = [],
  focusName?: string | null,
): void {
  const receive = buildReceiveSummaries(expenses, members, settlements);
  const pay = buildPaySummaries(expenses, members, settlements);
  const pairs = buildSummedPairDebts(expenses, members, settlements);
  const nets = buildNetBalances(expenses, members, settlements);
  const settle = simplifySettlements(nets);

  const nameFilter = (focusName || '').trim().toLowerCase();
  const filterPerson = (name: string) => !nameFilter || name.toLowerCase() === nameFilter;
  const filteredReceive = receive.filter((r) => filterPerson(r.member.name));
  const filteredPay = pay.filter((r) => filterPerson(r.member.name));
  const filteredPairs = pairs.filter(
    (p) => filterPerson(p.from.name) || filterPerson(p.to.name),
  );
  const filteredNets = nets.filter((n) => filterPerson(n.member.name));
  const filteredSettle = settle.filter(
    (s) => filterPerson(s.from.name) || filterPerson(s.to.name),
  );

  const meta = getTripMeta();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const stamp = new Date().toLocaleString('en-IN');

  doc.setFillColor(23, 56, 75);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(240, 200, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Spiti Tour 2026 — Bill splits', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 230, 235);
  doc.text(`${meta.dates}${nameFilter ? ` · Focus: ${focusName}` : ''}`, 14, 20);
  doc.text(`Generated ${stamp}`, 196, 20, { align: 'right' });

  let y = 36;

  y = sectionTitle(doc, y, 'To receive (summed)');
  if (!filteredReceive.length) {
    doc.setFontSize(9);
    doc.setTextColor(90, 105, 110);
    doc.text('No receivable amounts.', 14, y);
    y += 8;
  } else {
    y = paintTable(
      doc,
      y,
      ['Person', 'Total', 'From'],
      filteredReceive.map((r) => [
        r.member.name,
        inr(r.totalToReceiveInr),
        r.fromDebtors.map((d) => `${d.member.name} ${inr(d.amountInr)}`).join('; '),
      ]),
      [36, 28, 118],
    );
  }

  y = sectionTitle(doc, y, 'To pay (summed)');
  if (!filteredPay.length) {
    doc.setFontSize(9);
    doc.setTextColor(90, 105, 110);
    doc.text('No payable amounts.', 14, y);
    y += 8;
  } else {
    y = paintTable(
      doc,
      y,
      ['Person', 'Total', 'Give to'],
      filteredPay.map((r) => [
        r.member.name,
        inr(r.totalToPayInr),
        r.toCreditors.map((d) => `${d.member.name} ${inr(d.amountInr)}`).join('; '),
      ]),
      [36, 28, 118],
    );
  }

  y = sectionTitle(doc, y, 'Pending pair totals');
  if (!filteredPairs.length) {
    doc.setFontSize(9);
    doc.setTextColor(90, 105, 110);
    doc.text('Nothing pending.', 14, y);
    y += 8;
  } else {
    y = paintTable(
      doc,
      y,
      ['Who pays', 'Pays to', 'Pending', 'Breakdown'],
      filteredPairs.map((p) => [
        p.from.name,
        p.to.name,
        inr(p.amountInr),
        p.parts.map((part) => `${inr(part.amountInr)} ${part.description} (${part.dateLabel})`).join(' + '),
      ]),
      [32, 32, 28, 90],
    );
  }

  y = sectionTitle(doc, y, 'Suggested settle-up');
  if (!filteredSettle.length) {
    doc.setFontSize(9);
    doc.setTextColor(90, 105, 110);
    doc.text('Everyone is settled (or no splits).', 14, y);
    y += 8;
  } else {
    y = paintTable(
      doc,
      y,
      ['Who pays', 'Pays to', 'Amount'],
      filteredSettle.map((s) => [s.from.name, s.to.name, inr(s.amountInr)]),
      [60, 60, 62],
    );
  }

  y = sectionTitle(doc, y, 'Net balances');
  y = paintTable(
    doc,
    y,
    ['Traveller', 'Net', 'Status'],
    filteredNets.map((b) => [
      b.member.name,
      b.netInr === 0 ? '—' : inr(Math.abs(b.netInr)),
      b.netInr > 0
        ? `Should receive ${inr(b.netInr)}`
        : b.netInr < 0
          ? `Owes ${inr(-b.netInr)}`
          : 'Settled',
    ]),
    [50, 40, 92],
  );

  const fileFocus = nameFilter ? `-${(focusName || 'focus').replace(/\s+/g, '-').toLowerCase()}` : '';
  doc.save(`spiti-tour-2026-bill-splits${fileFocus}.pdf`);
}
