import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
  applyItineraryDraft,
  createHaltPlace,
  getItineraryState,
  resetItineraryToDefaults,
  subscribeItinerary,
  type ItineraryState,
} from './itineraryStore';
import type { Day, Place, ScheduleRow, StayNight, TransportSegment, TripPhase } from './tripData';
import ListFilterBar from './ListFilterBar';

function cloneState(): ItineraryState {
  return structuredClone(getItineraryState());
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

export default function ItineraryTables({ standalone = false }: { standalone?: boolean }) {
  const [draft, setDraft] = useState<ItineraryState>(() => cloneState());
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(
    () =>
      subscribeItinerary(() => {
        if (!dirty) setDraft(cloneState());
      }),
    [dirty],
  );

  const markDirty = (next: ItineraryState) => {
    setDraft(next);
    setDirty(true);
    setSavedFlash(false);
  };

  const patchDayRows = (dayNumber: number, updater: (rows: ScheduleRow[]) => ScheduleRow[]) => {
    markDirty({
      ...draft,
      days: draft.days.map((day) =>
        day.day === dayNumber ? { ...day, scheduleRows: updater(day.scheduleRows) } : day,
      ),
    });
  };

  const patchScheduleRow = (dayNumber: number, rowId: string, patch: Partial<ScheduleRow>) => {
    patchDayRows(dayNumber, (rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const addRow = (day: Day) => {
    const newRow: ScheduleRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      when: 'New time',
      activity: 'New activity',
      mode: 'Private cab',
      notes: '',
      overnight: '',
    };
    patchDayRows(day.day, (rows) => [...rows, newRow]);
  };

  const removeRow = (day: Day, rowId: string) => {
    if (day.scheduleRows.length <= 1) return;
    patchDayRows(day.day, (rows) => rows.filter((row) => row.id !== rowId));
  };

  const patchTransport = (id: string, patch: Partial<TransportSegment>) => {
    markDirty({
      ...draft,
      transportSegments: draft.transportSegments.map((segment) =>
        segment.id === id ? { ...segment, ...patch } : segment,
      ),
    });
  };

  const patchStay = (id: string, patch: Partial<StayNight>) => {
    markDirty({
      ...draft,
      stayNights: draft.stayNights.map((stay) => (stay.id === id ? { ...stay, ...patch } : stay)),
    });
  };

  const patchPhase = (id: string, patch: Partial<TripPhase>) => {
    markDirty({
      ...draft,
      tripPhases: draft.tripPhases.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)),
    });
  };

  const patchPlace = (id: string, patch: Partial<Place>) => {
    markDirty({
      ...draft,
      places: draft.places.map((place) => (place.id === id ? { ...place, ...patch } : place)),
    });
  };

  const patchDayMeta = (dayNumber: number, patch: Partial<Day>) => {
    markDirty({
      ...draft,
      days: draft.days.map((day) => (day.day === dayNumber ? { ...day, ...patch } : day)),
    });
  };

  const publish = () => {
    applyItineraryDraft(draft);
    setDirty(false);
    setSavedFlash(true);
    setDraft(cloneState());
    window.setTimeout(() => setSavedFlash(false), 2500);
  };

  const discard = () => {
    setDraft(cloneState());
    setDirty(false);
    setSavedFlash(false);
  };

  const dayCount = useMemo(() => draft.days.length, [draft.days.length]);
  const [tableSearch, setTableSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  const qTable = tableSearch.trim().toLowerCase();
  const visibleDays = useMemo(() => {
    return draft.days.filter((day) => {
      if (dayFilter !== 'all' && String(day.day) !== dayFilter) return false;
      if (!qTable) return true;
      const blob = [
        day.title,
        day.date,
        ...day.scheduleRows.flatMap((r) => [r.when, r.activity, r.mode, r.notes, r.overnight]),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(qTable);
    });
  }, [draft.days, dayFilter, qTable]);

  const visiblePlaces = useMemo(() => {
    if (!qTable) return draft.places;
    return draft.places.filter((p) =>
      `${p.name} ${p.region || ''} ${p.about || ''} ${p.stayName || ''}`.toLowerCase().includes(qTable),
    );
  }, [draft.places, qTable]);

  return (
    <section className={`section planner-section${standalone ? ' planner-section-standalone' : ''}`} id="planner">
      <div className="section-head">
        <div>
          <div className="eyebrow">LIVE PLANNER</div>
          <h2>{standalone ? 'Edit Spiti Tour tables' : 'Editable trip tables'}</h2>
          <p>
            Edit places, stay / hotel names, phase destinations and schedule rows, then tap <b>Update trip</b>. Changes
            sync to the home map, train &amp; flight cards, PDF pack and chatbot ({dayCount} days).
          </p>
        </div>
        <div className="planner-head-actions">
          <button
            type="button"
            className="button pale"
            onClick={() => {
              if (window.confirm('Reset all trip tables to the Spiti Tour 2026 defaults?')) {
                resetItineraryToDefaults();
                setDraft(cloneState());
                setDirty(false);
                setSavedFlash(true);
              }
            }}
          >
            <RotateCcw size={14} /> Reset tables
          </button>
          {(dirty || savedFlash) && (
            <button type="button" className="button dark planner-update-btn" onClick={publish} disabled={!dirty}>
              {savedFlash && !dirty ? <Check size={15} /> : <Save size={15} />}
              {savedFlash && !dirty ? 'Updated everywhere' : 'Update trip'}
            </button>
          )}
        </div>
      </div>

      <ListFilterBar
        search={tableSearch}
        onSearchChange={setTableSearch}
        searchPlaceholder="Search places, days, activities…"
        resultCount={visibleDays.length + visiblePlaces.length}
        resultLabel="matches"
        onClear={() => {
          setTableSearch('');
          setDayFilter('all');
          setSectionFilter('all');
        }}
        filters={[
          {
            id: 'day',
            label: 'Trip day',
            value: dayFilter,
            onChange: setDayFilter,
            options: [
              { value: 'all', label: 'All days' },
              ...draft.days.map((d) => ({ value: String(d.day), label: `Day ${d.day}` })),
            ],
          },
          {
            id: 'section',
            label: 'Show section',
            value: sectionFilter,
            onChange: setSectionFilter,
            options: [
              { value: 'all', label: 'All sections' },
              { value: 'days', label: 'Day schedules' },
              { value: 'places', label: 'Places' },
              { value: 'stays', label: 'Stays' },
              { value: 'transport', label: 'Transport' },
            ],
          },
        ]}
      />

      {dirty && (
        <div className="planner-dirty-banner" role="status">
          You have unsaved edits. Tap <b>Update trip</b> to sync the map, train/flight sections, itinerary and
          assistant.
          <button type="button" className="button dark planner-update-btn" onClick={publish}>
            <Save size={14} /> Update trip
          </button>
          <button type="button" className="button pale" onClick={discard}>
            Discard
          </button>
        </div>
      )}

      {(sectionFilter === 'all' || sectionFilter === 'places' || sectionFilter === 'stays') && (
      <div className="planner-phase">
        <div className="planner-phase-head">
          <div className="planner-phase-title-row">
            <h3>Places, destinations &amp; halts</h3>
            <button
              type="button"
              className="button pale"
              onClick={() =>
                markDirty({
                  ...draft,
                  places: [...draft.places, createHaltPlace()],
                })
              }
            >
              <Plus size={14} /> Add halt / place
            </button>
          </div>
          <p className="planner-phase-hint">
            Mark <b>Halt</b> for overnight / rest stops. Fill <b>Stay type</b> and <b>Stay / hotel name</b> when you
            book (hotel, homestay or camping) — the chatbot will answer “where do we stay in Kaza?” from this after{' '}
            <b>Update trip</b>. Rename a place to rewrite it across phases, schedule, stays, transport and the map.
          </p>
        </div>
        <div className="planner-table-wrap">
          <table className="planner-table planner-table-places">
            <thead>
              <tr>
                <th>Map id</th>
                <th>Place name / destination</th>
                <th>Halt?</th>
                <th>Stay type</th>
                <th>Stay / hotel / homestay name</th>
                <th>Region</th>
                <th>Lat</th>
                <th>Lng</th>
                <th>About</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlaces.map((place) => (
                <tr key={place.id} className={place.isHalt ? 'planner-halt-row' : undefined}>
                  <td className="planner-place-id">{place.id}</td>
                  <td>
                    <EditableCell
                      ariaLabel={`Name for ${place.id}`}
                      value={place.name}
                      onChange={(name) => patchPlace(place.id, { name })}
                    />
                  </td>
                  <td className="planner-halt-cell">
                    <label className="planner-halt-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(place.isHalt)}
                        onChange={(event) =>
                          patchPlace(place.id, {
                            isHalt: event.target.checked,
                            kind: event.target.checked
                              ? place.kind === 'En route' || place.kind === 'Optional excursion'
                                ? 'Overnight halt'
                                : place.kind
                              : place.kind === 'Overnight halt'
                                ? 'En route'
                                : place.kind,
                          })
                        }
                      />
                      {place.isHalt ? 'Halt' : 'Pass'}
                    </label>
                  </td>
                  <td>
                    <select
                      className="planner-stay-type"
                      aria-label={`Stay type for ${place.id}`}
                      value={place.stayType || ''}
                      onChange={(event) =>
                        patchPlace(place.id, {
                          stayType: event.target.value as typeof place.stayType,
                        })
                      }
                    >
                      <option value="">—</option>
                      <option value="hotel">Hotel</option>
                      <option value="homestay">Homestay</option>
                      <option value="camping">Camping</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel={`Stay name for ${place.id}`}
                      value={place.stayName || ''}
                      onChange={(stayName) => patchPlace(place.id, { stayName })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel={`Region for ${place.id}`}
                      value={place.region}
                      onChange={(region) => patchPlace(place.id, { region })}
                    />
                  </td>
                  <td>
                    <input
                      className="planner-coord-input"
                      aria-label={`Latitude for ${place.id}`}
                      value={String(place.lat)}
                      onChange={(event) => {
                        const lat = Number(event.target.value);
                        if (!Number.isNaN(lat)) patchPlace(place.id, { lat });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="planner-coord-input"
                      aria-label={`Longitude for ${place.id}`}
                      value={String(place.lng)}
                      onChange={(event) => {
                        const lng = Number(event.target.value);
                        if (!Number.isNaN(lng)) patchPlace(place.id, { lng });
                      }}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel={`About for ${place.id}`}
                      value={place.about}
                      onChange={(about) => patchPlace(place.id, { about })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="planner-halt-summary">
          <b>Current halts:</b>{' '}
          {draft.places
            .filter((place) => place.isHalt)
            .map((place) =>
              place.stayName
                ? `${place.name} (${place.stayType || 'stay'}: ${place.stayName})`
                : place.name,
            )
            .join(' · ') || 'None marked yet'}
        </div>
      </div>
      )}

      {(sectionFilter === 'all' || sectionFilter === 'days') &&
      draft.tripPhases.map((phase) => {
        const phaseDays = visibleDays.filter((day) => day.phaseId === phase.id);
        if (!phaseDays.length && (dayFilter !== 'all' || qTable)) return null;
        return (
          <div key={phase.id} className="planner-phase">
            <div className="planner-phase-head">
              <h3>Phase {phase.number}</h3>
              <label className="planner-phase-field">
                Destinations / title
                <EditableCell
                  ariaLabel={`Phase ${phase.number} title`}
                  value={phase.title}
                  onChange={(title) => patchPhase(phase.id, { title })}
                />
              </label>
              <label className="planner-phase-field">
                Phase note
                <EditableCell
                  ariaLabel={`Phase ${phase.number} note`}
                  value={phase.note || ''}
                  onChange={(note) => patchPhase(phase.id, { note })}
                />
              </label>
            </div>
            <p className="planner-phase-stays">
              <b>Stays in this phase:</b>{' '}
              {(() => {
                const placeIds = new Set(phaseDays.flatMap((day) => day.ids));
                const stays = draft.places.filter(
                  (place) => placeIds.has(place.id) && (place.isHalt || place.stayName.trim()),
                );
                if (!stays.length) return 'Add hotel / homestay names in Places & halts above.';
                return stays
                  .map((place) =>
                    place.stayName.trim()
                      ? `${place.name} — ${place.stayType || 'stay'}: ${place.stayName}`
                      : `${place.name} — stay name not set yet`,
                  )
                  .join(' · ');
              })()}
            </p>

            {phaseDays.map((day) => (
              <div key={day.day} className="planner-day-block">
                <div className="planner-day-head">
                  <strong>
                    Day {day.day} · {day.date}
                  </strong>
                  <label className="planner-day-title-field">
                    Day title
                    <input
                      className="planner-day-title-input"
                      value={day.title}
                      onChange={(event) => patchDayMeta(day.day, { title: event.target.value })}
                    />
                  </label>
                  <button type="button" className="button pale planner-add-row" onClick={() => addRow(day)}>
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
                        <th>Halt / overnight</th>
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
                              onChange={(when) => patchScheduleRow(day.day, row.id, { when })}
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Activity or route"
                              value={row.activity}
                              onChange={(activity) => patchScheduleRow(day.day, row.id, { activity })}
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Mode of travel"
                              value={row.mode}
                              onChange={(mode) => patchScheduleRow(day.day, row.id, { mode })}
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Duration or notes"
                              value={row.notes}
                              onChange={(notes) => patchScheduleRow(day.day, row.id, { notes })}
                            />
                          </td>
                          <td>
                            <EditableCell
                              ariaLabel="Halt or overnight stay"
                              value={row.overnight}
                              onChange={(overnight) =>
                                patchScheduleRow(day.day, row.id, { overnight })
                              }
                            />
                          </td>
                          <td className="planner-row-actions">
                            <button
                              type="button"
                              className="expense-action-delete"
                              aria-label="Remove row"
                              disabled={day.scheduleRows.length <= 1}
                              onClick={() => removeRow(day, row.id)}
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

      {(sectionFilter === 'all' || sectionFilter === 'transport') && (
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
              {draft.transportSegments.map((segment) => (
                <tr key={segment.id}>
                  <td>
                    <EditableCell
                      ariaLabel="Segment"
                      value={segment.segment}
                      onChange={(next) => patchTransport(segment.id, { segment: next })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Travel mode"
                      value={segment.mode}
                      onChange={(mode) => patchTransport(segment.id, { mode })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="What to book"
                      value={segment.book}
                      onChange={(book) => patchTransport(segment.id, { book })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {(sectionFilter === 'all' || sectionFilter === 'stays') && (
      <div className="planner-phase">
        <div className="planner-phase-head">
          <h3>Overnight accommodation checklist</h3>
        </div>
        <div className="planner-table-wrap">
          <table className="planner-table">
            <thead>
              <tr>
                <th>Night</th>
                <th>Date</th>
                <th>Day</th>
                <th>Location</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Stay type</th>
                <th>Hotel / homestay name</th>
                <th>Nights</th>
                <th>Booking priority</th>
              </tr>
            </thead>
            <tbody>
              {draft.stayNights.map((stay) => (
                <tr key={stay.id}>
                  <td>
                    <EditableCell
                      ariaLabel="Night"
                      value={stay.night}
                      onChange={(night) => patchStay(stay.id, { night })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Date"
                      value={stay.dateLabel || ''}
                      onChange={(dateLabel) => patchStay(stay.id, { dateLabel })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Trip day"
                      value={stay.tripDay ? String(stay.tripDay) : ''}
                      onChange={(v) => patchStay(stay.id, { tripDay: parseInt(v, 10) || 0 })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Location"
                      value={stay.location}
                      onChange={(location) => patchStay(stay.id, { location })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Check-in"
                      value={stay.checkIn || ''}
                      onChange={(checkIn) => patchStay(stay.id, { checkIn })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Check-out"
                      value={stay.checkOut || ''}
                      onChange={(checkOut) => patchStay(stay.id, { checkOut })}
                    />
                  </td>
                  <td>
                    <select
                      className="planner-stay-type"
                      aria-label={`Stay type for ${stay.night}`}
                      value={stay.stayType || ''}
                      onChange={(event) =>
                        patchStay(stay.id, {
                          stayType: event.target.value as typeof stay.stayType,
                        })
                      }
                    >
                      <option value="">—</option>
                      <option value="hotel">Hotel</option>
                      <option value="homestay">Homestay</option>
                      <option value="camping">Camping</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel={`Stay name for ${stay.night}`}
                      value={stay.stayName || ''}
                      onChange={(stayName) => patchStay(stay.id, { stayName })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Nights"
                      value={stay.nights}
                      onChange={(nights) => patchStay(stay.id, { nights })}
                    />
                  </td>
                  <td>
                    <EditableCell
                      ariaLabel="Booking priority"
                      value={stay.priority}
                      onChange={(priority) => patchStay(stay.id, { priority })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {(dirty || savedFlash) && (
        <div className={`planner-sticky-bar${dirty ? ' dirty' : ' saved'}`}>
          <span>
            {dirty
              ? 'Unsaved edits — update to sync train, flight, map and itinerary.'
              : 'Trip tables published across the app.'}
          </span>
          <div className="planner-sticky-actions">
            {dirty && (
              <button type="button" className="button pale" onClick={discard}>
                Discard
              </button>
            )}
            <button
              type="button"
              className="button dark planner-update-btn"
              onClick={publish}
              disabled={!dirty}
            >
              {savedFlash && !dirty ? <Check size={15} /> : <Save size={15} />}
              {savedFlash && !dirty ? 'Updated' : 'Update trip'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
