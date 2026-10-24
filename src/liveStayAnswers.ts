import { getPlaces, getStayNights } from './itineraryStore';

export function wantsStayAnswer(question: string): boolean {
  const lower = question.toLowerCase();
  if (/\b(assign|expense|spent|paid|gave|balance|aadhaar|id proof|train|flight)\b/i.test(lower)) {
    return false;
  }
  return /\b(stay|staying|hotel|homestay|home\s*stay|camping|accommodation|lodge|where (do|will|are) we (stay|sleep)|where is (my|our|the) stay|booked (hotel|stay))\b/i.test(
    lower,
  );
}

function findPlaceFromQuestion(question: string) {
  const places = getPlaces();
  const lower = question.toLowerCase();
  const ranked = places
    .map((place) => {
      const name = place.name.toLowerCase();
      const short = name.split('(')[0].trim();
      const hit =
        lower.includes(name) ||
        (short.length > 2 && lower.includes(short)) ||
        lower.includes(place.id);
      return { place, hit };
    })
    .filter((row) => row.hit);
  return ranked[0]?.place;
}

export function formatLiveStayReply(question: string): string {
  const place = findPlaceFromQuestion(question);
  const nights = getStayNights();
  const places = getPlaces();

  if (place) {
    const linkedNights = nights.filter((night) => {
      const loc = night.location.toLowerCase();
      const short = place.name.toLowerCase().split('(')[0].trim();
      return loc.includes(short) || short.includes(loc);
    });
    const stayName = place.stayName.trim() || linkedNights.find((n) => n.stayName?.trim())?.stayName?.trim();
    const stayType =
      place.stayType || linkedNights.find((n) => n.stayType)?.stayType || (place.isHalt ? 'stay' : '');

    if (stayName) {
      return [
        `**Stay in ${place.name}** (live from Trip tables)`,
        '',
        `• **Type:** ${stayType || 'listed stay'}`,
        `• **Name:** ${stayName}`,
        linkedNights.length
          ? `• **Nights on checklist:** ${linkedNights.map((n) => n.night).join(', ')}`
          : '• **Nights:** see overnight checklist',
        '',
        'Edit this anytime under **Trip tables → Places, destinations & halts** (Stay type + Stay name), then tap **Update trip**.',
      ].join('\n');
    }

    return [
      `**Stay in ${place.name}**`,
      '',
      '• No hotel / homestay / camping name saved yet.',
      '',
      `Open **Trip tables → Places, destinations & halts**, set **Stay type** and **Stay / hotel name** for **${place.name}**, tap **Update trip**, then ask again.`,
    ].join('\n');
  }

  const withNames = places.filter((p) => p.stayName.trim());
  const lines = withNames.length
    ? withNames.map(
        (p) => `• **${p.name}:** ${p.stayType || 'stay'} — ${p.stayName}`,
      )
    : ['• No stay names filled yet in Trip tables.'];

  return [
    '**Trip stays** (live from Places & overnight checklist)',
    '',
    ...lines,
    '',
    'Ask for a place specifically, e.g. “Where is our stay in Kaza?” or “Hotel name in Langza”.',
  ].join('\n');
}
