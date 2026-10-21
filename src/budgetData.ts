export type BudgetLine = {
  id: string;
  label: string;
  qty: number;
  unitCost: number;
  hint?: string;
};

export type BudgetCategory = {
  id: string;
  title: string;
  subtitle: string;
  lines: BudgetLine[];
};

export const BUDGET_STORAGE_KEY = 'winter-himachal-budget-v1';

export const defaultBudgetCategories: BudgetCategory[] = [
  {
    id: 'rail',
    title: 'Train · Mumbai ↔ Delhi',
    subtitle: 'BDTS–NZM and station transfers',
    lines: [
      { id: 'rail-1', label: '22917 BDTS → NZM tickets', qty: 1, unitCost: 0, hint: 'Per person or total — set qty × fare' },
      { id: 'rail-2', label: 'Return / onward rail (if any)', qty: 0, unitCost: 0 },
      { id: 'rail-3', label: 'Local travel to / from station', qty: 1, unitCost: 0 },
      { id: 'rail-4', label: 'Meals on train', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'road',
    title: 'Private road transfer',
    subtitle: 'Delhi ↔ Lahaul · Parvati · Delhi',
    lines: [
      { id: 'road-1', label: 'Delhi → Sissu (24 Dec evening)', qty: 1, unitCost: 0, hint: 'Lump sum or per vehicle' },
      { id: 'road-2', label: 'In-valley legs (Sissu · Keylong · Jispa)', qty: 1, unitCost: 0 },
      { id: 'road-3', label: 'Jispa → Kasol corridor', qty: 1, unitCost: 0 },
      { id: 'road-4', label: 'Kasol → Delhi (2 Jan)', qty: 1, unitCost: 0 },
      { id: 'road-5', label: 'Driver tips & tolls / parking', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'flight',
    title: 'Flight · Delhi → Pune',
    subtitle: 'SpiceJet SG105 · 3 Jan 2027',
    lines: [
      { id: 'flt-1', label: 'SG105 airfare', qty: 1, unitCost: 0, hint: 'Tickets × fare' },
      { id: 'flt-2', label: 'Seat / baggage add-ons', qty: 1, unitCost: 0 },
      { id: 'flt-3', label: 'Airport transfer (Delhi / Pune)', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'stay',
    title: 'Accommodation',
    subtitle: 'Nights × rate — adjust qty to nights',
    lines: [
      { id: 'stay-1', label: 'On train (23 Dec)', qty: 1, unitCost: 0 },
      { id: 'stay-2', label: 'Sissu (25–26 Dec)', qty: 2, unitCost: 0 },
      { id: 'stay-3', label: 'Keylong (27 Dec)', qty: 1, unitCost: 0 },
      { id: 'stay-4', label: 'Jispa (28–29 Dec)', qty: 2, unitCost: 0 },
      { id: 'stay-5', label: 'Kasol / Parvati (30 Dec – 2 Jan)', qty: 4, unitCost: 0, hint: 'Include NYE premium if booked' },
      { id: 'stay-6', label: 'Delhi overnight (2 Jan)', qty: 1, unitCost: 0 },
      { id: 'stay-7', label: 'Chalal extra night (if booked)', qty: 0, unitCost: 0 },
    ],
  },
  {
    id: 'food',
    title: 'Food & cafés',
    subtitle: 'Daily meals, snacks, New Year',
    lines: [
      { id: 'food-1', label: 'Delhi stopover meals (24 Dec)', qty: 1, unitCost: 0 },
      { id: 'food-2', label: 'Mountain days — breakfast / lunch / dinner', qty: 12, unitCost: 0, hint: 'Qty = days or meals; unit = ₹ per day' },
      { id: 'food-3', label: 'Cafés & treats (Kasol / villages)', qty: 1, unitCost: 0 },
      { id: 'food-4', label: 'New Year’s Eve dinner / party', qty: 1, unitCost: 0 },
      { id: 'food-5', label: 'Water, tea, trail snacks', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'activities',
    title: 'Activities & excursions',
    subtitle: 'Optional — only if you do them',
    lines: [
      { id: 'act-1', label: 'Paragliding / adventure (Sissu)', qty: 0, unitCost: 0 },
      { id: 'act-2', label: 'Malana or Manikaran day trip', qty: 1, unitCost: 0 },
      { id: 'act-3', label: 'Chalal walk — guide / café', qty: 1, unitCost: 0 },
      { id: 'act-4', label: 'Manikaran hot springs / donations', qty: 1, unitCost: 0 },
      { id: 'act-5', label: 'Other tours or entries', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'essentials',
    title: 'Essentials & gear',
    subtitle: 'Winter necessities and supplies',
    lines: [
      { id: 'ess-1', label: 'Warm layers, gloves, thermals', qty: 1, unitCost: 0 },
      { id: 'ess-2', label: 'Waterproof boots / traction aids', qty: 1, unitCost: 0 },
      { id: 'ess-3', label: 'Medicines & first aid', qty: 1, unitCost: 0 },
      { id: 'ess-4', label: 'Power bank, cables, SIM / data', qty: 1, unitCost: 0 },
      { id: 'ess-5', label: 'Sunscreen, lip balm, toiletries', qty: 1, unitCost: 0 },
      { id: 'ess-6', label: 'Souvenirs & shopping', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'misc',
    title: 'Insurance · fees · buffer',
    subtitle: 'Contingency and fixed costs',
    lines: [
      { id: 'misc-1', label: 'Travel insurance', qty: 1, unitCost: 0 },
      { id: 'misc-2', label: 'Permits / fees (if any)', qty: 1, unitCost: 0 },
      { id: 'misc-3', label: 'ATM / forex / card charges', qty: 1, unitCost: 0 },
      { id: 'misc-4', label: 'Emergency buffer (recommended 10%)', qty: 1, unitCost: 0, hint: 'Or use trip target below' },
    ],
  },
];

export function lineTotal(line: BudgetLine): number {
  const q = Number.isFinite(line.qty) ? line.qty : 0;
  const u = Number.isFinite(line.unitCost) ? line.unitCost : 0;
  return Math.max(0, q * u);
}

export function categoryTotal(cat: BudgetCategory): number {
  return cat.lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function grandTotal(categories: BudgetCategory[]): number {
  return categories.reduce((sum, c) => sum + categoryTotal(c), 0);
}

export function newLineId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
