import type { Day, ScheduleRow } from './tripData';

function deriveDayPlan(scheduleRows: ScheduleRow[]): { time: string; details: string[] } {
  if (!scheduleRows.length) return { time: 'Flexible', details: [] };
  return {
    time: scheduleRows.map((r) => r.when).join(' · '),
    details: scheduleRows.map(
      (r) => `${r.when}: ${r.activity} (${r.mode})${r.notes ? ` — ${r.notes}` : ''}`,
    ),
  };
}

function row(
  id: string,
  when: string,
  activity: string,
  mode: string,
  notes: string,
  overnight: string,
): ScheduleRow {
  return { id, when, activity, mode, notes, overnight };
}

function dayFrom(
  day: number,
  date: string,
  title: string,
  place: string,
  transport: string,
  stay: string,
  phaseId: string,
  ids: string[],
  scheduleRows: ScheduleRow[],
  warning?: string,
): Day {
  const plan = deriveDayPlan(scheduleRows);
  return {
    day,
    date,
    title,
    place,
    transport,
    time: plan.time,
    details: plan.details,
    stay,
    warning,
    ids,
    phaseId,
    scheduleRows,
  };
}

/** Final group plan · 23 Dec 2026 — 3 Jan 2027 */
export const planDays: Day[] = [
  dayFrom(
    1,
    'Wed · 23 Dec',
    'Pune → Mumbai · train to Delhi',
    'Pune / BDTS',
    'Train',
    'On train',
    'phase-1',
    ['pune', 'mumbai', 'delhi'],
    [
      row('d1-1', 'Wed, Dec 23 — Morning', 'Pune → Mumbai (connect for Bandra Terminus)', 'Train / local', 'Allow buffer to reach BDTS', 'En route'),
      row('d1-2', 'Dec 23 — 12:45 PM', 'Board 22917 BDTS–NZM SF Express toward Delhi', 'Train', 'Overnight on train', 'Train'),
    ],
  ),
  dayFrom(
    2,
    'Thu · 24 Dec',
    'Delhi · same-day drive to Shimla',
    'Delhi → Shimla',
    'Private cab',
    'Shimla',
    'phase-1',
    ['delhi', 'shimla'],
    [
      row('d2-1', 'Thu, Dec 24 — by 10:00 AM', 'Arrive Delhi (Hazrat Nizamuddin area)', 'Train', 'Target max 10:00 AM arrival', 'Delhi'),
      row('d2-2', 'Dec 24 — 10:00 AM–3:00 PM', 'Breakfast, rest, freshen up, lunch', 'Local taxi / metro', 'Keep luggage ready for afternoon departure', 'Delhi'),
      row('d2-3', 'Dec 24 — ~3:00 PM', 'Leave Delhi for Shimla', 'Private winter cab', 'Winter highway — expect delays', 'En route'),
      row('d2-4', 'Dec 24 — ~9:00–10:00 PM', 'Arrive Shimla · check-in', 'Private cab', 'Target arrival 9–10 PM', 'Shimla'),
    ],
    'Same-day Delhi → Shimla is long; driver rest and road status are critical.',
  ),
  dayFrom(
    3,
    'Fri · 25 Dec',
    'Shimla · chill day',
    'Shimla',
    'Walking / local taxi',
    'Shimla',
    'phase-1',
    ['shimla'],
    [
      row('d3-1', 'Fri, Dec 25 — Morning', 'Slow breakfast and rest after travel', 'Hotel', 'No early alarm', 'Shimla'),
      row('d3-2', 'Dec 25 — Daytime', 'Mall Road, Ridge, cafés — flexible sightseeing', 'Walking / taxi', 'Weather-dependent', 'Shimla'),
      row('d3-3', 'Dec 25 — Evening', 'Dinner and early night', 'Walking', 'Pack for Chitkul drive tomorrow', 'Shimla'),
    ],
  ),
  dayFrom(
    4,
    'Sat · 26 Dec',
    'Shimla → Chitkul',
    'Via Narkanda corridor',
    'Private cab',
    'Chitkul',
    'phase-2',
    ['shimla', 'narkanda', 'chitkul'],
    [
      row('d4-1', 'Sat, Dec 26 — Early', 'Breakfast and depart Shimla', 'Private cab', 'Start early — long winter leg', 'En route'),
      row('d4-2', 'Dec 26 — Day', 'Drive toward Kinnaur / Chitkul', 'Private cab', 'Stops for food and road checks', 'En route'),
      row('d4-3', 'Dec 26 — Evening', 'Reach Chitkul · check-in', 'Private cab', 'Confirm heating and dinner', 'Chitkul'),
    ],
  ),
  dayFrom(
    5,
    'Sun · 27 Dec',
    'Chitkul · then Kalpa',
    'Chitkul → Kalpa',
    'Private cab / walk',
    'Kalpa',
    'phase-2',
    ['chitkul', 'kalpa'],
    [
      row('d5-1', 'Sun, Dec 27 — Morning', 'Explore Chitkul village (if safe)', 'Walking', 'Short walks only in cold', 'Chitkul'),
      row('d5-2', 'Dec 27 — Midday', 'Depart Chitkul for Kalpa', 'Private cab', 'Allow several hours', 'En route'),
      row('d5-3', 'Dec 27 — Afternoon/evening', 'Check in Kalpa · views if clear', 'Hotel', 'Rest after drive', 'Kalpa'),
    ],
  ),
  dayFrom(
    6,
    'Mon · 28 Dec',
    'Kalpa · rest day',
    'Kalpa',
    'Local walks',
    'Kalpa',
    'phase-2',
    ['kalpa'],
    [
      row('d6-1', 'Mon, Dec 28 — Day', 'Chill in Kalpa — Suicide Point / village walks if open', 'Walking / taxi', 'Flexible acclimatisation day', 'Kalpa'),
      row('d6-2', 'Dec 28 — Evening', 'Prepare for Tabo corridor departure', 'Hotel', 'Confirm driver for 29 Dec', 'Kalpa'),
    ],
  ),
  dayFrom(
    7,
    'Tue · 29 Dec',
    'Kalpa → Tabo (Nako · Khab Sangam)',
    'Spiti corridor',
    'Private cab',
    'Tabo',
    'phase-3',
    ['kalpa', 'nako', 'khab', 'tabo'],
    [
      row('d7-1', 'Tue, Dec 29 — Early', 'Leave Kalpa', 'Private cab', 'Early start preferred', 'En route'),
      row('d7-2', 'Dec 29 — Day', 'Nako stop · Khab Sangam confluence', 'Private cab', 'Sightseeing only where safe', 'En route'),
      row('d7-3', 'Dec 29 — Evening', 'Reach Tabo · overnight halt', 'Private cab', 'Planned Tabo stay — book ahead', 'Tabo'),
    ],
    'Tabo is your planned halt. Do not push past dark toward Langza.',
  ),
  dayFrom(
    8,
    'Wed · 30 Dec',
    'Tabo → Langza (Dhankar · Tabo village)',
    'Tabo → Dhankar → Langza',
    'Private cab',
    'Langza',
    'phase-4',
    ['tabo', 'dhankar', 'langza'],
    [
      row('d8-1', 'Wed, Dec 30 — Morning', 'Tabo village & monastery visit', 'Walking / cab', 'Before leaving for Dhankar', 'Tabo'),
      row('d8-2', 'Dec 30 — Midday', 'Tabo → Dhankar monastery viewpoint', 'Private cab', 'Weather-dependent', 'En route'),
      row('d8-3', 'Dec 30 — Afternoon/evening', 'Continue to Langza · homestay check-in', 'Private cab', 'Confirm heating and meals', 'Langza'),
    ],
  ),
  dayFrom(
    9,
    'Thu · 31 Dec',
    'Ke Gompa · Chicham · Komic · Langza',
    'Langza loop',
    'Private local cab',
    'Langza',
    'phase-5',
    ['langza', 'ke-gompa', 'chicham', 'komic', 'langza'],
    [
      row('d9-1', 'Thu, Dec 31 — Morning', 'Key (Ke) Monastery visit', 'Local cab', 'Respect monastery rules', 'En route'),
      row('d9-2', 'Dec 31 — Midday', 'Chicham bridge photo stop', 'Local cab', 'Brief stop — extreme cold wind', 'En route'),
      row('d9-3', 'Dec 31 — Afternoon', 'Komic village (if road open)', 'Local cab', 'High altitude — go slow', 'Langza'),
      row('d9-4', 'Dec 31 — Evening', 'Return Langza · NYE rest (no fixed party)', 'Homestay', 'Warm layers and early night option', 'Langza'),
    ],
  ),
  dayFrom(
    10,
    'Fri · 1 Jan',
    'Langza → Kalpa',
    'Return corridor',
    'Private cab',
    'Kalpa',
    'phase-6',
    ['langza', 'tabo', 'nako', 'kalpa'],
    [
      row('d10-1', 'Fri, Jan 1 — ~7:00 AM', 'Leave Langza for Kalpa', 'Private cab', 'Early departure as planned', 'En route'),
      row('d10-2', 'Jan 1 — Day', 'Drive back via corridor (stops as needed)', 'Private cab', 'Long day — driver rested', 'Kalpa'),
      row('d10-3', 'Jan 1 — Evening', 'Check in Kalpa', 'Hotel', 'Recovery night', 'Kalpa'),
    ],
  ),
  dayFrom(
    11,
    'Sat · 2 Jan',
    'Kalpa → Kufri / Shimla',
    'Return leg',
    'Private cab',
    'Kufri or Shimla (TBD)',
    'phase-7',
    ['kalpa', 'narkanda', 'shimla', 'kufri'],
    [
      row('d11-1', 'Sat, Jan 2 — Morning', 'Depart Kalpa', 'Private cab', 'Open stops TBD in Shimla area on the way', 'En route'),
      row('d11-2', 'Jan 2 — Day', 'Drive toward Kufri / Shimla', 'Private cab', 'Decide Kufri vs Shimla stay locally', 'Kufri or Shimla'),
      row('d11-3', 'Jan 2 — Evening', 'Check-in (Kufri or Shimla)', 'Hotel', 'Confirm next-day Delhi drive plan', 'Kufri or Shimla'),
    ],
    'Overnight location open TBD — Kufri or Shimla while travelling.',
  ),
  dayFrom(
    12,
    'Sun · 3 Jan',
    'Shimla → Delhi · late flight Pune',
    'Road + flight',
    'Private cab + flight',
    'Trip ends in Pune',
    'phase-8',
    ['shimla', 'kufri', 'delhi', 'pune'],
    [
      row('d12-1', 'Sun, Jan 3 — Morning', 'Flexible Shimla time (TBD) then depart for Delhi', 'Private cab', 'Open TBD stops while leaving mountains', 'En route'),
      row('d12-2', 'Jan 3 — Afternoon/evening', 'Reach Delhi IGI with buffer before flight', 'Private cab', 'Winter delays possible', 'Delhi airport'),
      row(
        'd12-3',
        'Jan 3 — late night',
        'Delhi → Pune · Air India AI9825',
        'Flight',
        'Direct · DEL 22:10 → PNQ 00:30 (4 Jan) · reconfirm terminal',
        'Flight',
      ),
    ],
    'Mountain drive + same-day flight is tight — prefer maximum airport buffer.',
  ),
];
