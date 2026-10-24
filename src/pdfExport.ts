import { jsPDF } from 'jspdf';
import type { PdfKind } from './geminiClient';
import {
  getDays,
  getPlaces,
  getStayNights,
  getTransportSegments,
  getTripMeta,
  getTripPhases,
} from './itineraryStore';
import { mustCarryGroups, safetyCategories } from './tripData';

const MARGIN_X = 12;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const BOTTOM = 285;

type Align = 'left' | 'center' | 'right';

type Col = {
  key: string;
  label: string;
  width: number;
  align?: Align;
};

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need <= BOTTOM) return y;
  doc.addPage();
  return 18;
}

function drawHeader(doc: jsPDF, title: string): number {
  const tripMeta = getTripMeta();
  doc.setFillColor(23, 56, 75);
  doc.rect(0, 0, PAGE_W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(tripMeta.brand, MARGIN_X, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(title, MARGIN_X, 19);
  doc.setFontSize(8);
  doc.setTextColor(212, 224, 228);
  doc.text(tripMeta.dates, MARGIN_X, 25);
  doc.setTextColor(40, 50, 55);
  return 36;
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(23, 56, 75);
  doc.text(title, MARGIN_X, y);
  doc.setDrawColor(229, 193, 122);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, y + 2, MARGIN_X + 36, y + 2);
  doc.setTextColor(40, 50, 55);
  return y + 8;
}

function sectionNote(doc: jsPDF, y: number, text: string): number {
  y = ensureSpace(doc, y, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 95, 100);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN_X, y);
  doc.setTextColor(40, 50, 55);
  return y + lines.length * 3.8 + 3;
}

function cellLines(doc: jsPDF, text: string, width: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(String(text || '—'), Math.max(8, width - 3));
}

function drawTable(
  doc: jsPDF,
  startY: number,
  columns: Col[],
  rows: Record<string, string>[],
): number {
  const headerH = 7;
  const fontSize = 8;
  const lineH = 3.4;
  const padY = 2.2;
  let y = startY;

  const paintHeader = () => {
    y = ensureSpace(doc, y, headerH + 8);
    doc.setFillColor(23, 56, 75);
    doc.rect(MARGIN_X, y, CONTENT_W, headerH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = MARGIN_X;
    for (const col of columns) {
      const labelX =
        col.align === 'center'
          ? x + col.width / 2
          : col.align === 'right'
            ? x + col.width - 1.5
            : x + 1.5;
      doc.text(col.label, labelX, y + 4.7, {
        align: col.align || 'left',
      });
      x += col.width;
    }
    doc.setTextColor(40, 50, 55);
    y += headerH;
  };

  paintHeader();

  rows.forEach((row, rowIndex) => {
    const lineSets = columns.map((col) => cellLines(doc, row[col.key] ?? '', col.width, fontSize));
    const maxLines = Math.max(1, ...lineSets.map((lines) => lines.length));
    const rowH = Math.max(7, maxLines * lineH + padY * 2);

    if (y + rowH > BOTTOM) {
      doc.addPage();
      y = 18;
      paintHeader();
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(247, 248, 246);
      doc.rect(MARGIN_X, y, CONTENT_W, rowH, 'F');
    }

    doc.setDrawColor(225, 231, 229);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN_X, y, CONTENT_W, rowH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(43, 66, 75);

    let x = MARGIN_X;
    columns.forEach((col, i) => {
      const lines = lineSets[i];
      const textY = y + padY + 3;
      const textX =
        col.align === 'center'
          ? x + col.width / 2
          : col.align === 'right'
            ? x + col.width - 1.5
            : x + 1.5;
      doc.text(lines, textX, textY, { align: col.align || 'left' });
      // vertical separators
      if (i > 0) {
        doc.setDrawColor(230, 235, 233);
        doc.line(x, y, x, y + rowH);
      }
      x += col.width;
    });

    y += rowH;
  });

  return y + 5;
}

function kvTable(doc: jsPDF, y: number, pairs: [string, string][]): number {
  return drawTable(
    doc,
    y,
    [
      { key: 'label', label: 'Field', width: 42 },
      { key: 'value', label: 'Details', width: CONTENT_W - 42 },
    ],
    pairs.map(([label, value]) => ({ label, value })),
  );
}

export function downloadTripPdf(kind: PdfKind): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const tripMeta = getTripMeta();
  const days = getDays();
  const places = getPlaces();
  const phases = getTripPhases();
  const transportSegments = getTransportSegments();
  const stayNights = getStayNights();

  const includeItinerary = kind === 'itinerary' || kind === 'full';
  const includeTransport = kind === 'transport' || kind === 'full';
  const includeSafety = kind === 'safety' || kind === 'full';
  const includePlaces = kind === 'places' || kind === 'full';

  const titles: Record<PdfKind, string> = {
    itinerary: 'Day-by-day itinerary (tabular)',
    transport: 'Transport summary (tabular)',
    safety: 'Winter safety & must-carry (tabular)',
    places: 'Places & stays guide (tabular)',
    full: 'Complete trip pack (tabular)',
  };

  let y = drawHeader(doc, titles[kind]);

  if (includeTransport) {
    y = sectionTitle(doc, y, 'Transport overview');
    y = kvTable(doc, y, [
      ['Train', tripMeta.train],
      ['Private transfer', tripMeta.privateTransfer],
      ['Flight home', tripMeta.flight],
    ]);

    y = sectionTitle(doc, y, 'Booking summary');
    y = drawTable(
      doc,
      y,
      [
        { key: 'segment', label: 'Segment', width: 48 },
        { key: 'mode', label: 'Mode', width: 48 },
        { key: 'book', label: 'What to book', width: CONTENT_W - 96 },
      ],
      transportSegments.map((segment) => ({
        segment: segment.segment,
        mode: segment.mode,
        book: segment.book,
      })),
    );
  }

  if (includeItinerary) {
    for (const phase of phases) {
      y = sectionTitle(doc, y, `Phase ${phase.number} — ${phase.title}`);
      if (phase.note) y = sectionNote(doc, y, phase.note);

      const phaseDays = days.filter((d) => d.phaseId === phase.id);
      for (const d of phaseDays) {
        y = sectionTitle(doc, y, `Day ${d.day} · ${d.date} — ${d.title}`);
        y = kvTable(doc, y, [
          ['Place / focus', d.place || '—'],
          ['Transport', d.transport || '—'],
          ['Overnight / stay', d.stay || '—'],
          ...(d.warning ? [['Warning', d.warning] as [string, string]] : []),
        ]);

        const rows = (d.scheduleRows || []).map((row) => ({
          when: row.when,
          activity: row.activity,
          mode: row.mode,
          notes: row.notes,
          overnight: row.overnight,
        }));
        if (rows.length) {
          y = drawTable(
            doc,
            y,
            [
              { key: 'when', label: 'When', width: 34 },
              { key: 'activity', label: 'Activity', width: 48 },
              { key: 'mode', label: 'Mode', width: 28 },
              { key: 'notes', label: 'Notes', width: 42 },
              { key: 'overnight', label: 'Halt / overnight', width: CONTENT_W - 152 },
            ],
            rows,
          );
        }
      }
    }

    y = sectionTitle(doc, y, 'Overnight accommodation checklist');
    y = drawTable(
      doc,
      y,
      [
        { key: 'night', label: 'Night', width: 24 },
        { key: 'location', label: 'Location', width: 28 },
        { key: 'stayType', label: 'Stay type', width: 24 },
        { key: 'stayName', label: 'Hotel / homestay', width: 42 },
        { key: 'nights', label: 'Nights', width: 16, align: 'center' },
        { key: 'priority', label: 'Booking priority', width: CONTENT_W - 134 },
      ],
      stayNights.map((stay) => ({
        night: stay.night,
        location: stay.location,
        stayType: stay.stayType || '—',
        stayName: stay.stayName || '—',
        nights: stay.nights,
        priority: stay.priority,
      })),
    );
  }

  if (includePlaces) {
    y = sectionTitle(doc, y, 'Places, destinations & halts');
    y = sectionNote(
      doc,
      y,
      'Stay type and hotel / homestay names come from Trip tables. Fill them in the app, tap Update trip, then re-export.',
    );
    y = drawTable(
      doc,
      y,
      [
        { key: 'name', label: 'Place', width: 32 },
        { key: 'region', label: 'Region', width: 24 },
        { key: 'alt', label: 'Alt', width: 16 },
        { key: 'halt', label: 'Halt', width: 14, align: 'center' },
        { key: 'stayType', label: 'Stay type', width: 22 },
        { key: 'stayName', label: 'Stay / hotel name', width: 36 },
        { key: 'about', label: 'About', width: CONTENT_W - 144 },
      ],
      places.map((p) => ({
        name: p.name,
        region: p.region,
        alt: p.alt,
        halt: p.isHalt ? 'Yes' : '—',
        stayType: p.stayType || '—',
        stayName: p.stayName || '—',
        about: p.about,
      })),
    );

    const tipRows = places.flatMap((p) =>
      (p.tips || []).map((tip) => ({
        place: p.name,
        tip,
      })),
    );
    if (tipRows.length) {
      y = sectionTitle(doc, y, 'Place tips');
      y = drawTable(
        doc,
        y,
        [
          { key: 'place', label: 'Place', width: 36 },
          { key: 'tip', label: 'Tip', width: CONTENT_W - 36 },
        ],
        tipRows,
      );
    }
  }

  if (includeSafety) {
    y = sectionTitle(doc, y, 'Winter safety guide');
    y = sectionNote(
      doc,
      y,
      'Organised by concern area — weather, calamities, altitude, travel, women travellers, and NYE discipline.',
    );

    for (const category of safetyCategories) {
      y = sectionTitle(doc, y, category.title);
      y = sectionNote(doc, y, category.intro);
      y = drawTable(
        doc,
        y,
        [
          { key: 'no', label: '#', width: 10, align: 'center' },
          { key: 'point', label: 'Safety point', width: CONTENT_W - 10 },
        ],
        category.points.map((point, i) => ({
          no: String(i + 1),
          point,
        })),
      );
    }

    y = sectionTitle(doc, y, 'Must-have items to carry');
    y = sectionNote(doc, y, 'Pack list mirrored from the Safety page in the app.');

    for (const group of mustCarryGroups) {
      y = sectionTitle(doc, y, group.title);
      y = drawTable(
        doc,
        y,
        [
          { key: 'no', label: '#', width: 10, align: 'center' },
          { key: 'item', label: 'Item', width: CONTENT_W - 10 },
        ],
        group.items.map((item, i) => ({
          no: String(i + 1),
          item,
        })),
      );
    }
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 135);
    doc.text(`${tripMeta.brand} · ${titles[kind]} · page ${i}/${pageCount}`, MARGIN_X, 292);
    doc.text('Planning reference only — verify roads, weather and bookings locally.', PAGE_W - MARGIN_X, 292, {
      align: 'right',
    });
  }

  doc.save(`spiti-tour-2026-${kind}.pdf`);
}
