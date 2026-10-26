import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, X, Sparkles, Delete, Equal, CornerDownLeft } from 'lucide-react';
import { registerSmartCalculatorOpener } from './calculatorBridge';
import { loadGeminiConfig } from './geminiConfig';
import { buildCalcSuggestions, tryEvalMathExpression } from './smartCalculatorContext';
import { runSmartCalculation } from './smartCalculatorAi';
import { subscribeExpenses, getExpenseState } from './expenseStore';

type HistoryItem = {
  id: string;
  query: string;
  answer: string;
  suggestions?: string[];
  source: string;
};

const KEYS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '00', '.', '='],
] as const;

export default function SmartCalculator() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'smart' | 'keypad'>('smart');
  const [expr, setExpr] = useState('');
  const [smartQuery, setSmartQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expenseTick, setExpenseTick] = useState(0);

  useEffect(() => {
    registerSmartCalculatorOpener(() => setOpen(true));
    return () => registerSmartCalculatorOpener(null);
  }, []);

  useEffect(() => subscribeExpenses(() => setExpenseTick((n) => n + 1)), []);

  const suggestions = useMemo(() => {
    void expenseTick;
    return buildCalcSuggestions();
  }, [expenseTick]);

  const memberCount = getExpenseState().members.length;

  function pushHistory(item: Omit<HistoryItem, 'id'>) {
    setHistory((prev) => [{ id: `c-${Date.now()}`, ...item }, ...prev].slice(0, 8));
  }

  function applyKey(key: string) {
    setError(null);
    if (key === 'C') {
      setExpr('');
      return;
    }
    if (key === '⌫') {
      setExpr((e) => e.slice(0, -1));
      return;
    }
    if (key === '=') {
      const result = tryEvalMathExpression(expr);
      if (result == null) {
        setError('Invalid expression');
        return;
      }
      const pretty = result.toLocaleString('en-IN', { maximumFractionDigits: 2 });
      pushHistory({
        query: expr,
        answer: `= ${pretty}`,
        source: 'keypad',
        suggestions: [
          `Divide ${pretty} by ${Math.max(1, memberCount)} travellers`,
          'Add this to what the group has spent',
        ],
      });
      setExpr(String(result));
      return;
    }
    const map: Record<string, string> = { '×': '*', '÷': '/', '−': '-' };
    setExpr((e) => e + (map[key] || key));
  }

  async function runSmart(prompt?: string) {
    const q = (prompt ?? smartQuery).trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runSmartCalculation(q, loadGeminiConfig(), navigator.onLine);
      pushHistory({
        query: q,
        answer: result.answer,
        suggestions: result.suggestions,
        source: result.source,
      });
      if (!prompt) setSmartQuery('');
      setMode('smart');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calculation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`smart-calc-fab${open ? ' is-open' : ''}`}
        aria-label="Open smart calculator"
        title="Smart calculator"
        onClick={() => setOpen(true)}
      >
        <Calculator size={22} />
      </button>

      {open && (
        <div className="smart-calc-backdrop" onClick={() => setOpen(false)}>
          <div
            className="smart-calc-panel"
            role="dialog"
            aria-label="Smart calculator"
            onClick={(ev) => ev.stopPropagation()}
          >
            <header className="smart-calc-header">
              <div className="smart-calc-title">
                <span className="smart-calc-icon">
                  <Sparkles size={16} />
                </span>
                <div>
                  <strong>Smart calculator</strong>
                  <span>Trip spending · splits · quick math</span>
                </div>
              </div>
              <button type="button" className="smart-calc-close" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="smart-calc-tabs">
              <button type="button" className={mode === 'smart' ? 'on' : ''} onClick={() => setMode('smart')}>
                <Sparkles size={14} /> AI smart
              </button>
              <button type="button" className={mode === 'keypad' ? 'on' : ''} onClick={() => setMode('keypad')}>
                <Calculator size={14} /> Keypad
              </button>
            </div>

            {mode === 'smart' ? (
              <div className="smart-calc-smart">
                <label className="smart-calc-input-wrap">
                  <span>Ask or type an expression</span>
                  <textarea
                    value={smartQuery}
                    onChange={(e) => setSmartQuery(e.target.value)}
                    rows={3}
                    placeholder="e.g. 17500 ÷ 7   or   How much does each person owe for Sanket’s dinner?"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        runSmart();
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="button dark smart-calc-run"
                  disabled={busy || !smartQuery.trim()}
                  onClick={() => runSmart()}
                >
                  {busy ? 'Calculating…' : (
                    <>
                      Calculate <CornerDownLeft size={14} />
                    </>
                  )}
                </button>

                <div className="smart-calc-chips">
                  <span className="smart-calc-chips-label">Suggestions from your trip spend</span>
                  <div className="smart-calc-chip-row">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="smart-calc-chip"
                        disabled={busy}
                        onClick={() => {
                          setSmartQuery(s.prompt);
                          runSmart(s.prompt);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="smart-calc-keypad">
                <div className="smart-calc-display" aria-live="polite">
                  {expr || '0'}
                </div>
                <div className="smart-calc-keys">
                  {KEYS.flat().map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`smart-calc-key${key === '=' ? ' is-eq' : ''}${
                        ['C', '⌫', '%', '÷', '×', '−', '+'].includes(key) ? ' is-op' : ''
                      }`}
                      onClick={() => applyKey(key)}
                    >
                      {key === '⌫' ? <Delete size={16} /> : key === '=' ? <Equal size={16} /> : key}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="button pale smart-calc-ask-ai"
                  disabled={!expr.trim() || busy}
                  onClick={() => {
                    setSmartQuery(`Explain and relate this result to our trip spending: ${expr}`);
                    setMode('smart');
                    runSmart(`Explain and relate this result to our trip spending: ${expr}`);
                  }}
                >
                  <Sparkles size={14} /> Ask AI about this number
                </button>
              </div>
            )}

            {error && <p className="smart-calc-error">{error}</p>}

            {history.length > 0 && (
              <div className="smart-calc-history">
                <h4>Results</h4>
                <ul>
                  {history.map((h) => (
                    <li key={h.id}>
                      <div className="smart-calc-q">{h.query}</div>
                      <div className="smart-calc-a">{h.answer}</div>
                      {h.suggestions && h.suggestions.length > 0 && (
                        <div className="smart-calc-follow">
                          {h.suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setMode('smart');
                                setSmartQuery(s);
                                runSmart(s);
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="smart-calc-src">{h.source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
