import React, { useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  addScheduleRow,
  getDays,
  getStayNights,
  getTransportSegments,
  getTripPhases,
  removeScheduleRow,
  resetItineraryToDefaults,
  subscribeItinerary,
  updateScheduleRow,
  updateStayNight,
  updateTransportSegment,
  type ItineraryState,
} from './itineraryStore';

type Snapshot = Pick<
  ItineraryState,
  'days' | 'tripPhases' | 'transportSegments' | 'stayNights'
>;

function readSnapshot(): Snapshot {
  return {
    days: getDays(),
    tripPhases: getTripPhases(),
    transportSegments: getTransportSegments(),
    stayNights: getStayNights(),
  };
}

function EditableCell({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  return (
    <textarea
      className="planner-cell"
      aria-label={ariaLabel}
      rows={2}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export default function ItineraryTables() {
  const [data, setData] = useState<Snapshot>(() => readSnapshot());

  useEffect(() => subscribeItinerary(() => setData(readSnapshot())), []);

  return (
    <section className="section planner-section" id="planner">
      <div className="section-head">
        <div>
          <div className="eyebrow">LIVE PLANNER</div>
          <h2>Editable trip tables</h2>
          <p>
            Change times, routes, travel modes, notes and stays here. Updates apply across the
            itinerary, map days, PDF pack and chatbot.
          </p>
        </div>
        <button
          type="button"
          className="button pale"
          onClick={() => {
            if (window.confirm('Reset all trip tables to the Spiti Tour 2026 defaults?')) {
              resetItineraryToDefaults();
            }
          }}
        >
          <RotateCcw size={14} /> Reset tables
        </button>
      </div>

      {data.tripPhases.map((phase) => {
        const phaseDays = data.days.filter((day) => day.phaseId === phase.id);
        return (
          <div key={phase.id} className="planner-phase">
            <div className="planner-phase-head">
              <h3>
                Phase {phase.number} — {phase.title}
              </h3>
              {phase.note ? <p className="planner-phase-note">{phase.note}</p> : null}
            </div>

            {phaseDays.map((day) => (
              <div key={day.day} className="planner-day-block">
                <div className="planner-day-head">
                  <strong>
                    Day {day.day} · {day.date}
                  </strong>
                  <span>{day.title}</span>
                  <button
                    type="button"
                    className="button pale planner-add-row"
                    onClick={() => addScheduleRow(day.day)}
                  >
                    <Plus size={14} /> Add row
                  </button>
                </div>

                <div className="planner-table-wrap">
                  <table className="planner-table">
                    <thead>
                      <tr>
                        <th>Date &amp; time</th>
                        <th>Activity / route</th>
                        <th>Mode of travel</th>
                        <th>Duration / notes</th>
                        <th>Overnight stay</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {day.scheduleRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <EditableCell
                              ariaLabel="Date and time"
                              value={row.when}
                              onChange={(when) => updateScheduleRow(day.day, row.id, { when })}
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Activity or route"
                              value={row.activity}
                              onChange={(activity) =>
                                updateScheduleRow(day.day, row.id, { activity })
                              }
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Mode of travel"
                              value={row.mode}
                              onChange={(mode) => updateScheduleRow(day.day, row.id, { mode })}
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Duration or notes"
                              value={row.notes}
                              onChange={(notes) => updateScheduleRow(day.day, row.id, { notes })}
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Overnight stay"
                              value={row.overnight}
                              onChange={(overnight) =>
                                updateScheduleRow(day.day, row.id, { overnight })
                              }
                            />
                          </td>
                          <td className="planner-row-actions">
                            <button
                              type="button"
                              className="expense-action-delete"
                              aria-label="Remove row"
                              disabled={day.scheduleRows.length <= 1}
                              onClick={() => removeScheduleRow(day.day, row.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="planner-phase">
        <div className="planner-phase-head">
          <h3>Transport and booking summary</h3>
        </div>
        <div className="planner-table-wrap">
          <table className="planner-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Recommended travel mode</th>
                <th>What to book</th>
              </tr>
            </thead>
            <tbody>
              {data.transportSegments.map((segment) => (
                <tr key={segment.id}>
                  <td>
                    <EditableCell
                      ariaLabel="Segment"
                      value={segment.segment}
                      onChange={(next) => updateTransportSegment(segment.id, { segment: next })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Travel mode"
                      value={segment.mode}
                      onChange={(mode) => updateTransportSegment(segment.id, { mode })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="What to book"
                      value={segment.book}
                      onChange={(book) => updateTransportSegment(segment.id, { book })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="planner-phase">
        <div className="planner-phase-head">
          <h3>Overnight accommodation checklist</h3>
        </div>
        <div className="planner-table-wrap">
          <table className="planner-table">
            <thead>
              <tr>
                <th>Night</th>
                <th>Location</th>
                <th>Nights</th>
                <th>Booking priority</th>
              </tr>
            </thead>
            <tbody>
              {data.stayNights.map((stay) => (
                <tr key={stay.id}>
                  <td>
                    <EditableCell
                      ariaLabel="Night"
                      value={stay.night}
                      onChange={(night) => updateStayNight(stay.id, { night })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Location"
                      value={stay.location}
                      onChange={(location) => updateStayNight(stay.id, { location })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Nights"
                      value={stay.nights}
                      onChange={(nights) => updateStayNight(stay.id, { nights })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Booking priority"
                      value={stay.priority}
                      onChange={(priority) => updateStayNight(stay.id, { priority })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
