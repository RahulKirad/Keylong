import React from 'react';
import type { TripAssignment } from './assignmentStore';
import type { TripMember } from './expenseStore';

type Props = {
  members: TripMember[];
  assignments: TripAssignment[];
};

export default function TravellerAssignmentGrid({ members, assignments }: Props) {
  if (!members.length) return null;

  return (
    <div className="assignment-traveller-grid">
      <h3>By traveller</h3>
      <div className="assignment-traveller-columns">
        {members.map((m) => {
          const tasks = assignments.filter((a) => a.assigneePersonId === m.id);
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
