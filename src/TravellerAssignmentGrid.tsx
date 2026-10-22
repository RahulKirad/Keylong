import React from 'react';
import type { TripAssignment } from './assignmentStore';
import type { TripMember } from './expenseStore';
import { collapseMembers } from './memberIdentity';

type Props = {
  members: TripMember[];
  assignments: TripAssignment[];
};

export default function TravellerAssignmentGrid({ members, assignments }: Props) {
  const columns = collapseMembers(members).members;
  if (!columns.length) return null;

  return (
    <div className="assignment-traveller-grid">
      <h3>By traveller</h3>
      <div className="assignment-traveller-columns">
        {columns.map((m) => {
          const nameKey = m.name.trim().toLowerCase();
          const ids = new Set(
            members.filter((member) => member.name.trim().toLowerCase() === nameKey).map((member) => member.id),
          );
          const seen = new Set<string>();
          const tasks = assignments.filter((a) => {
            const matches =
              ids.has(a.assigneePersonId) || (a.assigneeName || '').trim().toLowerCase() === nameKey;
            if (!matches || seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          });
          return (
            <div key={m.id} className="assignment-traveller-col">
              <div className="assignment-traveller-col-head">{m.name}</div>
              <ul>
                {tasks.length === 0 && <li className="assignment-empty">No tasks yet</li>}
                {tasks.map((t) => (
                  <li key={t.id}>
                    <span className="assignment-task-text">{t.task}</span>
                    {t.tripDayNumber != null && (
                      <span className="assignment-task-day">Day {t.tripDayNumber}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
