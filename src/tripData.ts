export type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: string;
  region: string;
  kind: string;
  about: string;
  tips: string[];
};

export type ScheduleRow = {
  id: string;
  when: string;
  activity: string;
  mode: string;
  notes: string;
  overnight: string;
};

export type Day = {
  day: number;
  date: string;
  title: string;
  place: string;
  transport: string;
  time: string;
  details: string[];
  stay: string;
  warning?: string;
  ids: string[];
  phaseId: string;
  scheduleRows: ScheduleRow[];
};

export type TripPhase = {
  id: string;
  number: number;
  title: string;
  note?: string;
};

export type TransportSegment = {
  id: string;
  segment: string;
  mode: string;
  book: string;
};

export type StayNight = {
  id: string;
  night: string;
  location: string;
  nights: string;
  priority: string;
};

export type TripMeta = {
  brand: string;
  title: string;
  dates: string;
  train: string;
  privateTransfer: string;
  flight: string;
};

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

export function deriveDayPlan(scheduleRows: ScheduleRow[]): { time: string; details: string[] } {
  if (!scheduleRows.length) return { time: 'Flexible', details: [] };
  return {
    time: scheduleRows.map((r) => r.when).join(' · '),
    details: scheduleRows.map(
      (r) => `${r.when}: ${r.activity} (${r.mode})${r.notes ? ` — ${r.notes}` : ''}`,
    ),
  };
}

export const places: Place[] = [
  {
    id: 'pune',
    name: 'Pune',
    lat: 18.5204,
    lng: 73.8567,
    alt: '560 m',
    region: 'Start / Finish',
    kind: 'Home base',
    about: 'Trip start and end point after the Delhi flight home.',
    tips: ['Allow buffer time for the Pune → Mumbai train connection', 'Confirm return flight details before leaving Spiti'],
  },
  {
    id: 'mumbai',
    name: 'Mumbai (Bandra Terminus)',
    lat: 19.0544,
    lng: 72.8402,
    alt: '14 m',
    region: 'Transit',
    kind: 'Train start',
    about: 'Board train 22917 BDTS–NZM SF Express toward Delhi.',
    tips: ['Reach Bandra Terminus with sufficient station buffer', 'Keep ticket and photo ID ready'],
  },
  {
    id: 'delhi',
    name: 'Delhi',
    lat: 28.6139,
    lng: 77.209,
    alt: '216 m',
    region: 'Transit',
    kind: 'City stop',
    about: 'Arrive at Hazrat Nizamuddin, rest, then overnight bus to Shimla; later airport for the Pune flight.',
    tips: ['24 Dec: rest until the overnight bus', '3 Jan: aim for a large airport buffer after the Kufri drive'],
  },
  {
    id: 'shimla',
    name: 'Shimla',
    lat: 31.1048,
    lng: 77.1734,
    alt: '2,276 m',
    region: 'Approach',
    kind: 'Overnight base',
    about: 'First mountain overnight after the Delhi bus; Mall Road and The Ridge if arrival allows.',
    tips: ['Avoid overplanning after overnight bus travel', 'Confirm heated room and luggage drop'],
  },
  {
    id: 'narkanda',
    name: 'Narkanda / Rampur',
    lat: 31.2708,
    lng: 77.4594,
    alt: '2,708 m',
    region: 'Approach',
    kind: 'En route',
    about: 'Corridor on the Shimla → Sangla drive via Narkanda and Rampur.',
    tips: ['Start early from Shimla', 'Keep lunch breaks short'],
  },
  {
    id: 'sangla',
    name: 'Sangla',
    lat: 31.4255,
    lng: 78.2661,
    alt: '2,600 m',
    region: 'Kinnaur',
    kind: 'Overnight base',
    about: 'Baspa Valley overnight with optional Chitkul if the road is open and safe.',
    tips: ['Confirm winter road access and heating', 'Avoid late-night road travel'],
  },
  {
    id: 'chitkul',
    name: 'Chitkul',
    lat: 31.3515,
    lng: 78.4365,
    alt: '3,450 m',
    region: 'Kinnaur',
    kind: 'Optional excursion',
    about: 'Optional day push from Sangla only when the road is confirmed open.',
    tips: ['Skip if conditions are uncertain', 'Return to Sangla before continuing to Kalpa'],
  },
  {
    id: 'kalpa',
    name: 'Kalpa',
    lat: 31.536,
    lng: 78.252,
    alt: '2,960 m',
    region: 'Kinnaur',
    kind: 'Overnight base',
    about: 'Mountain views and staging point for the demanding Kalpa ↔ Kaza winter legs.',
    tips: ['Confirm meals and road access', 'Early departures preferred toward Spiti'],
  },
  {
    id: 'nako',
    name: 'Nako / Sumdo',
    lat: 31.8806,
    lng: 78.6278,
    alt: '3,662 m',
    region: 'Spiti approach',
    kind: 'En route',
    about: 'High corridor stop depending on winter road status toward Tabo and Kaza.',
    tips: ['Do not depend on every roadside shop being open', 'Follow the driver’s safety call'],
  },
  {
    id: 'tabo',
    name: 'Tabo',
    lat: 32.0936,
    lng: 78.3831,
    alt: '3,280 m',
    region: 'Spiti',
    kind: 'En route',
    about: 'Monastery town on the Kalpa–Kaza corridor when conditions allow.',
    tips: ['Use as a status check stop', 'Do not push after dark'],
  },
  {
    id: 'kaza',
    name: 'Kaza',
    lat: 32.2277,
    lng: 78.071,
    alt: '3,650 m',
    region: 'Spiti',
    kind: 'Main Spiti base',
    about: 'Core Spiti overnight for market days, Langza access, and New Year’s Eve.',
    tips: ['Book NYE stay and any event separately', 'Confirm Langza road before leaving'],
  },
  {
    id: 'langza',
    name: 'Langza',
    lat: 32.2805,
    lng: 78.0748,
    alt: '4,400 m',
    region: 'Spiti',
    kind: 'Homestay overnight',
    about: 'High village with Buddha statue; take altitude and cold seriously.',
    tips: ['Confirm heating, bedding, water and meals', 'Move slowly; avoid long walks in extreme cold'],
  },
  {
    id: 'kufri',
    name: 'Kufri',
    lat: 31.0978,
    lng: 77.2674,
    alt: '2,510 m',
    region: 'Return',
    kind: 'Overnight before airport',
    about: 'Return overnight before the long pre-dawn drive to Delhi airport.',
    tips: ['Pack luggage the night before', 'Kufri → DEL same day as the flight is the riskiest connection'],
  },
];

export const tripPhases: TripPhase[] = [
  { id: 'phase-1', number: 1, title: 'Pune → Mumbai → Delhi → Shimla' },
  { id: 'phase-2', number: 2, title: 'Shimla → Sangla → Kalpa' },
  {
    id: 'phase-3',
    number: 3,
    title: 'Kalpa → Tabo → Kaza',
    note: 'Kalpa to Kaza is a demanding winter journey. Do not treat timings as a guarantee. If the driver advises against completing the route, stop at safe accommodation rather than pushing through after dark.',
  },
  { id: 'phase-4', number: 4, title: 'Kaza → Langza → Kaza' },
  { id: 'phase-5', number: 5, title: 'New Year’s Eve in Kaza' },
  {
    id: 'phase-6',
    number: 6,
    title: 'Kaza → Kalpa on the return journey',
    note: 'This return day follows New Year’s Eve. Arrange the driver and departure beforehand and ensure everyone is rested. Do not force a long drive on 1 Jan if the road is unsafe.',
  },
  { id: 'phase-7', number: 7, title: 'Kalpa → Kufri' },
  {
    id: 'phase-8',
    number: 8,
    title: 'Kufri → Delhi Airport → Pune',
    note: 'Kufri to Delhi on the same day as your flight is the riskiest connection. Even leaving around 5 AM cannot guarantee an on-time airport arrival. Prefer Delhi on 2 Jan if possible, or keep a backup plan.',
  },
];

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

export const days: Day[] = [
  dayFrom(
    1,
    'Wed · 23 Dec',
    'Pune → Mumbai → Delhi train',
    'Pune / Bandra Terminus',
    'Train / local',
    'On train',
    'phase-1',
    ['pune', 'mumbai', 'delhi'],
    [
      row('d1-1', 'Wed, Dec 23 — Morning', 'Pune → Mumbai Bandra Terminus', 'Train / local transport', 'Allow sufficient time to reach the station', 'Train journey'),
      row('d1-2', 'Dec 23 — 12:45 PM', 'Board train 22917 BDTS–NZM SF Express', 'Train', 'Departure from Bandra Terminus', 'Train'),
    ],
  ),
  dayFrom(
    2,
    'Thu · 24 Dec',
    'Delhi rest · overnight bus to Shimla',
    'Delhi → Shimla',
    'Local + overnight bus',
    'Overnight bus',
    'phase-1',
    ['delhi', 'shimla'],
    [
      row('d2-1', 'Thu, Dec 24 — 8:35 AM', 'Arrive at Hazrat Nizamuddin, Delhi', 'Train', 'Arrival time based on your booking details', 'Delhi'),
      row('d2-2', 'Dec 24 — 9:00 AM–4:00 PM', 'Breakfast, rest, freshen up and prepare for the overnight journey', 'Local taxi / metro', 'Keep the day relaxed after the train journey', 'Delhi'),
      row('d2-3', 'Dec 24 — 6:00–9:00 PM', 'Delhi → Shimla', 'Overnight bus, subject to schedule', 'Check the exact departure and boarding point before booking', 'Bus'),
    ],
  ),
  dayFrom(
    3,
    'Fri · 25 Dec',
    'Arrive Shimla · Mall Road',
    'Shimla',
    'Bus + walking / taxi',
    'Shimla',
    'phase-1',
    ['shimla'],
    [
      row('d3-1', 'Fri, Dec 25 — Morning', 'Arrive in Shimla', 'Bus', 'Actual arrival depends on the bus', 'Shimla'),
      row('d3-2', 'Dec 25 — 10:00 AM–1:00 PM', 'Hotel check-in or luggage drop, breakfast and rest', 'Walk / taxi', 'Avoid overplanning after overnight travel', 'Shimla'),
      row('d3-3', 'Dec 25 — 2:00–6:00 PM', 'Mall Road, The Ridge, Christ Church and nearby cafés', 'Walking / local taxi', 'Sightseeing depends on arrival time and weather', 'Shimla'),
    ],
    'Keep the day flexible after overnight bus travel.',
  ),
  dayFrom(
    4,
    'Sat · 26 Dec',
    'Shimla → Sangla',
    'Via Narkanda / Rampur / Karcham',
    'Private cab',
    'Sangla',
    'phase-2',
    ['shimla', 'narkanda', 'sangla'],
    [
      row('d4-1', 'Sat, Dec 26 — 6:00 AM', 'Breakfast and departure from Shimla', 'Private cab / experienced local driver', 'Start early', 'En route'),
      row('d4-2', 'Dec 26 — 6:00 AM–12:00 PM', 'Shimla → Narkanda → Rampur area', 'Private cab', 'Approximately 5–6 hours, depending on conditions and stops', 'En route'),
      row('d4-3', 'Dec 26 — 12:00–1:00 PM', 'Lunch and short break', 'Local restaurant', 'Keep the break short', 'En route'),
      row('d4-4', 'Dec 26 — 1:00–5:00 PM or later', 'Continue via Karcham to Sangla', 'Private cab', 'Several hours; winter traffic may add delays', 'Sangla'),
      row('d4-5', 'Dec 26 — Evening', 'Check in, dinner and rest', 'Walk locally', 'Avoid late-night road travel', 'Sangla'),
    ],
  ),
  dayFrom(
    5,
    'Sun · 27 Dec',
    'Sangla / Chitkul option → Kalpa',
    'Sangla → Kalpa',
    'Walking / private cab',
    'Kalpa',
    'phase-2',
    ['sangla', 'chitkul', 'kalpa'],
    [
      row('d5-1', 'Sun, Dec 27 — 7:00–9:00 AM', 'Breakfast and explore Sangla village / Baspa Valley', 'Walking / local taxi', 'Only where accessible and safe', 'Sangla'),
      row('d5-2', 'Dec 27 — 9:00 AM–12:00 PM', 'Optional excursion toward Chitkul', 'Private cab', 'Only if the road is confirmed open and safe; otherwise stay in Sangla', 'Sangla'),
      row('d5-3', 'Dec 27 — 12:00–1:00 PM', 'Lunch', 'Local restaurant / hotel', 'Flexible', 'En route'),
      row('d5-4', 'Dec 27 — 1:00–4:00 PM or later', 'Sangla → Karcham → Reckong Peo → Kalpa', 'Private cab', 'Allow several hours; avoid driving after dark', 'Kalpa'),
      row('d5-5', 'Dec 27 — Evening', 'Check in, dinner and enjoy the mountain views if weather permits', 'Walking locally', 'Relaxed evening', 'Kalpa'),
    ],
  ),
  dayFrom(
    6,
    'Mon · 28 Dec',
    'Kalpa → Tabo → Kaza',
    'Spiti corridor',
    'Private cab',
    'Kaza',
    'phase-3',
    ['kalpa', 'nako', 'tabo', 'kaza'],
    [
      row('d6-1', 'Mon, Dec 28 — 5:30–6:00 AM', 'Wake up, breakfast and prepare to leave', 'Hotel', 'Early departure is preferable', 'Kalpa'),
      row('d6-2', 'Dec 28 — 6:00 AM–11:00 AM', 'Kalpa → Nako / Sumdo area, depending on the road', 'Private cab', 'Allow a generous winter driving buffer', 'En route'),
      row('d6-3', 'Dec 28 — 11:00 AM–12:00 PM', 'Short break and food', 'Local stop, if available', 'Do not depend on every roadside shop being open', 'En route'),
      row('d6-4', 'Dec 28 — 12:00–3:00 PM or later', 'Continue toward Tabo and Kaza', 'Private cab', 'Arrival depends heavily on road and weather conditions', 'Kaza, only if safely reachable'),
      row('d6-5', 'Dec 28 — Evening', 'Hotel check-in, dinner and rest', 'Local walking', 'No major sightseeing planned', 'Kaza'),
    ],
    'Demanding winter journey. Stop at safe accommodation if the driver advises against completing the route after dark.',
  ),
  dayFrom(
    7,
    'Tue · 29 Dec',
    'Kaza → Langza overnight',
    'Langza',
    'Private local cab / walking',
    'Langza',
    'phase-4',
    ['kaza', 'langza'],
    [
      row('d7-1', 'Tue, Dec 29 — 8:00–9:00 AM', 'Breakfast in Kaza and confirm Langza road access', 'Hotel / local driver', 'Check weather and road status', 'Kaza'),
      row('d7-2', 'Dec 29 — 9:00–11:00 AM', 'Kaza → Langza', 'Private local cab', 'Allow extra time for snow and icy roads', 'Langza'),
      row('d7-3', 'Dec 29 — 11:00 AM–1:00 PM', 'Explore Langza village and Buddha statue, if accessible', 'Walking', 'Take it slowly due to altitude and cold', 'Langza'),
      row('d7-4', 'Dec 29 — 1:00–2:00 PM', 'Lunch at your homestay, if available', 'Homestay', 'Arrange meals beforehand', 'Langza'),
      row('d7-5', 'Dec 29 — 2:00–4:00 PM', 'Enjoy the village, scenery and photography', 'Walking near the accommodation', 'Avoid wandering far in extreme cold', 'Langza'),
      row('d7-6', 'Dec 29 — Evening', 'Dinner and overnight stay in Langza', 'Homestay', 'Confirm room heating, bedding, water and meals', 'Langza'),
    ],
  ),
  dayFrom(
    8,
    'Wed · 30 Dec',
    'Langza → Kaza',
    'Kaza',
    'Private local cab',
    'Kaza',
    'phase-4',
    ['langza', 'kaza'],
    [
      row('d8-1', 'Wed, Dec 30 — 8:00–10:00 AM', 'Breakfast and depart Langza', 'Private local cab', 'Weather-dependent', 'Langza'),
      row('d8-2', 'Dec 30 — 10:00 AM–12:00 PM', 'Langza → Kaza', 'Private local cab', 'Allow a buffer for icy roads', 'Kaza'),
      row('d8-3', 'Dec 30 — Afternoon', 'Rest, explore Kaza market and arrange New Year’s Eve plans', 'Walking / local taxi', 'Check which shops and cafés are operating', 'Kaza'),
      row('d8-4', 'Dec 30 — Evening', 'Dinner and rest', 'Walking / hotel', 'Keep warm and prepare for the next day', 'Kaza'),
    ],
  ),
  dayFrom(
    9,
    'Thu · 31 Dec',
    'New Year’s Eve in Kaza',
    'Kaza',
    'Walking / local taxi',
    'Kaza',
    'phase-5',
    ['kaza'],
    [
      row('d9-1', 'Thu, Dec 31 — 9:00–11:00 AM', 'Breakfast and explore Kaza', 'Walking / local taxi', 'Keep plans flexible', 'Kaza'),
      row('d9-2', 'Dec 31 — 11:00 AM–1:00 PM', 'Visit local viewpoints or nearby accessible attractions', 'Local cab', 'Only if the weather and roads permit', 'Kaza'),
      row('d9-3', 'Dec 31 — 1:00–2:00 PM', 'Lunch', 'Local café / hotel', 'Confirm opening hours', 'Kaza'),
      row('d9-4', 'Dec 31 — 2:00–5:00 PM', 'Rest, photography and prepare for the evening', 'Walking / hotel', 'Avoid tiring excursions', 'Kaza'),
      row('d9-5', 'Dec 31 — 5:00–7:00 PM', 'Return to your hotel, freshen up and dress warmly', 'Walking / local cab', 'Confirm the event venue and transport', 'Kaza'),
      row('d9-6', 'Dec 31 — 7:00 PM onward', 'New Year’s Eve dinner, gathering and countdown, if organised', 'Hotel / booked event', 'Book and verify in advance; a public party is not guaranteed', 'Kaza'),
    ],
  ),
  dayFrom(
    10,
    'Fri · 1 Jan',
    'Kaza → Kalpa return',
    'Via Tabo / Nako',
    'Private cab',
    'Kalpa / safe en-route alternative',
    'phase-6',
    ['kaza', 'tabo', 'nako', 'kalpa'],
    [
      row('d10-1', 'Fri, Jan 1 — 5:30–6:00 AM', 'Wake up and prepare for departure', 'Hotel', 'Leave only if the driver confirms safe conditions', 'Kaza'),
      row('d10-2', 'Jan 1 — 6:00 AM–11:00 AM', 'Kaza → Tabo / Sumdo direction', 'Private cab', 'Winter conditions can cause major delays', 'En route'),
      row('d10-3', 'Jan 1 — 11:00 AM–12:00 PM', 'Food and road-status check', 'Available local stop', 'Do not assume all shops are open', 'En route'),
      row('d10-4', 'Jan 1 — 12:00–5:00 PM or later', 'Continue via Nako and toward Kalpa, if safe', 'Private cab', 'Potentially a very long day', 'Kalpa, if reachable safely'),
      row('d10-5', 'Jan 1 — Evening', 'Check in, dinner and rest', 'Hotel', 'If Kalpa is not safely reachable, use suitable accommodation farther along the route', 'Kalpa / safe en-route alternative'),
    ],
    'Do not force this long drive after NYE if the road is unsafe or the group is not rested.',
  ),
  dayFrom(
    11,
    'Sat · 2 Jan',
    'Kalpa → Kufri',
    'Via Reckong Peo / Rampur',
    'Private cab',
    'Kufri',
    'phase-7',
    ['kalpa', 'narkanda', 'shimla', 'kufri'],
    [
      row('d11-1', 'Sat, Jan 2 — 6:00–7:00 AM', 'Breakfast and depart Kalpa', 'Private cab', 'Early start recommended', 'Kalpa'),
      row('d11-2', 'Jan 2 — Morning to early afternoon', 'Kalpa → Reckong Peo → Karcham → Rampur / Narkanda direction', 'Private cab', 'Several hours; stop only where safe', 'En route'),
      row('d11-3', 'Jan 2 — Lunch break', 'Lunch at an available stop', 'Local restaurant', 'Keep a buffer for winter delays', 'En route'),
      row('d11-4', 'Jan 2 — Afternoon/evening', 'Continue toward Kufri via the Shimla area', 'Private cab', 'Total journey can be around 8–10+ hours', 'Kufri'),
      row('d11-5', 'Jan 2 — Evening', 'Check in, dinner and rest', 'Walking / hotel', 'Avoid late-night sightseeing', 'Kufri'),
    ],
  ),
  dayFrom(
    12,
    'Sun · 3 Jan',
    'Kufri → Delhi airport → Pune',
    'IGI → Pune flight',
    'Private cab + flight',
    'Trip ends in Pune',
    'phase-8',
    ['kufri', 'shimla', 'delhi', 'pune'],
    [
      row('d12-1', 'Sun, Jan 3 — 4:30–5:00 AM', 'Wake up, check weather and road status, have breakfast or take packed food', 'Hotel', 'Keep luggage ready the night before', 'Kufri'),
      row('d12-2', 'Jan 3 — 5:00–5:30 AM', 'Depart Kufri for Delhi airport', 'Pre-booked private cab', 'Allow a substantial winter road-delay buffer', 'En route'),
      row('d12-3', 'Jan 3 — Morning to afternoon', 'Travel via Shimla and onward toward Delhi', 'Private cab', 'A long drive; actual arrival is traffic- and weather-dependent', 'Delhi airport'),
      row('d12-4', 'Jan 3 — By late afternoon, ideally', 'Arrive at Indira Gandhi International Airport', 'Private cab', 'Aim to reach several hours before AI9825 (22:10)', 'Airport'),
      row(
        'd12-5',
        'Jan 3 — 22:10',
        'Delhi → Pune · Air India AI9825 (Air India Express)',
        'Flight',
        'Direct · 2h 20m · Economy · cabin + checked bag. Arrives PNQ 00:30 on 4 Jan',
        'Flight / arrive Pune 4 Jan',
      ),
    ],
    'Critical: same-day Kufri → Delhi airport before the 22:10 flight is the riskiest connection. Prefer a Delhi overnight on 2 Jan if possible. Arrival in Pune is early morning 4 Jan.',
  ),
];

export const transportSegments: TransportSegment[] = [
  { id: 't1', segment: 'Pune → Mumbai', mode: 'Train / local transport', book: 'Pune–Mumbai connection with sufficient buffer' },
  { id: 't2', segment: 'Mumbai → Delhi', mode: 'Train 22917', book: 'Stated train departing Dec 23 at 12:45 PM' },
  { id: 't3', segment: 'Delhi → Shimla', mode: 'Overnight bus', book: 'Confirm departure on Dec 24, bus operator and boarding point' },
  { id: 't4', segment: 'Shimla → Sangla', mode: 'Private cab with winter-driving experience', book: 'One-way or multi-day cab' },
  { id: 't5', segment: 'Sangla → Kalpa', mode: 'Private cab', book: 'Continue the same cab if practical' },
  { id: 't6', segment: 'Kalpa → Kaza', mode: 'Private cab / local winter driver', book: 'Confirm road accessibility before departure' },
  { id: 't7', segment: 'Kaza → Langza → Kaza', mode: 'Local cab', book: 'Arrange locally and confirm road conditions' },
  { id: 't8', segment: 'Kaza → Kalpa', mode: 'Private cab', book: 'Confirm the return route and a safe fallback stop' },
  { id: 't9', segment: 'Kalpa → Kufri', mode: 'Private cab', book: 'Confirm early departure and winter equipment' },
  { id: 't10', segment: 'Kufri → Delhi airport', mode: 'Pre-booked cab', book: 'Direct airport transfer with a backup option' },
  {
    id: 't11',
    segment: 'Delhi → Pune',
    mode: 'Air India AI9825 (Air India Express)',
    book: 'DEL 22:10 (3 Jan) → PNQ 00:30 (4 Jan) · Economy · cabin + checked bag · reconfirm terminal',
  },
];

export const stayNights: StayNight[] = [
  { id: 's1', night: 'Dec 23', location: 'Train', nights: '1', priority: 'Confirm train ticket' },
  { id: 's2', night: 'Dec 24', location: 'Overnight bus', nights: '1', priority: 'Confirm bus and seat' },
  { id: 's3', night: 'Dec 25', location: 'Shimla', nights: '1', priority: 'Heated room and convenient location' },
  { id: 's4', night: 'Dec 26', location: 'Sangla', nights: '1', priority: 'Confirm winter road access and heating' },
  { id: 's5', night: 'Dec 27', location: 'Kalpa', nights: '1', priority: 'Confirm road access and meals' },
  { id: 's6', night: 'Dec 28', location: 'Kaza', nights: '1', priority: 'Confirm road conditions and accommodation' },
  { id: 's7', night: 'Dec 29', location: 'Langza', nights: '1', priority: 'Confirm overnight homestay, heating and food' },
  { id: 's8', night: 'Dec 30', location: 'Kaza', nights: '1', priority: 'Book in advance' },
  { id: 's9', night: 'Dec 31', location: 'Kaza', nights: '1', priority: 'Book accommodation and any New Year event separately' },
  { id: 's10', night: 'Jan 1', location: 'Kalpa', nights: '1', priority: 'Keep a safe en-route alternative' },
  { id: 's11', night: 'Jan 2', location: 'Kufri', nights: '1', priority: 'Book ahead' },
  {
    id: 's12',
    night: 'Jan 3–4',
    location: 'Flight → Pune',
    nights: '—',
    priority: 'AI9825 overnight arrival 00:30 on 4 Jan — reconfirm terminal and bags',
  },
];

export const safetyChecklist = [
  'Check official road and weather status before each Spiti / Kinnaur drive',
  'Confirm winter tyres, chains and an experienced local driver for mountain legs',
  'Keep warm layers, waterproof footwear, gloves, spare socks, water, snacks, power bank, medicines and ID',
  'Do not push Kalpa ↔ Kaza after dark; stop at safe accommodation if advised',
  'Confirm Langza heating, bedding, water and meals before overnight',
  'Book New Year’s Eve stay and any event in Kaza separately',
  'After NYE, only leave Kaza when the group is rested and the driver confirms conditions',
  'Treat Kufri → Delhi airport on 3 Jan as high risk; prefer a Delhi overnight on 2 Jan if possible',
];

export const tripMeta: TripMeta = {
  brand: 'Spiti Tour 2026',
  title: 'Spiti Tour 2026',
  dates: '23 Dec 2026 — 03 Jan 2027',
  train: '22917 BDTS–NZM SF Express · 23 Dec 12:45 PM BDTS → 24 Dec 08:35 AM NZM',
  privateTransfer:
    'Delhi → Shimla overnight bus 24 Dec; then private winter cab Shimla → Sangla → Kalpa → Kaza (and return via Kalpa → Kufri → Delhi airport)',
  flight:
    'Air India AI9825 · Operated by Air India Express · DEL 22:10 (Sun 3 Jan 2027) → PNQ 00:30 (Mon 4 Jan 2027) · direct · 2h 20m · Economy · cabin + checked bag',
};

export const defaultItinerarySnapshot = {
  tripMeta,
  places,
  days,
  tripPhases,
  transportSegments,
  stayNights,
  safetyChecklist,
};
