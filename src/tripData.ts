import { planDays } from './tripDaysPlan';

export type StayType = '' | 'hotel' | 'homestay' | 'camping' | 'other';

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
  /** Overnight / rest halt used on the map and stay checklist. */
  isHalt: boolean;
  /** hotel | homestay | camping | other — set in Trip tables. */
  stayType: StayType;
  /** Property name (fill in later) — chatbot answers “where do we stay in Kaza?” from this. */
  stayName: string;
};

export function inferPlaceIsHalt(place: Pick<Place, 'kind' | 'isHalt'>): boolean {
  if (typeof place.isHalt === 'boolean') return place.isHalt;
  return /overnight|homestay|home base|main .*base|before airport/i.test(place.kind);
}

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
  /** Calendar line shown in UI, e.g. Wed · 29 Dec */
  dateLabel: string;
  /** Trip day number 1–12 */
  tripDay: number;
  location: string;
  nights: string;
  priority: string;
  checkIn: string;
  checkOut: string;
  /** Hotel / homestay / camping name for that night (mirrors Places stay when linked). */
  stayName?: string;
  stayType?: StayType;
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
    isHalt: true,
    stayType: '',
    stayName: '',
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
    isHalt: false,
    stayType: '',
    stayName: '',
  },
  {
    id: 'delhi',
    name: 'Delhi',
    lat: 28.6139,
    lng: 77.209,
    alt: '216 m',
    region: 'Transit',
    kind: 'City stop',
    about: 'Arrive at Hazrat Nizamuddin by mid-morning, then same-day road transfer to Shimla; later IGI for the Pune flight.',
    tips: ['24 Dec: target Delhi by 10:00 AM; depart for Shimla ~3:00 PM', '3 Jan: large airport buffer after the mountain drive'],
    isHalt: false,
    stayType: '',
    stayName: '',
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
    isHalt: true,
    stayType: '',
    stayName: '',
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
    isHalt: false,
    stayType: '',
    stayName: '',
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
    isHalt: true,
    stayType: '',
    stayName: '',
  },
  {
    id: 'chitkul',
    name: 'Chitkul',
    lat: 31.3515,
    lng: 78.4365,
    alt: '3,450 m',
    region: 'Kinnaur',
    kind: 'Optional excursion',
    about: 'Last inhabited village near the Indo-Tibet border; winter overnight only if road and heating are confirmed.',
    tips: ['Shimla → Chitkul is a long winter leg — start early', 'Confirm homestay heating and meals'],
    isHalt: true,
    stayType: '',
    stayName: '',
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
    isHalt: true,
    stayType: '',
    stayName: '',
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
    isHalt: false,
    stayType: '',
    stayName: '',
  },
  {
    id: 'tabo',
    name: 'Tabo',
    lat: 32.0936,
    lng: 78.3831,
    alt: '3,280 m',
    region: 'Spiti',
    kind: 'Overnight halt',
    about: 'Overnight halt on the Spiti corridor — Tabo monastery village; plan as your planned halt before Langza.',
    tips: ['Book Tabo stay in advance for winter', 'Explore Tabo village the next morning before Dhankar'],
    isHalt: true,
    stayType: 'homestay',
    stayName: '',
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
    isHalt: true,
    stayType: '',
    stayName: '',
  },
  {
    id: 'dhankar',
    name: 'Dhankar',
    lat: 32.1172,
    lng: 78.0411,
    alt: '3,894 m',
    region: 'Spiti',
    kind: 'Monastery stop',
    about: 'Dhankar monastery viewpoint on the Tabo → Langza corridor.',
    tips: ['Short visit only if road and weather allow', 'Do not rush after dark toward Langza'],
    isHalt: false,
    stayType: '',
    stayName: '',
  },
  {
    id: 'khab',
    name: 'Khab Sangam',
    lat: 31.97,
    lng: 78.65,
    alt: '2,660 m',
    region: 'Spiti approach',
    kind: 'En route',
    about: 'Confluence of Spiti and Sutlej rivers on the Kalpa → Tabo drive.',
    tips: ['Photo stop only — stay with the vehicle', 'Windy and cold at the bridge'],
    isHalt: false,
    stayType: '',
    stayName: '',
  },
  {
    id: 'komic',
    name: 'Komic',
    lat: 32.2833,
    lng: 78.05,
    alt: '4,520 m',
    region: 'Spiti',
    kind: 'High village',
    about: 'One of the highest villages with road access; often combined with Langza loop days.',
    tips: ['Altitude + cold — move slowly', 'Return to Langza before dark'],
    isHalt: false,
    stayType: '',
    stayName: '',
  },
  {
    id: 'ke-gompa',
    name: 'Key Monastery',
    lat: 32.2861,
    lng: 78.0133,
    alt: '4,166 m',
    region: 'Spiti',
    kind: 'Monastery',
    about: 'Key (Ke) Gompa — classic Spiti monastery visit on the Langza circuit.',
    tips: ['Respect monastery rules and photography signs', 'Combine with Chicham bridge same day'],
    isHalt: false,
    stayType: '',
    stayName: '',
  },
  {
    id: 'chicham',
    name: 'Chicham Bridge',
    lat: 32.2745,
    lng: 78.0789,
    alt: '4,000 m',
    region: 'Spiti',
    kind: 'Viewpoint',
    about: 'High gorge bridge — iconic photo stop near Komic / Langza loop.',
    tips: ['Stay behind safety barriers', 'Extremely cold wind — limit exposure time'],
    isHalt: false,
    stayType: '',
    stayName: '',
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
    isHalt: true,
    stayType: 'homestay',
    stayName: '',
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
    isHalt: true,
    stayType: '',
    stayName: '',
  },
];

export const tripPhases: TripPhase[] = [
  { id: 'phase-1', number: 1, title: 'Pune → Mumbai → Delhi → Shimla (24 Dec)' },
  { id: 'phase-2', number: 2, title: 'Shimla · Chitkul · Kalpa' },
  {
    id: 'phase-3',
    number: 3,
    title: 'Kalpa → Tabo halt (Nako · Khab Sangam)',
    note: 'Winter corridor days are weather-dependent. Tabo is your planned overnight halt before Langza.',
  },
  { id: 'phase-4', number: 4, title: 'Tabo → Langza (Dhankar · Tabo village)' },
  { id: 'phase-5', number: 5, title: 'Langza loop (Ke Gompa · Chicham · Komic)' },
  { id: 'phase-6', number: 6, title: 'Langza → Kalpa (1 Jan)' },
  { id: 'phase-7', number: 7, title: 'Kalpa → Kufri / Shimla (2 Jan · open TBD)' },
  {
    id: 'phase-8',
    number: 8,
    title: 'Shimla → Delhi → Pune (3 Jan late flight)',
    note: 'Same-day mountain drive plus late-night flight is tight. Keep Shimla stops flexible and aim for a safe airport buffer.',
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

export const days: Day[] = planDays;


export const transportSegments: TransportSegment[] = [
  { id: 't1', segment: 'Pune → Mumbai', mode: 'Train / local transport', book: 'Pune–Mumbai connection with sufficient buffer' },
  { id: 't2', segment: 'Mumbai → Delhi', mode: 'Train 22917', book: 'Departs Dec 23 · 12:45 PM BDTS' },
  { id: 't3', segment: 'Delhi → Shimla', mode: 'Private cab (24 Dec ~3 PM)', book: 'Target Delhi by 10 AM · Shimla arrival ~9–10 PM' },
  { id: 't4', segment: 'Shimla → Chitkul', mode: 'Private winter cab', book: '26 Dec early start' },
  { id: 't5', segment: 'Chitkul → Kalpa', mode: 'Private cab', book: '27 Dec after Chitkul explore' },
  { id: 't6', segment: 'Kalpa → Tabo', mode: 'Private cab', book: '29 Dec via Nako · Khab Sangam — Tabo halt booked' },
  { id: 't7', segment: 'Tabo → Langza', mode: 'Private cab', book: '30 Dec via Dhankar & Tabo village' },
  { id: 't8', segment: 'Langza loop', mode: 'Local cab', book: '31 Dec Ke Gompa · Chicham · Komic' },
  { id: 't9', segment: 'Langza → Kalpa', mode: 'Private cab', book: '1 Jan ~7 AM departure' },
  { id: 't10', segment: 'Kalpa → Kufri / Shimla', mode: 'Private cab', book: '2 Jan — overnight TBD Kufri or Shimla' },
  { id: 't11', segment: 'Shimla → Delhi airport', mode: 'Pre-booked cab', book: '3 Jan flexible Shimla stops TBD' },
  {
    id: 't12',
    segment: 'Delhi → Pune',
    mode: 'Air India AI9825 (Air India Express)',
    book: 'DEL 22:10 (3 Jan) → PNQ 00:30 (4 Jan) · Economy · cabin + checked bag · reconfirm terminal',
  },
];

export const stayNights: StayNight[] = [
  {
    id: 's1',
    night: 'Dec 23',
    dateLabel: 'Wed · 23 Dec',
    tripDay: 1,
    location: 'Train (BDTS → Delhi)',
    nights: '1',
    priority: 'Confirm 22917 tickets & Pune–Mumbai connection',
    checkIn: '12:45 PM · board BDTS',
    checkOut: 'Thu 24 Dec · ~10:00 AM Delhi (target)',
  },
  {
    id: 's2',
    night: 'Dec 24–25',
    dateLabel: 'Thu · 24 Dec (arrive) · Fri · 25 Dec',
    tripDay: 2,
    location: 'Shimla',
    nights: '2',
    priority: 'Heated hotel · Mall Road area convenient',
    checkIn: '24 Dec · ~9:00–10:00 PM',
    checkOut: '26 Dec · morning (leave for Chitkul)',
  },
  {
    id: 's3',
    night: 'Dec 26',
    dateLabel: 'Sat · 26 Dec',
    tripDay: 4,
    location: 'Chitkul',
    nights: '1',
    priority: 'Winter homestay · heating & meals confirmed',
    checkIn: 'Evening on arrival',
    checkOut: '27 Dec · morning explore then depart',
  },
  {
    id: 's4',
    night: 'Dec 27–28',
    dateLabel: 'Sun · 27 Dec · Mon · 28 Dec',
    tripDay: 5,
    location: 'Kalpa',
    nights: '2',
    priority: 'Rest day 28 Dec in Kalpa',
    checkIn: '27 Dec · afternoon/evening',
    checkOut: '29 Dec · early (Tabo corridor)',
  },
  {
    id: 's5',
    night: 'Dec 29',
    dateLabel: 'Tue · 29 Dec',
    tripDay: 7,
    location: 'Tabo',
    nights: '1',
    priority: 'Planned halt — book Tabo monastery village stay',
    checkIn: 'Evening after Nako · Khab Sangam',
    checkOut: '30 Dec · morning (Tabo village visit)',
    stayType: 'homestay',
  },
  {
    id: 's6',
    night: 'Dec 30–31',
    dateLabel: 'Wed · 30 Dec · Thu · 31 Dec',
    tripDay: 8,
    location: 'Langza',
    nights: '2',
    priority: 'Homestay heating · meals · NYE flexible',
    checkIn: '30 Dec · evening',
    checkOut: '1 Jan · ~7:00 AM (to Kalpa)',
    stayType: 'homestay',
  },
  {
    id: 's7',
    night: 'Jan 1',
    dateLabel: 'Fri · 1 Jan',
    tripDay: 10,
    location: 'Kalpa',
    nights: '1',
    priority: 'Recovery night after long return drive',
    checkIn: 'Afternoon/evening',
    checkOut: '2 Jan · morning',
  },
  {
    id: 's8',
    night: 'Jan 2',
    dateLabel: 'Sat · 2 Jan',
    tripDay: 11,
    location: 'Kufri or Shimla (TBD)',
    nights: '1',
    priority: 'Decide on the road · book if possible',
    checkIn: 'Evening',
    checkOut: '3 Jan · morning (Delhi drive)',
  },
  {
    id: 's9',
    night: 'Jan 3–4',
    dateLabel: 'Sun · 3 Jan',
    tripDay: 12,
    location: 'Delhi IGI → Pune flight',
    nights: '—',
    priority: 'AI9825 DEL 22:10 → PNQ 00:30 (4 Jan)',
    checkIn: 'Airport · allow long buffer after mountain drive',
    checkOut: 'Land Pune ~00:30 on 4 Jan',
  },
];

export type SafetyCategory = {
  id: string;
  title: string;
  intro: string;
  points: string[];
};

export type MustCarryGroup = {
  id: string;
  title: string;
  items: string[];
};

/** Detailed winter / Spiti safety guide shown on the Safety page. */
export const safetyCategories: SafetyCategory[] = [
  {
    id: 'weather-cold',
    title: 'Weather & extreme cold',
    intro:
      'Late December to early January in Kinnaur–Spiti is severe. Day highs in Kaza/Langza are often below freezing; nights can drop to −15°C to −22°C or lower with wind chill.',
    points: [
      'Expect dry cold, strong wind, and sudden temperature drops after sunset — plan outdoor time for midday only in Spiti.',
      'Layer clothing (base + mid fleece + windproof outer). Never rely on a single thick jacket alone.',
      'Cover head, ears, neck and hands at all times outdoors in Kaza/Langza; heat loss is fastest there.',
      'Keep lips, face and hands moisturised; high-altitude winter air cracks skin quickly.',
      'Watch for early signs of hypothermia (shivering, confusion, slurred speech) and frostbite (numb white/grey fingers, toes, nose, ears) — warm up indoors immediately and tell the group.',
      'Do not walk long distances alone after dark in Spiti villages; ice and black ice are common.',
      'Battery power dies faster in cold — keep phone/power bank inside an inner pocket close to the body.',
    ],
  },
  {
    id: 'natural-calamities',
    title: 'Natural calamities & road hazards',
    intro:
      'Winter mountain roads can close without notice due to snow, ice, landslides, rockfall or blocked passes. Treat every long drive as weather-dependent.',
    points: [
      'Check official Himachal / local road and weather status before every Kinnaur–Spiti drive; do not rely only on social media.',
      'Snowfall, black ice, white-out, and blocked stretches between Kalpa ↔ Kaza are common mid-winter risks.',
      'Landslides or rockfall can cut the highway for hours or days — keep buffer days and cash for unexpected hotel nights.',
      'If the driver advises turning back or stopping early, accept it. The itinerary is a plan, not a promise.',
      'Never force a drive after dark on Kalpa ↔ Kaza or high corridors; stop at the nearest safe lodging.',
      'In a white-out or heavy snow, stay with the vehicle/group; do not walk off-road to “find a signal”.',
      'Keep the group’s emergency contacts, hotel numbers and driver’s number written on paper (phones can die).',
      'If stranded, stay visible, conserve fuel/heat, share food/water, and wait for local help rather than splitting up.',
    ],
  },
  {
    id: 'altitude-health',
    title: 'Altitude, health & temperature stress',
    intro:
      'Langza (~4,400 m) and Kaza (~3,650 m) mean thinner air plus cold. Even fit travellers can feel unwell.',
    points: [
      'Ascend gradually in spirit: avoid racing upstairs, heavy bags, or long walks on day one in Kaza/Langza.',
      'Drink water regularly; dry cold dehydrates you even if you do not feel thirsty.',
      'Limit alcohol on high-altitude nights — it worsens dehydration and cold risk.',
      'Carry personal medicines, a basic first-aid kit, ORS, pain relief, and any prescribed altitude/cold meds from your doctor.',
      'If severe headache, vomiting, breathlessness at rest, or confusion appears, descend to a lower overnight (e.g. toward Kalpa) and seek medical help — do not tough it out for sightseeing.',
      'Eat warm meals; skipping food in extreme cold reduces energy for staying warm.',
      'On Langza overnight: confirm heating, hot water, bedding and food before committing; skip if the homestay cannot support winter overnight.',
    ],
  },
  {
    id: 'travel-driving',
    title: 'Travel, driving & night movement',
    intro: 'Most serious trip risk sits on the long private-cab mountain legs and the Kufri → Delhi airport connection.',
    points: [
      'Use an experienced local winter driver with winter tyres / chains available for mountain legs.',
      'Start Kalpa ↔ Kaza style drives early; build large time buffers and never schedule tight same-day flights after a long mountain transfer.',
      'Treat Kufri → Delhi airport on 3 Jan as high risk; prefer a Delhi overnight on 2 Jan if the group can rearrange.',
      'Keep passport/Aadhaar, tickets and boarding passes photocopied or offline on phone plus one paper copy in another bag.',
      'Agree a meeting point and time if anyone separates in markets (Kaza, Shimla Mall Road).',
      'After New Year’s Eve, leave Kaza only when everyone is rested and the driver confirms road conditions.',
      'Share live location within the trusted trip group during long drives when network allows.',
    ],
  },
  {
    id: 'women-safety',
    title: 'Women travellers & personal safety',
    intro:
      'The group travels together, but add extra personal-safety habits for women travellers in transit hubs, overnight buses, and village stays.',
    points: [
      'Buddy system: women travellers should not walk alone at night in Delhi, Shimla, Kaza markets or between rooms/vehicles — go in pairs or with the group.',
      'On overnight train/bus: keep valuables and ID in a body pouch or bag that stays on you while sleeping; use the group’s agreed seat/berth cluster.',
      'Prefer well-lit, staffed areas at stations and bus stands; wait together for pickups rather than accepting unknown offers of “taxi help”.',
      'At homestays/hotels, note room lock, bathroom location, and emergency exit; request rooms near other group members when possible.',
      'Dress in warm, modest, practical layers suitable for conservative mountain towns; carry a scarf/shawl for wind and comfort.',
      'Keep a charged phone, whistle/alarm (optional), and emergency cash in an inner pocket; share your day’s plan with at least one group member.',
      'If anyone feels unsafe with a driver, stay, or crowd: say so early, stick with the group, and move to a public staffed place (hotel lobby, restaurant).',
      'Sanitary products: pack more than needed — village shops may be closed or limited in deep winter; carry personal medication for periods/pain.',
      'Use hotel/homestay bathrooms when possible; avoid isolated dark outdoor spots after dusk.',
    ],
  },
  {
    id: 'nye-group',
    title: 'New Year’s Eve & group discipline',
    intro: '31 Dec in Kaza is cold, dark and logistically tight. Celebration should not override safety.',
    points: [
      'Book NYE stay and any event separately in advance; do not assume a public party is available.',
      'Limit alcohol; cold + altitude + late night increases accident and hypothermia risk.',
      'Return to the hotel together; no solo walks back in freezing dark streets.',
      'Keep warm layers on even indoors at events if heating is weak.',
      'Confirm next-morning departure plan before sleeping; 1 Jan is a long return corridor day.',
    ],
  },
];

/** Must-carry packing list for Spiti winter (tickable on Safety page). */
export const mustCarryGroups: MustCarryGroup[] = [
  {
    id: 'clothing',
    title: 'Clothing (must have)',
    items: [
      'Thermal base layers (top + bottom) — at least 2 sets',
      'Fleece / wool mid-layer',
      'Windproof + preferably down or heavy padded jacket',
      'Warm trousers (avoid thin jeans as only outer layer in Spiti)',
      'Wool or thermal socks (several pairs) + spare socks in daypack',
      'Insulated waterproof gloves + thin inner gloves',
      'Warm cap / beanie that covers ears + neck warmer or muffler',
      'Waterproof or heavily insulated shoes with good grip (broken-in)',
      'Sunglasses (snow glare) and optional balaclava/face cover for wind',
    ],
  },
  {
    id: 'health',
    title: 'Health & personal care',
    items: [
      'Personal prescription medicines + copy of prescriptions',
      'Basic first-aid: bandages, antiseptic, pain relief, antacid, ORS, anti-allergy',
      'Lip balm, heavy moisturiser, sunscreen (SPF), petroleum jelly for windburn',
      'Sanitary products (extra), wet wipes, hand sanitiser, toilet paper roll',
      'Any doctor-advised altitude / motion-sickness medication',
      'Reusable water bottle (fill with warm water when possible)',
    ],
  },
  {
    id: 'electronics-docs',
    title: 'Electronics, documents & money',
    items: [
      'Phone + power bank (20,000 mAh ideal) + charging cables',
      'Offline maps / saved contacts; paper list of hotels + driver + emergency numbers',
      'Aadhaar / passport + ticket printouts or offline PDFs; one set stored separately',
      'Enough cash (ATMs unreliable in Spiti winter) + one card as backup',
      'Torch / phone flashlight; optional headlamp for Langza night walks',
      'Universal adaptor if needed; keep electronics in inner pockets in extreme cold',
    ],
  },
  {
    id: 'daypack',
    title: 'Daypack for drives & day walks',
    items: [
      'Water + dry snacks (nuts, energy bars) for long road days',
      'Spare socks, gloves, and one warm layer in the car bag',
      'Small towel / handkerchief; plastic bags for wet clothes',
      'ID + some cash in a zip pocket while sightseeing',
      'Group medicine pouch for shared basics',
    ],
  },
];

/** Flat checklist used by store, PDF and tick UI (all detailed points + must-carry lines). */
export const safetyChecklist: string[] = [
  ...safetyCategories.flatMap((category) => category.points),
  ...mustCarryGroups.flatMap((group) => group.items.map((item) => `${group.title}: ${item}`)),
];

export const tripMeta: TripMeta = {
  brand: 'Spiti Tour 2026',
  title: 'Spiti Tour 2026',
  dates: '23 Dec 2026 — 03 Jan 2027',
  train: '22917 BDTS–NZM SF Express · 23 Dec 12:45 PM BDTS → 24 Dec 08:35 AM NZM',
  privateTransfer:
    'Delhi → Shimla private cab 24 Dec (~3 PM); winter cab Shimla → Chitkul → Kalpa → Tabo halt → Langza loop → return Kalpa → Kufri/Shimla → Delhi airport',
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
