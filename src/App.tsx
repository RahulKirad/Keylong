import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TripPlannerPage from './TripPlannerPage';
import ExpensesPage from './ExpensesPage';
import AssignmentsPage from './AssignmentsPage';
import IdProofPage from './IdProofPage';
import TemperaturePage from './TemperaturePage';
import TripTablesPage from './TripTablesPage';
import NavigationBridge from './NavigationBridge';
import UnlockScreen from './UnlockScreen';
import { isAppUnlocked } from './tripUnlock';

export default function App() {
  const [unlocked, setUnlocked] = useState(() => isAppUnlocked());

  useEffect(() => {
    const open = () => setUnlocked(true);
    const close = () => setUnlocked(false);
    window.addEventListener('app-unlocked', open);
    window.addEventListener('app-locked', close);
    return () => {
      window.removeEventListener('app-unlocked', open);
      window.removeEventListener('app-locked', close);
    };
  }, []);

  if (!unlocked) {
    return <UnlockScreen onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <BrowserRouter>
      <NavigationBridge />
      <Routes>
        <Route path="/" element={<TripPlannerPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/id-proof" element={<IdProofPage />} />
        <Route path="/temperature" element={<TemperaturePage />} />
        <Route path="/trip-tables" element={<TripTablesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
