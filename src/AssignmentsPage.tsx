import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Mountain, Mic, Bot, Pencil, Trash2 } from 'lucide-react';
import TripAssistant from './TripAssistant';
import SyncStatusBadge from './SyncStatusBadge';
import {
  TripAssignment,
  allAssignments,
  deleteAssignment,
  subscribeAssignments,
  updateAssignment,
} from './assignmentStore';
import { getExpenseState, subscribeExpenses } from './expenseStore';
import { openTripAssistant } from './assistantBridge';
import TravellerAssignmentGrid from './TravellerAssignmentGrid';
import { days } from './tripData';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState(allAssignments());
  const [members, setMembers] = useState(getExpenseState().members);
  const [editing, setEditing] = useState<TripAssignment | null>(null);

  const refresh = () => {
    setAssignments(allAssignments());
    setMembers(getExpenseState().members);
  };

  useEffect(() => {
    document.title = 'Winter Himachal — Assignments';
    return () => {
      document.title = 'Winter Himachal | Interactive Journey';
    };
  }, []);

  useEffect(() => subscribeAssignments(refresh), []);
  useEffect(() => subscribeExpenses(refresh), []);

  function saveEdit() {
    if (!editing) return;
    updateAssignment(editing.id, {
      assigneePersonId: editing.assigneePersonId,
      assigneeName: editing.assigneeName,
      task: editing.task,
      tripDayNumber: editing.tripDayNumber,
      dateLabel: editing.dateLabel,
      source: editing.source,
    });
    setEditing(null);
    refresh();
  }

  function confirmDelete(a: TripAssignment) {
    if (!window.confirm(`Remove task for ${a.assigneeName}?\n\n${a.task}`)) return;
    deleteAssignment(a.id);
    if (editing?.id === a.id) setEditing(null);
    refresh();
  }

  return (
    <div className="app assignments-app">
      <header className="site-nav expenses-page-nav">
        <div className="site-nav-row site-nav-brand-row">
          <Link to="/" className="nav-brand">
            <span className="brand-logo"><Mountain /></span>
            <span>
              <strong>WINTER</strong>
              <span className="brand-sub">HIMACHAL</span>
            </span>
          </Link>
          <div className="expenses-page-title">
            <ClipboardList size={16} />
            Trip assignments
          </div>
        </div>
        <div className="site-nav-row expenses-page-subnav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="expenses-back-link">
            <ArrowLeft size={15} /> Back to trip planner
          </Link>
          <SyncStatusBadge />
        </div>
      </header>

      <main className="main assignments-page-main">
        <section className="section assignments-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">WHO DOES WHAT</div>
              <h2>Things assigned</h2>
              <p>
                Rahul, Sanket, Allen, Neeraj, Aleena, Piyu, Gautami, Vedant, Milind, and Rutika are your default
                travellers. Assign tasks via the assistant — e.g. “Rahul is assigned to book the train tickets for
                23rd”. Linked days highlight in the <Link to="/#itinerary">itinerary</Link>.
              </p>
            </div>
          </div>

          <div className="expenses-toolbar">
            <button type="button" className="button dark" onClick={() => openTripAssistant('assignments')}>
              <Mic size={15} /> Voice assign task
            </button>
            <button type="button" className="button pale" onClick={() => openTripAssistant('assignments')}>
              <Bot size={15} /> Assignment assistant
            </button>
          </div>

          <TravellerAssignmentGrid members={members} assignments={assignments} />

          <div className="expenses-table-wrap assignment-list-table">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Traveller</th>
                  <th>Assigned work</th>
                  <th>Trip day</th>
                  <th>Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="expenses-empty">
                      No assignments yet. Open the assistant → <b>Assign tasks</b> and say who should do what.
                    </td>
                  </tr>
                )}
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.assigneeName}</strong></td>
                    <td>{a.task}</td>
                    <td>{a.tripDayNumber != null ? `Day ${a.tripDayNumber}` : '—'}</td>
                    <td>{a.dateLabel || '—'}</td>
                    <td className="expenses-actions">
                      <button type="button" className="expense-action-edit" onClick={() => setEditing({ ...a })}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button type="button" className="expense-action-delete" onClick={() => confirmDelete(a)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <footer className="footer">
          WINTER HIMACHAL ASSIGNMENTS <span>·</span> UNIVERSAL CLOUD DATABASE <span>·</span> REAL-TIME MULTI-DEVICE SYNC
        </footer>
      </main>

      <div id="assistant"><TripAssistant /></div>

      {editing && (
        <div className="assistant-settings-backdrop" onClick={() => setEditing(null)}>
          <div className="expense-edit-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>Edit assignment</h3>
            <label>
              Traveller
              <select
                value={editing.assigneePersonId}
                onChange={(e) => {
                  const m = members.find((x) => x.id === e.target.value);
                  setEditing({
                    ...editing,
                    assigneePersonId: e.target.value,
                    assigneeName: m?.name || editing.assigneeName,
                  });
                }}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label>
              Task
              <input value={editing.task} onChange={(e) => setEditing({ ...editing, task: e.target.value })} />
            </label>
            <label>
              Trip day
              <select
                value={editing.tripDayNumber ?? ''}
                onChange={(e) => {
                  const n = e.target.value ? parseInt(e.target.value, 10) : undefined;
                  const d = n ? days.find((x) => x.day === n) : undefined;
                  setEditing({
                    ...editing,
                    tripDayNumber: n,
                    dateLabel: d?.date,
                  });
                }}
              >
                <option value="">Not linked to a day</option>
                {days.map((d) => (
                  <option key={d.day} value={d.day}>Day {d.day} — {d.date}</option>
                ))}
              </select>
            </label>
            <div className="assistant-settings-actions">
              <button type="button" className="button expense-modal-delete" onClick={() => confirmDelete(editing)}>
                Delete
              </button>
              <button type="button" className="button pale" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="button dark" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
