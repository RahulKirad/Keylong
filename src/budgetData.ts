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
    title: 'Private road / bus transfer',
    subtitle: 'Delhi → Shimla · Spiti loop · Kufri → Delhi',
    lines: [
      { id: 'road-1', label: 'Delhi → Shimla overnight bus (24 Dec)', qty: 1, unitCost: 0, hint: 'Lump sum or per seat' },
      { id: 'road-2', label: 'Shimla → Sangla → Kalpa cab', qty: 1, unitCost: 0 },
      { id: 'road-3', label: 'Kalpa ↔ Kaza winter cab', qty: 1, unitCost: 0 },
      { id: 'road-4', label: 'Kaza ↔ Langza local cab', qty: 1, unitCost: 0 },
      { id: 'road-5', label: 'Kalpa → Kufri → Delhi airport', qty: 1, unitCost: 0 },
      { id: 'road-6', label: 'Driver tips & tolls / parking', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'flight',
    title: 'Flight · Delhi → Pune',
    subtitle: 'Air India AI9825 · DEL 22:10 → PNQ 00:30+1',
    lines: [
      { id: 'flt-1', label: 'AI9825 airfare (reference ~₹8,316)', qty: 1, unitCost: 8316, hint: '1 traveller · Economy · one way' },
      { id: 'flt-2', label: 'Seat / baggage add-ons', qty: 1, unitCost: 0 },
      { id: 'flt-3', label: 'Airport buffer extras', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'stay',
    title: 'Accommodation',
    subtitle: 'Nights × rate — adjust qty to nights',
    lines: [
      { id: 'stay-1', label: 'Train night (23 Dec)', qty: 1, unitCost: 0 },
      { id: 'stay-2', label: 'Shimla (24–25 Dec)', qty: 2, unitCost: 0 },
      { id: 'stay-3', label: 'Chitkul (26 Dec)', qty: 1, unitCost: 0 },
      { id: 'stay-4', label: 'Kalpa (27–28 Dec + 1 Jan)', qty: 3, unitCost: 0 },
      { id: 'stay-5', label: 'Tabo halt (29 Dec)', qty: 1, unitCost: 0, hint: 'Book Tabo monastery village stay' },
      { id: 'stay-6', label: 'Langza (30–31 Dec)', qty: 2, unitCost: 0 },
      { id: 'stay-7', label: 'Kufri or Shimla (2 Jan TBD)', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'food',
    title: 'Food & cafés',
    subtitle: 'Daily meals, snacks, New Year',
    lines: [
      { id: 'food-1', label: 'Delhi stopover meals (24 Dec)', qty: 1, unitCost: 0 },
      { id: 'food-2', label: 'Mountain days — breakfast / lunch / dinner', qty: 12, unitCost: 0, hint: 'Qty = days or meals; unit = ₹ per day' },
      { id: 'food-3', label: 'Cafés & treats (Shimla / Kaza / villages)', qty: 1, unitCost: 0 },
      { id: 'food-4', label: 'New Year’s Eve dinner / party', qty: 1, unitCost: 0 },
      { id: 'food-5', label: 'Water, tea, trail snacks', qty: 1, unitCost: 0 },
    ],
  },
  {
    id: 'activities',
    title: 'Activities & excursions',
    subtitle: 'Optional — only if you do them',
    lines: [
      { id: 'act-1', label: 'Chitkul optional excursion', qty: 0, unitCost: 0 },
      { id: 'act-2', label: 'Langza / village walks', qty: 1, unitCost: 0 },
      { id: 'act-3', label: 'Kaza market / viewpoints', qty: 1, unitCost: 0 },
      { id: 'act-4', label: 'Shimla Mall Road cafés', qty: 1, unitCost: 0 },
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
