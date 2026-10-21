import { days, places, safetyChecklist, tripMeta } from './tripData';

export function buildTripKnowledgeDocument(): string {
  const placeBlock = places
    .map(
      (p) =>
        `- ${p.name} (${p.region}, ${p.alt}, ${p.kind}): ${p.about} Tips: ${p.tips.join('; ')}`,
    )
    .join('\n');

  const dayBlock = days
    .map((d) => {
      const warn = d.warning ? ` Warning: ${d.warning}` : '';
      return `Day ${d.day} (${d.date}): ${d.title}. Place: ${d.place}. Transport: ${d.transport}. Time: ${d.time}. Stay: ${d.stay}. Plan: ${d.details.join('; ')}.${warn}`;
    })
    .join('\n');

  return `
TRIP: ${tripMeta.title}
DATES: ${tripMeta.dates}
TRAIN: ${tripMeta.train}
PRIVATE ROAD TRANSFER: ${tripMeta.privateTransfer}
FLIGHT HOME: ${tripMeta.flight}

PLACES:
${placeBlock}

DAY BY DAY ITINERARY:
${dayBlock}

WINTER SAFETY CHECKLIST:
${safetyChecklist.map((s, i) => `${i + 1}. ${s}`).join('\n')}

TOPICS YOU MAY DISCUSS (only when relevant to this trip): winter driving in Himachal, Lahaul/Atal Tunnel access (planning only, not live status), altitude and cold weather packing, Parvati Valley etiquette, train and flight connections, budgeting for mountain travel, New Year in Kasol planning.
`.trim();
}

export const ASSISTANT_SYSTEM_PROMPT = `You are the personal voice and chat assistant for ONE specific winter Himachal trip (23 Dec 2026 – 03 Jan 2027). You must:

1. Answer ONLY using the trip data below, plus general travel advice that directly helps THIS journey (packing for winter mountains, road safety culture, respectful tourism in Himachal/Parvati). 
2. If asked about unrelated topics (other destinations, coding, politics, etc.), politely refuse and steer back to this trip.
3. Be concise and practical for voice: short paragraphs, clear lists when needed.
4. Never invent confirmed bookings, live road status, or live weather — say to verify locally or with operators.
5. For PDF downloads: when the user asks for a document, itinerary PDF, transport sheet, safety checklist, or full trip pack, include EXACTLY ONE tag on its own line at the very end of your reply (user will not hear it in voice):
   [PDF:itinerary] — full day-by-day itinerary
   [PDF:transport] — train, private transfer, flight summary
   [PDF:safety] — winter safety checklist
   [PDF:places] — all stops with tips
   [PDF:full] — complete trip document
   Choose the best match; use [PDF:full] if they want everything.

TRIP DATA:
`;
