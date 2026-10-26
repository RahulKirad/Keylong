import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  label?: string;
  onChange: (page: number) => void;
};

export function pageSlice<T>(items: T[], page: number, pageSize: number): { slice: T[]; safePage: number; pageCount: number; start: number; end: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = items.length === 0 ? 0 : (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  const end = items.length === 0 ? 0 : start + slice.length;
  return { slice, safePage, pageCount, start, end };
}

/** Compact prev/next + page numbers for expense / settlement lists. */
export default function ListPager({ page, pageCount, total, pageSize, label = 'rows', onChange }: Props) {
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const maxButtons = 7;
  let from = Math.max(1, page - Math.floor(maxButtons / 2));
  let to = Math.min(pageCount, from + maxButtons - 1);
  from = Math.max(1, to - maxButtons + 1);
  const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <div className="expenses-pagination expense-section-pager" role="navigation" aria-label={`${label} pages`}>
      <span className="expenses-pagination-meta">
        {start}–{end} of {total}
        <span className="expenses-pagination-page">
          {' '}
          · Page {page} / {pageCount}
        </span>
      </span>
      <div className="expenses-pagination-controls">
        <button
          type="button"
          className="expenses-page-btn"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          <ChevronLeft size={16} /> Prev
        </button>
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            className={`expenses-page-num${n === page ? ' is-active' : ''}`}
            aria-label={`Page ${n}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="expenses-page-btn"
          disabled={page >= pageCount}
          aria-label="Next page"
          onClick={() => onChange(Math.min(pageCount, page + 1))}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
