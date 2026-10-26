import {
  getDays,
  getTransportSegments,
  getTripMeta,
} from './itineraryStore';

function isTrainRow(mode: string, activity: string, notes: string): boolean {
  return /train|rail|bdts|nzm|22917/i.test(`${mode} ${activity} ${notes}`);
}

function isFlightRow(mode: string, activity: string, notes: string): boolean {
  return /flight|airline|ai\d+|airport/i.test(`${mode} ${activity} ${notes}`);
}

/** Questions that should be answered from the live trip tables, not stale chat memory. */
export function wantsLiveScheduleAnswer(question: string): boolean {
  const lower = question.toLowerCase();
  if (
    /\b(assign|expense|spent|paid|gave|balance|owe|owes|owing|debt|settle|receive|aadhaar|id proof|identity)\b/i.test(
      lower,
    )
  ) {
    return false;
  }
  return /\b(train|rail|flight|airline|itinerary|schedule|transport|bus|overnight bus|cab|22917|bdts|nzm|ai\d+|day\s*\d{1,2}|what('?s| is) (my|the) (plan|route))\b/i.test(
    lower,
  );
}

export function formatLiveScheduleReply(question: string): string {
  const days = getDays();
  const tripMeta = getTripMeta();
  const transport = getTransportSegments();
  const lower = question.toLowerCase();

  if (/\b(train|rail|bdts|nzm|22917)\b/i.test(lower)) {
    const rows = days.flatMap((day) =>
      day.scheduleRows
        .filter((row) => isTrainRow(row.mode, row.activity, row.notes))
        .map((row) => ({ ...row, day: day.day, date: day.date })),
    );
    const booking = transport.filter((segment) =>
      /train|mumbai|delhi|22917/i.test(`${segment.segment} ${segment.mode}`),
    );
    const lines =
      rows.length > 0
        ? rows.map(
            (row) =>
              `• **Day ${row.day} (${row.date}) — ${row.when}:** ${row.activity}\n  Mode: ${row.mode}${row.notes ? ` · ${row.notes}` : ''}${row.overnight ? ` · Overnight: ${row.overnight}` : ''}`,
          )
        : [`• ${tripMeta.train}`];
    const bookingLines = booking.map(
      (segment) => `• **${segment.segment}:** ${segment.mode} — ${segment.book}`,
    );
    return [
      'Here are the **current train details** from your Trip tables (live after Update trip):',
      '',
      ...lines,
      bookingLines.length ? '' : null,
      bookingLines.length ? '**Booking summary**' : null,
      ...bookingLines,
      '',
      `Summary line: **${tripMeta.train}**`,
      '',
      'If this looks wrong, edit the train rows in **Trip tables**, tap **Update trip**, then ask again.',
    ]
      .filter((line) => line != null)
      .join('\n');
  }

  if (/\b(flight|airline|ai\d+|delhi\s*→\s*pune|pune\s*flight)\b/i.test(lower)) {
    const rows = days.flatMap((day) =>
      day.scheduleRows
        .filter((row) => isFlightRow(row.mode, row.activity, row.notes))
        .map((row) => ({ ...row, day: day.day, date: day.date })),
    );
    const lines =
      rows.length > 0
        ? rows.map(
            (row) =>
              `• **Day ${row.day} (${row.date}) — ${row.when}:** ${row.activity}\n  ${row.mode}${row.notes ? ` · ${row.notes}` : ''}${row.overnight ? ` · ${row.overnight}` : ''}`,
          )
        : [`• ${tripMeta.flight}`];
    return [
      'Here are the **current flight details** from your Trip tables:',
      '',
      ...lines,
      '',
      `Summary line: **${tripMeta.flight}**`,
    ].join('\n');
  }

  const dayMatch = lower.match(/\bday\s*(\d{1,2})\b/);
  if (dayMatch) {
    const dayNum = parseInt(dayMatch[1], 10);
    const day = days.find((item) => item.day === dayNum);
    if (day) {
      const rows = day.scheduleRows.map(
        (row) =>
          `• **${row.when}:** ${row.activity} (${row.mode})${row.notes ? ` — ${row.notes}` : ''}${row.overnight ? ` · Overnight: ${row.overnight}` : ''}`,
      );
      return [
        `**Day ${day.day} — ${day.date}: ${day.title}**`,
        '',
        `Place: ${day.place}`,
        `Stay: ${day.stay}`,
        '',
        ...rows,
        day.warning ? `\nNote: ${day.warning}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
  }

  // General itinerary / transport overview from live tables
  const overview = days
    .slice(0, 4)
    .map((day) => {
      const first = day.scheduleRows[0];
      return `• **Day ${day.day} (${day.date}):** ${day.title}${first ? ` — ${first.activity}` : ''} · Stay: ${day.stay}`;
    })
    .join('\n');

  return [
    'Live plan snapshot from your **Trip tables**:',
    '',
    `**Train:** ${tripMeta.train}`,
    `**Flight:** ${tripMeta.flight}`,
    '',
    '**First days**',
    overview,
    '',
    'Ask about a specific day (e.g. “Day 1”), the train, or the flight for full rows.',
  ].join('\n');
}
