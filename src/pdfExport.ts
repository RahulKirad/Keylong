import { jsPDF } from 'jspdf';
import type { PdfKind } from './geminiClient';
import {
  getDays,
  getPlaces,
  getSafetyChecklist,
  getStayNights,
  getTransportSegments,
  getTripMeta,
  getTripPhases,
} from './itineraryStore';

function header(doc: jsPDF, title: string) {
  const tripMeta = getTripMeta();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(tripMeta.brand, 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 26);
  doc.text(tripMeta.dates, 14, 32);
  doc.setDrawColor(180);
  doc.line(14, 36, 196, 36);
  return 40;
}

function addWrapped(doc: jsPDF, text: string, y: number, maxWidth = 182): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.setFontSize(10);
  doc.text(lines, 14, y);
  return y + lines.length * 5 + 4;
}

export function downloadTripPdf(kind: PdfKind): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 40;
  const tripMeta = getTripMeta();
  const days = getDays();
  const places = getPlaces();
  const safetyChecklist = getSafetyChecklist();
  const phases = getTripPhases();
  const transportSegments = getTransportSegments();
  const stayNights = getStayNights();

  const includeItinerary = kind === 'itinerary' || kind === 'full';
  const includeTransport = kind === 'transport' || kind === 'full';
  const includeSafety = kind === 'safety' || kind === 'full';
  const includePlaces = kind === 'places' || kind === 'full';

  const titles: Record<PdfKind, string> = {
    itinerary: 'Day-by-day itinerary',
    transport: 'Transport summary',
    safety: 'Winter safety checklist',
    places: 'Places guide',
    full: 'Complete trip pack',
  };

  y = header(doc, titles[kind]);

  if (includeTransport) {
    doc.setFont('helvetica', 'bold');
    doc.text('Transport overview', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    y = addWrapped(doc, `Train: ${tripMeta.train}`, y);
    y = addWrapped(doc, `Private transfer: ${tripMeta.privateTransfer}`, y);
    y = addWrapped(doc, `Flight: ${tripMeta.flight}`, y);
    y += 2;
    doc.setFont('helvetica', 'bold');
    y = addWrapped(doc, 'Booking summary', y);
    doc.setFont('helvetica', 'normal');
    for (const segment of transportSegments) {
      y = addWrapped(doc, `• ${segment.segment} — ${segment.mode}. Book: ${segment.book}`, y);
    }
    y += 4;
  }

  if (includeItinerary) {
    for (const phase of phases) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      y = addWrapped(doc, `Phase ${phase.number} — ${phase.title}`, y);
      if (phase.note) {
        doc.setFont('helvetica', 'italic');
        y = addWrapped(doc, phase.note, y);
      }
      const phaseDays = days.filter((d) => d.phaseId === phase.id);
      for (const d of phaseDays) {
        if (y > 255) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('helvetica', 'bold');
        y = addWrapped(doc, `Day ${d.day} — ${d.date}: ${d.title}`, y);
        doc.setFont('helvetica', 'normal');
        y = addWrapped(doc, `Overnight: ${d.stay}`, y);
        for (const row of d.scheduleRows || []) {
          y = addWrapped(
            doc,
            `• ${row.when} | ${row.activity} | ${row.mode} | ${row.notes} | Stay: ${row.overnight}`,
            y,
          );
        }
        if (d.warning) y = addWrapped(doc, `Note: ${d.warning}`, y);
        y += 2;
      }
    }

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    y = addWrapped(doc, 'Overnight accommodation checklist', y);
    doc.setFont('helvetica', 'normal');
    for (const stay of stayNights) {
      y = addWrapped(
        doc,
        `• ${stay.night}: ${stay.location} (${stay.nights}) — ${stay.priority}`,
        y,
      );
    }
  }

  if (includePlaces) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    y = addWrapped(doc, 'Places', y);
    doc.setFont('helvetica', 'normal');
    for (const p of places) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      y = addWrapped(doc, `${p.name} (${p.region}, ${p.alt}) — ${p.kind}`, y);
      y = addWrapped(doc, p.about, y);
      for (const t of p.tips) y = addWrapped(doc, `• ${t}`, y);
      y += 2;
    }
  }

  if (includeSafety) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    y = addWrapped(doc, 'Winter safety checklist', y);
    doc.setFont('helvetica', 'normal');
    safetyChecklist.forEach((item, i) => {
      y = addWrapped(doc, `${i + 1}. ${item}`, y);
    });
  }

  doc.save(`spiti-tour-2026-${kind}.pdf`);
}
