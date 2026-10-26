import React, { useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ExpenseRecord } from './expenseStore';
import { expenseCountsInTotal } from './expenseStore';

const DELETE_WIDTH = 88;
const SWIPE_THRESHOLD = 48;

type Props = {
  expense: ExpenseRecord;
  amountLabel: string;
  metaLine?: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleCountInTotal?: (checked: boolean) => void;
};

export default function ExpenseSwipeRow({
  expense,
  amountLabel,
  metaLine,
  onEdit,
  onDelete,
  onToggleCountInTotal,
}: Props) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  function onTouchStart(ev: React.TouchEvent) {
    startX.current = ev.touches[0].clientX;
    dragging.current = true;
  }

  function onTouchMove(ev: React.TouchEvent) {
    if (!dragging.current) return;
    const dx = ev.touches[0].clientX - startX.current;
    if (dx < 0) setOffset(Math.min(DELETE_WIDTH, -dx));
    else setOffset(Math.max(0, DELETE_WIDTH + dx));
  }

  function onTouchEnd() {
    dragging.current = false;
    setOffset(offset >= SWIPE_THRESHOLD ? DELETE_WIDTH : 0);
  }

  function onDeleteTap() {
    setOffset(0);
    onDelete();
  }

  return (
    <div className="expense-swipe-wrap">
      <button type="button" className="expense-swipe-delete" onClick={onDeleteTap} aria-label="Delete expense">
        <Trash2 size={18} />
        Delete
      </button>
      <div
        className="expense-swipe-content"
        style={{ transform: `translateX(-${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="expense-swipe-main">
          <div className="expense-swipe-top">
            <span className="expense-swipe-date">{expense.dateLabel}</span>
            <span className="expense-swipe-amt">{amountLabel}</span>
          </div>
          <div className="expense-swipe-desc">{expense.description}</div>
          <div className="expense-swipe-meta">
            {expense.category} · Paid by <strong>{expense.paidByName}</strong>
            {metaLine ? ` · ${metaLine}` : ''}
          </div>
          {onToggleCountInTotal && (
            <label className="expense-total-check expense-swipe-total-check">
              <input
                type="checkbox"
                checked={expenseCountsInTotal(expense)}
                onChange={(event) => onToggleCountInTotal(event.target.checked)}
              />
              <span>Add to total</span>
            </label>
          )}
        </div>
        <div className="expense-swipe-actions">
          <button type="button" aria-label="Edit" onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <button type="button" className="expense-delete-btn" aria-label="Delete" onClick={onDeleteTap}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
