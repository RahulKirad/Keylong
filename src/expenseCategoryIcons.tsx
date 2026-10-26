import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  Bus,
  CircleDollarSign,
  MountainSnow,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';

export type ExpenseCategoryMeta = {
  key: string;
  label: string;
  Icon: LucideIcon;
  tone: string;
};

const CATEGORY_META: ExpenseCategoryMeta[] = [
  { key: 'food', label: 'Food', Icon: UtensilsCrossed, tone: 'food' },
  { key: 'stay', label: 'Stay', Icon: BedDouble, tone: 'stay' },
  { key: 'transport', label: 'Transport', Icon: Bus, tone: 'transport' },
  { key: 'activity', label: 'Activity', Icon: MountainSnow, tone: 'activity' },
  { key: 'shopping', label: 'Shopping', Icon: ShoppingBag, tone: 'shopping' },
  { key: 'other', label: 'Other', Icon: CircleDollarSign, tone: 'other' },
];

function normalizeCategory(category: string): string {
  const raw = (category || 'Other').trim().toLowerCase();
  if (/food|meal|dinner|lunch|breakfast|cafe|restaurant|snack/.test(raw)) return 'food';
  if (/stay|hotel|homestay|lodge|camp|room/.test(raw)) return 'stay';
  if (/transport|travel|cab|taxi|bus|train|flight|fuel|petrol|diesel|parking/.test(raw)) {
    return 'transport';
  }
  if (/activit|trek|hike|permit|entry|ticket|sight/.test(raw)) return 'activity';
  if (/shop|market|gear|clothes|souvenir/.test(raw)) return 'shopping';
  const exact = CATEGORY_META.find((m) => m.key === raw);
  return exact?.key || 'other';
}

export function getExpenseCategoryMeta(category: string): ExpenseCategoryMeta {
  const key = normalizeCategory(category);
  return CATEGORY_META.find((m) => m.key === key) || CATEGORY_META[CATEGORY_META.length - 1];
}

type IconProps = {
  category: string;
  size?: number;
  className?: string;
};

/** Coloured glyph for Food / Stay / Transport / Activity / Shopping / Other. */
export function ExpenseCategoryIcon({ category, size = 16, className = '' }: IconProps) {
  const meta = getExpenseCategoryMeta(category);
  const Icon = meta.Icon;
  return (
    <span
      className={`expense-cat-icon expense-cat-icon-${meta.tone}${className ? ` ${className}` : ''}`}
      title={meta.label}
      aria-hidden
    >
      <Icon size={size} strokeWidth={2.1} />
    </span>
  );
}
