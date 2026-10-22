import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, IdCard, Mountain, Trash2 } from 'lucide-react';
import TripAssistant from './TripAssistant';
import SyncStatusBadge from './SyncStatusBadge';
import { listTravellerNames } from './travellerBrief';
import { getSelectedTraveller, setSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
import {
  deleteIdProof,
  getIdProof,
  idTypeLabel,
  readProofFile,
  saveIdProof,
  subscribeIdProofs,
  type IdProof,
  type IdProofType,
} from './idProofStore';

const TRIP_TITLE = 'Winter Himachal | Interactive Journey';

export default function IdProofPage() {
  const [names, setNames] = useState<string[]>(() => listTravellerNames());
  const [focusName, setFocusName] = useState<string | null>(() => getSelectedTraveller());
  const [proof, setProof] = useState<IdProof | undefined>(() => {
    const name = getSelectedTraveller();
    return name ? getIdProof(name) : undefined;
  });
  const [idType, setIdType] = useState<IdProofType>('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [nameOnId, setNameOnId] = useState('');
  const [note, setNote] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [showing, setShowing] = useState(() => new URLSearchParams(window.location.search).get('show') === '1');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Winter Himachal — ID proof';
    return () => {
      document.title = TRIP_TITLE;
    };
  }, []);

  useEffect(() => subscribeSelectedTraveller(setFocusName), []);

  useEffect(() => {
    const refresh = () => {
      setNames(listTravellerNames());
      if (focusName) setProof(getIdProof(focusName));
    };
    refresh();
    return subscribeIdProofs(refresh);
  }, [focusName]);

  useEffect(() => {
    const saved = focusName ? getIdProof(focusName) : undefined;
    setProof(saved);
    setIdType(saved?.idType || 'aadhaar');
    setIdNumber(saved?.idNumber || '');
    setNameOnId(saved?.nameOnId || focusName || '');
    setNote(saved?.note || '');
    setFileDataUrl(saved?.fileDataUrl);
    setFileName(saved?.fileName);
    setError('');
  }, [focusName]);

  function choose(name: string) {
    setSelectedTraveller(name);
    setFocusName(name);
    setShowing(false);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const loaded = await readProofFile(file);
      setFileDataUrl(loaded.dataUrl);
      setFileName(loaded.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that file.');
    }
  }

  function save() {
    if (!focusName) {
      setError('Pick a traveller first.');
      return;
    }
    try {
      const saved = saveIdProof({
        travellerName: focusName,
        idType,
        idNumber,
        nameOnId: nameOnId || focusName,
        note,
        fileDataUrl,
        fileName,
      });
      setProof(saved);
      setError('');
      setShowing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  function remove() {
    if (!focusName || !proof) return;
    if (!window.confirm(`Remove the saved ID for ${focusName}?`)) return;
    deleteIdProof(focusName);
    setProof(undefined);
    setIdNumber('');
    setNote('');
    setFileDataUrl(undefined);
    setFileName(undefined);
    setShowing(false);
  }

  const image = fileDataUrl?.startsWith('data:image');

  return (
    <div className="app expenses-app">
      <header className="site-nav expenses-page-nav">
        <div className="site-nav-row site-nav-brand-row">
          <Link to="/" className="nav-brand">
            <span className="brand-logo">
              <Mountain />
            </span>
            <span>
              <strong>WINTER</strong>
              <span className="brand-sub">HIMACHAL</span>
            </span>
          </Link>
          <div className="expenses-page-title">
            <IdCard size={16} />
            ID proof for check-in
          </div>
        </div>
        <div className="site-nav-row expenses-page-subnav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="expenses-back-link">
            <ArrowLeft size={15} /> Back to trip planner
          </Link>
          <SyncStatusBadge />
        </div>
      </header>
      <main className="main expenses-page-main">
        <section className="section id-proof-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">HOTEL CHECK-IN</div>
              <h2>Keep an ID on this phone.</h2>
              <p>
                Save an Aadhaar number, passport, or a photo of the card for the selected traveller. Open it when the
                hotel asks. It stays on this phone and is not sent to the shared trip database.
              </p>
            </div>
          </div>

          <div className="assistant-name-row expenses-focus-row">
            <span className="assistant-name-label">{focusName ? 'ID for' : 'Pick a traveller'}</span>
            {names.map((name) => (
              <button key={name} type="button" className={focusName === name ? 'on' : ''} onClick={() => choose(name)}>
                {name}
              </button>
            ))}
          </div>

          {focusName && (
            <div className="id-proof-layout">
              <form
                className="id-proof-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  save();
                }}
              >
                <label>
                  ID type
                  <select value={idType} onChange={(event) => setIdType(event.target.value as IdProofType)}>
                    <option value="aadhaar">Aadhaar</option>
                    <option value="passport">Passport</option>
                    <option value="other">Other ID</option>
                  </select>
                </label>
                <label>
                  {idType === 'aadhaar' ? 'Aadhaar number' : 'ID number'}
                  <input
                    value={idNumber}
                    onChange={(event) => setIdNumber(event.target.value)}
                    inputMode={idType === 'aadhaar' ? 'numeric' : 'text'}
                    placeholder={idType === 'aadhaar' ? '12 digit Aadhaar number' : 'ID number'}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Name on the card
                  <input value={nameOnId} onChange={(event) => setNameOnId(event.target.value)} />
                </label>
                <label>
                  Note for the hotel
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional, e.g. address on the card"
                  />
                </label>
                <label>
                  Photo or PDF of the card
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => onFile(event.target.files?.[0])}
                  />
                </label>
                {fileName && <p className="id-proof-file">{fileName} is ready to save.</p>}
                {error && <p className="id-proof-error">{error}</p>}
                <div className="id-proof-actions">
                  <button type="submit" className="button dark">
                    Save ID
                  </button>
                  {proof && (
                    <button type="button" className="button pale" onClick={() => setShowing(true)}>
                      Show for check-in
                    </button>
                  )}
                  {proof && (
                    <button type="button" className="expense-action-delete" onClick={remove}>
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
              </form>

              <aside className="id-proof-preview">
                <h3>{proof ? `${focusName}'s saved ID` : 'Nothing saved yet'}</h3>
                {proof ? (
                  <>
                    <p>
                      <b>{idTypeLabel(proof.idType)}</b>
                      {proof.idNumber ? ` · ${proof.idNumber}` : ''}
                    </p>
                    <p>{proof.nameOnId || focusName}</p>
                    {image && fileDataUrl && <img src={fileDataUrl} alt={`${focusName} ID`} />}
                    {!image && fileDataUrl && <p className="id-proof-file">A PDF is saved. Open check-in view to show it.</p>}
                  </>
                ) : (
                  <p>Add the number or a photo, then save. The chatbot can read it back when you ask.</p>
                )}
              </aside>
            </div>
          )}
        </section>
      </main>

      {showing && focusName && proof && (
        <div className="id-checkin">
          <button type="button" className="id-checkin-close" onClick={() => setShowing(false)}>
            Close
          </button>
          <p className="id-checkin-kicker">Show this at hotel check-in</p>
          <h2>{proof.nameOnId || focusName}</h2>
          <p className="id-checkin-type">{idTypeLabel(proof.idType)}</p>
          {proof.idNumber && <p className="id-checkin-number">{proof.idNumber}</p>}
          {proof.note && <p className="id-checkin-note">{proof.note}</p>}
          {image && proof.fileDataUrl && <img src={proof.fileDataUrl} alt={`${focusName} ID card`} />}
          {!image && proof.fileDataUrl && (
            <iframe title={`${focusName} ID`} src={proof.fileDataUrl} className="id-checkin-frame" />
          )}
        </div>
      )}

      <div id="assistant">
        <TripAssistant />
      </div>
    </div>
  );
}
