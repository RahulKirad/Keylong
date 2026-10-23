import {
  getDays,
  getPlaces,
  getSafetyChecklist,
  getStayNights,
  getTransportSegments,
  getTripMeta,
  getTripPhases,
} from './itineraryStore';

export function buildTripKnowledgeDocument(): string {
  const tripMeta = getTripMeta();
  const places = getPlaces();
  const days = getDays();
  const phases = getTripPhases();
  const transport = getTransportSegments();
  const stays = getStayNights();
  const safetyChecklist = getSafetyChecklist();

  const placeBlock = places
    .map(
      (p) =>
        `- ${p.name} (${p.region}, ${p.alt}, ${p.kind}): ${p.about} Tips: ${p.tips.join('; ')}`,
    )
    .join('\n');

  const phaseBlock = phases
    .map((p) => `Phase ${p.number}: ${p.title}${p.note ? ` Note: ${p.note}` : ''}`)
    .join('\n');

  const dayBlock = days
    .map((d) => {
      const warn = d.warning ? ` Warning: ${d.warning}` : '';
      const rows = (d.scheduleRows || [])
        .map(
          (r) =>
            `  · ${r.when} | ${r.activity} | ${r.mode} | ${r.notes} | overnight: ${r.overnight}`,
        )
        .join('\n');
      return `Day ${d.day} (${d.date}, ${d.phaseId}): ${d.title}. Place: ${d.place}. Transport: ${d.transport}. Stay: ${d.stay}.${warn}\nSchedule:\n${rows}`;
    })
    .join('\n\n');

  const transportBlock = transport
    .map((t) => `- ${t.segment}: ${t.mode}. Book: ${t.book}`)
    .join('\n');

  const stayBlock = stays
    .map((s) => `- ${s.night}: ${s.location} (${s.nights} night(s)) — ${s.priority}`)
    .join('\n');

  return `
TRIP: ${tripMeta.brand} — ${tripMeta.title}
DATES: ${tripMeta.dates}
TRAIN: ${tripMeta.train}
PRIVATE ROAD TRANSFER: ${tripMeta.privateTransfer}
FLIGHT HOME: ${tripMeta.flight}

PHASES:
${phaseBlock}

PLACES:
${placeBlock}

DAY BY DAY ITINERARY (editable live schedule):
${dayBlock}

TRANSPORT BOOKING SUMMARY:
${transportBlock}

OVERNIGHT ACCOMMODATION CHECKLIST:
${stayBlock}

WINTER SAFETY CHECKLIST:
${safetyChecklist.map((s, i) => `${i + 1}. ${s}`).join('\n')}

TOPICS YOU MAY DISCUSS (only when relevant to this trip): winter driving in Kinnaur and Spiti, altitude and cold weather packing, Sangla/Chitkul/Kalpa/Kaza/Langza access (planning only, not live status), train and flight connections, budgeting for mountain travel, New Year in Kaza planning, Kufri→Delhi airport risk buffer.
`.trim();
}

export const ASSISTANT_SYSTEM_PROMPT = `You are the personal voice and chat assistant for ONE specific trip: Spiti Tour 2026 (23 Dec 2026 – 03 Jan 2027). You must:

1. Answer ONLY using the trip data below, plus general travel advice that directly helps THIS journey (packing for winter mountains, Spiti/Kinnaur road safety culture, respectful tourism).
2. If asked about unrelated topics (other destinations, coding, politics, etc.), politely refuse and steer back to this trip.
3. FORMAT replies for on-screen reading:
   - Use short paragraphs separated by blank lines.
   - Use bullet lines starting with "• " (not asterisk lists).
   - Use **double asterisks** ONLY around important names, dates, and amounts — never wrap whole paragraphs in bold.
   - Do not use # headings or markdown links unless necessary.
   - Be concise and practical for voice.
4. Never invent confirmed bookings, live road status, or live weather — say to verify locally or with operators.
5. For PDF downloads: when the user asks for a document, itinerary PDF, transport sheet, safety checklist, or full trip pack, include EXACTLY ONE tag on its own line at the very end of your reply (user will not hear it in voice):
   [PDF:itinerary] — full day-by-day itinerary
   [PDF:transport] — train, private transfer, flight summary
   [PDF:safety] — winter safety checklist
   [PDF:places] — all stops with tips
   [PDF:full] — complete trip document
   Choose the best match; use [PDF:full] if they want everything.
6. For expenses, balances, or who gave cash to whom: open **Spiti Tour Expenses**. Users can say in Log expense mode e.g. “Rahul gave 10000 to Sanket cash”, “Sanket spent 2000 dinner from balance cash”, or “25 Dec lunch 800 Allen online”. Balance spends deduct from the holder’s pool and the assistant confirms remaining balance.
7. For who does what: open **Assignments** (/assignments) or use assistant **Assign tasks** mode. Example: “Rahul is assigned to book the train tickets for 23rd”. Tasks link to itinerary days and highlight on the home itinerary.

TRIP DATA:
`;
