import React from 'react';
import { Search, X } from 'lucide-react';

export type FilterOption = { value: string; label: string };

export type FilterField = {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterField[];
  resultCount?: number;
  resultLabel?: string;
  onClear?: () => void;
};

export default function ListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  resultCount,
  resultLabel = 'results',
  onClear,
}: Props) {
  const hasActive =
    Boolean(search.trim()) || filters.some((f) => f.value && f.value !== 'all');

  return (
    <div className="list-filter-bar">
      <label className="list-filter-search">
        <Search size={15} aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
        {search && (
          <button
            type="button"
            className="list-filter-clear-input"
            aria-label="Clear search"
            onClick={() => onSearchChange('')}
          >
            <X size={14} />
          </button>
        )}
      </label>
      <div className="list-filter-selects">
        {filters.map((f) => (
          <label key={f.id} className="list-filter-field">
            <span>{f.label}</span>
            <select value={f.value} onChange={(e) => f.onChange(e.target.value)}>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="list-filter-meta">
        {typeof resultCount === 'number' && (
          <span>
            {resultCount} {resultLabel}
          </span>
        )}
        {hasActive && onClear && (
          <button type="button" className="list-filter-reset" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
