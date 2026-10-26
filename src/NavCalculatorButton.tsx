import React from 'react';
import { Calculator } from 'lucide-react';
import { openSmartCalculator } from './calculatorBridge';

type Props = {
  /** Compact icon for brand row; full label for menu lists. */
  variant?: 'icon' | 'menu';
  onOpen?: () => void;
};

export default function NavCalculatorButton({ variant = 'icon', onOpen }: Props) {
  const open = () => {
    openSmartCalculator();
    onOpen?.();
  };

  if (variant === 'menu') {
    return (
      <button type="button" className="nav-calc-menu-btn" onClick={open}>
        <Calculator size={15} /> Smart calculator
      </button>
    );
  }

  return (
    <button
      type="button"
      className="nav-calc-btn"
      aria-label="Smart calculator"
      title="Smart calculator"
      onClick={open}
    >
      <Calculator size={16} />
      <span className="nav-calc-btn-label">Calc</span>
    </button>
  );
}
