import React from 'react';
import { Link } from 'react-router-dom';
import { BedDouble } from 'lucide-react';
import type { StayNight } from './tripData';

const fmtStayType = (t?: string) => {
  if (!t) return '—';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

type Props = {
  stays: StayNight[];
};

export default function HaltsStaysSection({ stays }: Props) {
  return (
    <section id="halts-stays" className="section halts-stays-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">OVERNIGHT PLAN</div>
          <h2>Halts &amp; stays</h2>
          <p>
            Final route accommodation — dates, check-in and check-out targets. <b>Tabo</b> is your planned halt on
            29 Dec. Add property names in <Link to="/trip-tables">Trip tables</Link> as you book.
          </p>
        </div>
      </div>
      <div className="halts-stays-table-wrap">
        <table className="halts-stays-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Stay location</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Nights</th>
              <th>Type</th>
              <th>Property name</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {stays.map((s) => (
              <tr key={s.id} className={s.location.toLowerCase().includes('tabo') ? 'halt-tabo-row' : ''}>
                <td>{s.dateLabel || s.night}</td>
                <td>{s.tripDay > 0 ? `Day ${s.tripDay}` : '—'}</td>
                <td>
                  <strong>{s.location}</strong>
                </td>
                <td>{s.checkIn || '—'}</td>
                <td>{s.checkOut || '—'}</td>
                <td>{s.nights}</td>
                <td>{fmtStayType(s.stayType)}</td>
                <td>{s.stayName?.trim() ? s.stayName : <span className="muted">Add in Trip tables</span>}</td>
                <td className="halts-priority">{s.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="halts-stays-foot">
        <BedDouble size={14} /> Transit nights (train) and flight night are listed for timing — not hotel bookings.
      </p>
    </section>
  );
}
