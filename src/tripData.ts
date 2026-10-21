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
};

export const places: Place[] = [
  { id: 'delhi', name: 'Delhi', lat: 28.6139, lng: 77.209, alt: '216 m', region: 'Transit', kind: 'City stop', about: 'Arrival point at Hazrat Nizamuddin before the overnight drive into the mountains.', tips: ['Train arrival planned for 8:35 AM on 24 Dec', 'Private traveller pickup planned for 6:00 PM', 'Use the day to eat, rest, and prepare for a long winter drive'] },
  { id: 'manali', name: 'Manali', lat: 32.2396, lng: 77.1887, alt: '2,050 m', region: 'Lahaul', kind: 'Transit corridor', about: 'The mountain road corridor toward the Atal Tunnel and Lahaul. It is a route reference, not a promise that the road will be open.', tips: ['Confirm tunnel and road status locally', 'Carry warm layers, water, and snacks', 'Do not rely on map lines as live road navigation'] },
  { id: 'sissu', name: 'Sissu', lat: 32.4863, lng: 77.12, alt: '3,120 m', region: 'Lahaul', kind: 'Overnight base', about: 'A scenic Lahaul village with dramatic mountain views and winter landscapes. Keep exploration flexible around snow and access.', tips: ['Target arrival around 8:00 AM on 25 Dec is not guaranteed', 'Rest after the overnight drive', 'Only attempt activities such as paragliding if officially operating and safe'] },
  { id: 'keylong', name: 'Keylong', lat: 32.5717, lng: 77.0322, alt: '3,080 m', region: 'Lahaul', kind: 'Overnight base', about: 'A main settlement in Lahaul and a useful overnight stop for food, supplies, and a slower day in the valley.', tips: ['Sissu departure planned 11:00 AM on 27 Dec', 'Arrival around 3:00 PM is a target only', 'Confirm accommodation and local conditions'] },
  { id: 'jispa', name: 'Jispa', lat: 32.6357, lng: 77.1755, alt: '3,200 m', region: 'Lahaul', kind: 'Overnight base', about: 'A quieter high-valley stop on the Bhaga River. Winter conditions can limit access and outdoor activity.', tips: ['Keylong to Jispa was planned for 28 Dec', 'Earlier departure is preferable to a winter after-dark drive', 'Stay on accessible routes and avoid frozen river edges'] },
  { id: 'bhuntar', name: 'Bhuntar', lat: 31.876, lng: 77.1544, alt: '1,050 m', region: 'Parvati approach', kind: 'Transit point', about: 'A transit point on the approach to Kullu and Parvati Valley, included to orient the journey.', tips: ['Road time from Jispa to Kasol can vary greatly', 'The 30 Dec arrival target is optimistic and weather-dependent', 'Stop overnight if driving conditions make continuing unsafe'] },
  { id: 'kasol', name: 'Kasol', lat: 32.0098, lng: 77.3152, alt: '680 m', region: 'Parvati Valley', kind: 'Main base', about: 'Your base for the Parvati Valley portion of the trip, with cafés, riverside scenery, and access to nearby excursions.', tips: ['Planned stay begins 30 Dec', 'Book New Year accommodation ahead', 'Keep 2 Jan flexible for the return drive to Delhi'] },
  { id: 'chalal', name: 'Chalal', lat: 32.0146, lng: 77.326, alt: 'Approx. 1,600 m', region: 'Parvati Valley', kind: 'Optional walk', about: 'A short walk from Kasol often visited for forest scenery. The path may be icy or affected by weather.', tips: ['Walk only if the trail is open and safe', 'Use suitable footwear and daylight', 'Stay with your group and return before dark'] },
  { id: 'malana', name: 'Malana', lat: 32.0714, lng: 77.3472, alt: '2,650 m', region: 'Parvati Valley', kind: 'Optional excursion', about: 'A remote village commonly visited as a day trip from the Parvati Valley area. Local access and approach conditions may change.', tips: ['Choose Malana OR Manikaran for 1 Jan, not both in a rushed day', 'Check current road/trail access and local guidance', 'Respect local customs and restricted areas'] },
  { id: 'manikaran', name: 'Manikaran', lat: 32.0267, lng: 77.348, alt: '1,760 m', region: 'Parvati Valley', kind: 'Optional excursion', about: 'Known for Manikaran Sahib and hot springs. Visit respectfully and follow site guidance.', tips: ['Alternative to the Malana excursion', 'Check traffic and weather before leaving Kasol', 'Use only permitted public areas'] },
  { id: 'pune', name: 'Pune', lat: 18.5204, lng: 73.8567, alt: '560 m', region: 'Finish', kind: 'Trip finish', about: 'The trip ends in Pune on the night of 3 January 2027 after the confirmed-by-user flight plan.', tips: ['SpiceJet SG105: DEL 9:00 PM → PNQ 11:10 PM', 'Direct flight; duration supplied as 2h 10m', 'Reconfirm schedule, terminal, baggage, and check-in details with the airline'] },
];

export const days: Day[] = [
  { day: 1, date: 'Wed · 23 Dec', title: 'Bandra → Delhi', place: 'Train 22917', transport: 'Train', time: '12:45 PM departure', details: ['Board BDTS–NZM SF Express at Bandra Terminus', 'Keep ticket and photo ID accessible', 'Overnight train journey'], stay: 'On train', ids: ['delhi'] },
  { day: 2, date: 'Thu · 24 Dec', title: 'Arrive Delhi · Depart for Sissu', place: 'Delhi → Lahaul', transport: 'Private traveller', time: '8:35 AM arrival · 6:00 PM departure', details: ['Arrive Hazrat Nizamuddin (NZM), planned 8:35 AM', 'Rest, eat and prepare in Delhi', 'Meet private traveller and begin overnight road transfer'], stay: 'On road', warning: 'Long winter drive. Target Sissu arrival next morning is not guaranteed; prioritise safe driving and rest.', ids: ['delhi', 'manali', 'sissu'] },
  { day: 3, date: 'Fri · 25 Dec', title: 'Arrive and explore Sissu', place: 'Sissu', transport: 'Explore', time: '~8:00 AM target arrival', details: ['Check in, breakfast and rest', 'Explore village and accessible viewpoints', 'Photography and local cafés', 'Adventure activities only if officially operating and safe'], stay: 'Sissu', warning: 'Keep the day flexible after the overnight transfer.', ids: ['sissu'] },
  { day: 4, date: 'Sat · 26 Dec', title: 'Sissu leisure day', place: 'Sissu', transport: 'Explore', time: 'Flexible', details: ['Safe local walks and mountain photography', 'Explore accessible viewpoints', 'Try local food and cafés'], stay: 'Sissu', ids: ['sissu'] },
  { day: 5, date: 'Sun · 27 Dec', title: 'Sissu → Keylong', place: 'Keylong', transport: 'Road transfer', time: '11:00 AM depart · ~3:00 PM target', details: ['Drive to Keylong if road conditions permit', 'Check in and explore accessible local areas', 'Visit market and relax'], stay: 'Keylong', ids: ['sissu', 'keylong'] },
  { day: 6, date: 'Mon · 28 Dec', title: 'Keylong → Jispa', place: 'Jispa', transport: 'Road transfer', time: '5:00 PM intended · ~7:00 PM target', details: ['Explore Keylong in the morning', 'Have lunch and prepare', 'Continue to Jispa only if conditions allow'], stay: 'Jispa', warning: 'Winter after-dark driving risk: an earlier departure is recommended when practical and safe.', ids: ['keylong', 'jispa'] },
  { day: 7, date: 'Tue · 29 Dec', title: 'Explore Jispa', place: 'Jispa', transport: 'Explore', time: 'Flexible', details: ['Accessible village and valley viewpoints', 'Photography and relaxed exploration', 'Safe local walks only'], stay: 'Jispa', ids: ['jispa'] },
  { day: 8, date: 'Wed · 30 Dec', title: 'Jispa → Kasol', place: 'Via Manali / Bhuntar', transport: 'Road transfer', time: '7:00 AM depart · ~2:00 PM target', details: ['Travel via the accessible mountain-road corridor', 'Check in and rest in Kasol', 'Explore nearby areas only if time and conditions permit'], stay: 'Kasol', warning: 'The arrival target is optimistic and weather-dependent. Stop overnight if completing the drive is unsafe.', ids: ['jispa', 'manali', 'bhuntar', 'kasol'] },
  { day: 9, date: 'Thu · 31 Dec', title: 'Kasol · Chalal · New Year', place: 'Kasol / Chalal', transport: 'Walk / Explore', time: 'Daytime and evening', details: ['Explore Kasol', 'Walk to Chalal only if trail is open and safe', 'Cafés and photography', 'Plan a safe return to your accommodation'], stay: 'Kasol or Chalal if booked', warning: 'Chalal accommodation is not confirmed. Stay in Kasol unless you have a confirmed booking.', ids: ['kasol', 'chalal'] },
  { day: 10, date: 'Fri · 1 Jan', title: 'Malana OR Manikaran', place: 'Parvati Valley', transport: 'Day trip', time: 'Start early; return before dark', details: ['Choose one excursion based on weather and access', 'Check local road/trail conditions', 'Explore respectfully and return to Kasol'], stay: 'Kasol', warning: 'Do not rush both excursions into one day.', ids: ['kasol', 'malana', 'manikaran'] },
  { day: 11, date: 'Sat · 2 Jan', title: 'Kasol → Delhi', place: 'Return transfer', transport: 'Private traveller', time: 'Pickup time unconfirmed', details: ['Confirm pickup time with driver', 'Travel toward Delhi with rest stops', 'Reach Delhi as early as practical', 'Stay overnight to protect the flight connection'], stay: 'Delhi', warning: 'Exact departure and arrival times are not confirmed. Reaching Delhi on 2 Jan is strongly recommended.', ids: ['kasol', 'bhuntar', 'delhi'] },
  { day: 12, date: 'Sun · 3 Jan', title: 'Delhi → Pune', place: 'SpiceJet SG105', transport: 'Flight', time: '9:00 PM → 11:10 PM', details: ['Keep the day for rest and airport preparation', 'Arrive at the airport early', 'Direct SpiceJet SG105 flight, user-provided duration 2h 10m', 'Arrive in Pune at 11:10 PM on 3 Jan'], stay: 'Trip ends in Pune', warning: 'Reconfirm flight time and operational details with SpiceJet. No Pune arrival on 4 Jan.', ids: ['delhi', 'pune'] },
];

export const safetyChecklist = [
  'Check official road and tunnel status before each drive',
  'Confirm weather forecast with a reliable local source',
  'Ask driver about winter tyres, chains and vehicle readiness',
  'Keep warm layers, waterproof footwear, gloves and spare socks',
  'Carry water, snacks, power bank, medicines and ID',
  'Keep flexible buffer time; avoid risky after-dark mountain driving',
  'Confirm every accommodation booking, including New Year’s Eve',
  'Reach Delhi on 2 Jan if possible to protect the 3 Jan flight',
];

export const tripMeta = {
  title: 'Winter Himachal Personal Trip',
  dates: '23 Dec 2026 — 03 Jan 2027',
  train: '22917 BDTS–NZM SF Express · 23 Dec 12:45 PM BDTS → 24 Dec 08:35 AM NZM',
  privateTransfer: 'Delhi pickup planned 24 Dec 6:00 PM; return Kasol → Delhi 2 Jan (time unconfirmed)',
  flight: 'SpiceJet SG105 · 3 Jan 2027 · DEL 9:00 PM → PNQ 11:10 PM · direct · ~2h 10m',
};
