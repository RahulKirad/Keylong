import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Mountain } from 'lucide-react';
import ItineraryTables from './ItineraryTables';
import TripAssistant from './TripAssistant';
import SyncStatusBadge from './SyncStatusBadge';
import NavCalculatorButton from './NavCalculatorButton';

const TRIP_TITLE = 'Spiti Tour 2026 | Interactive Journey';

export default function TripTablesPage() {
  useEffect(() => {
    document.title = 'Spiti Tour 2026 — Trip tables';
    return () => {
      document.title = TRIP_TITLE;
    };
  }, []);

  return (
    <div className="app expenses-app trip-tables-app">
      <header className="site-nav expenses-page-nav">
        <div className="site-nav-row site-nav-brand-row">
          <Link to="/" className="nav-brand">
            <span className="brand-logo">
              <Mountain />
            </span>
            <span>
              <strong>SPITI</strong>
              <span className="brand-sub">TOUR 2026</span>
            </span>
          </Link>
          <div className="expenses-page-title">
            <CalendarDays size={16} />
            Editable trip tables
          </div>
          <NavCalculatorButton />
        </div>
        <div className="site-nav-row expenses-page-subnav trip-tables-subnav">
          <Link to="/" className="expenses-back-link">
            <ArrowLeft size={15} /> Back to trip planner
          </Link>
          <SyncStatusBadge />
        </div>
      </header>
      <main className="main expenses-page-main trip-tables-main">
        <ItineraryTables standalone />
        <footer className="footer">
          SPITI TOUR TABLES <span>·</span> EDIT PLACES, STAYS, SCHEDULE & TRANSPORT <span>·</span> TAP UPDATE TRIP TO
          SYNC MAP · PDF · CHAT
        </footer>
      </main>
      <div id="assistant">
        <TripAssistant />
      </div>
    </div>
  );
}
