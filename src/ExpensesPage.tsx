import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mountain, Wallet } from 'lucide-react';
import ExpensesSection from './ExpensesSection';
import TripAssistant from './TripAssistant';
import SyncStatusBadge from './SyncStatusBadge';

const TRIP_TITLE = 'Winter Himachal | Interactive Journey';

export default function ExpensesPage() {
  useEffect(() => {
    document.title = 'Winter Himachal Expenses';
    return () => {
      document.title = TRIP_TITLE;
    };
  }, []);

  return (
    <div className="app expenses-app">
      <header className="site-nav expenses-page-nav">
        <div className="site-nav-row site-nav-brand-row">
          <Link to="/" className="nav-brand">
            <span className="brand-logo">
              <Mountain />
            </span>
            <span>
              <strong>WINTER</strong>
              <span className="brand-sub">HIMACHAL</span>
            </span>
          </Link>
          <div className="expenses-page-title">
            <Wallet size={16} />
            Winter Himachal Expenses
          </div>
        </div>
        <div className="site-nav-row expenses-page-subnav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="expenses-back-link">
            <ArrowLeft size={15} /> Back to trip planner
          </Link>
          <SyncStatusBadge />
        </div>
      </header>
      <main className="main expenses-page-main">
        <ExpensesSection standalone />
        <footer className="footer">
          WINTER HIMACHAL EXPENSES <span>·</span> UNIVERSAL CLOUD DATABASE <span>·</span> REAL-TIME MULTI-DEVICE SYNC
        </footer>
      </main>
      <div id="assistant">
        <TripAssistant />
      </div>
    </div>
  );
}
