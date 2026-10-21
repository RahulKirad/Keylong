import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TripPlannerPage from './TripPlannerPage';
import ExpensesPage from './ExpensesPage';
import AssignmentsPage from './AssignmentsPage';
import NavigationBridge from './NavigationBridge';

export default function App() {
  return (
    <BrowserRouter>
      <NavigationBridge />
      <Routes>
        <Route path="/" element={<TripPlannerPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
