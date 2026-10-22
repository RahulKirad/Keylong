import React, { useState } from 'react';
import { Mountain, Lock } from 'lucide-react';
import { listTravellerNames } from './travellerBrief';
import { setSelectedTraveller } from './selectedTraveller';
import { checkPassword, unlockApp } from './tripUnlock';

type Props = {
  onUnlocked: () => void;
};

export default function UnlockScreen({ onUnlocked }: Props) {
  const [names] = useState(() => listTravellerNames());
  const [name, setName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name) {
      setError('Tap your name first.');
      return;
    }
    if (!checkPassword(password)) {
      setError('Wrong password. Try again.');
      setPassword('');
      return;
    }
    setSelectedTraveller(name);
    unlockApp();
    onUnlocked();
  }

  return (
    <div className="app-gate">
      <div className="app-gate-card">
        <div className="app-gate-brand">
          <span className="brand-logo">
            <Mountain />
          </span>
          <div>
            <strong>WINTER HIMACHAL</strong>
            <span>Trip unlock</span>
          </div>
        </div>
        <h1>Who is opening the trip?</h1>
        <p>Select your name, then enter the trip password to open the planner.</p>

        <div className="app-gate-names">
          <span className="app-gate-label">Traveller</span>
          <div className="app-gate-name-tabs">
            {names.map((item) => (
              <button
                key={item}
                type="button"
                className={name === item ? 'on' : ''}
                onClick={() => {
                  setName(item);
                  setError('');
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <form className="app-gate-form" onSubmit={submit}>
          <label className="app-gate-label" htmlFor="trip-password">
            Password
          </label>
          <div className="app-gate-password-row">
            <Lock size={16} />
            <input
              id="trip-password"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder={name ? `Password for ${name}` : 'Enter trip password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
            />
          </div>
          {error && <p className="app-gate-error">{error}</p>}
          <button type="submit" className="button light app-gate-submit" disabled={!name || !password.trim()}>
            Open trip
          </button>
        </form>
      </div>
    </div>
  );
}
