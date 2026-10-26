import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, IdCard, Mountain, Trash2 } from 'lucide-react';
import TripAssistant from './TripAssistant';
import SyncStatusBadge from './SyncStatusBadge';
import NavCalculatorButton from './NavCalculatorButton';
import ListFilterBar from './ListFilterBar';
import { getSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
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
import { downloadBulkIdProofPdf, listIdRoster, type IdRosterRow } from './idProofBulkPdf';

const TRIP_TITLE = 'Spiti Tour 2026 | Interactive Journey';

function documentLabel(proof?: IdProof): string {
  if (!proof?.fileDataUrl) return 'No file';
  if (proof.fileDataUrl.startsWith('data:image')) return 'Photo';
  if (proof.fileDataUrl.startsWith('data:application/pdf')) return 'PDF';
  return proof.fileName || 'File';
}

export default function IdProofPage() {
  const [focusName, setFocusName] = useState<string | null>(() => getSelectedTraveller());
  const [proof, setProof] = useState<IdProof | undefined>(() => {
    const name = getSelectedTraveller();
    return name ? getIdProof(name) : undefined;
  });
  const [roster, setRoster] = useState<IdRosterRow[]>(() => listIdRoster());
  const [idType, setIdType] = useState<IdProofType>('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [nameOnId, setNameOnId] = useState('');
  const [note, setNote] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [showing, setShowing] = useState(() => new URLSearchParams(window.location.search).get('show') === '1');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [idSearch, setIdSearch] = useState('');
  const [idStatusFilter, setIdStatusFilter] = useState('all');

  useEffect(() => {
    document.title = 'Spiti Tour 2026 — ID proof';
    return () => {
      document.title = TRIP_TITLE;
    };
  }, []);

  useEffect(() => subscribeSelectedTraveller(setFocusName), []);

  useEffect(() => {
    const refresh = () => {
      setRoster(listIdRoster());
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
    setDirty(false);
    setSavedFlash(false);
  }, [focusName]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const loaded = await readProofFile(file);
      setFileDataUrl(loaded.dataUrl);
      setFileName(loaded.fileName);
      setDirty(true);
      setSavedFlash(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that file.');
    }
  }

  function markDirty() {
    setDirty(true);
    setSavedFlash(false);
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
      setDirty(false);
      setSavedFlash(true);
      setShowing(false);
      window.setTimeout(() => setSavedFlash(false), 2500);
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
    setDirty(false);
    setSavedFlash(false);
  }

  const image = fileDataUrl?.startsWith('data:image');
  const savedCount = roster.filter((row) => row.proof).length;
  const filteredRoster = useMemo(() => {
    const q = idSearch.trim().toLowerCase();
    return roster.filter(({ travellerName, proof: rowProof }) => {
      if (idStatusFilter === 'saved' && !rowProof) return false;
      if (idStatusFilter === 'missing' && rowProof) return false;
      if (!q) return true;
      return `${travellerName} ${rowProof?.idType || ''} ${rowProof?.idNumber || ''} ${rowProof?.nameOnId || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [roster, idSearch, idStatusFilter]);

  function bulkDownload() {
    setDownloading(true);
    try {
      downloadBulkIdProofPdf();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the group PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app expenses-app">
      <header className="site-nav expenses-page-nav">
        <div className="site-nav-row site-nav-brand-row">
          <Link to="/" className="nav-brand">
            <span className="brand-logo">
              <Mountain />
            </span>
            <span>
              <strong>SPITI</strong>
              <span className="brand-sub">TOUR 2026</span>
            </span>
          </Link>
          <div className="expenses-page-title">
            <IdCard size={16} />
            ID proof for check-in
          </div>
          <NavCalculatorButton />
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
              <h2>Edit and keep ID on this phone.</h2>
              <p>
                Change your Aadhaar, passport or photo anytime below, tap <b>Update ID proof</b>, then ask the chatbot
                “show my ID proof” — it reads the latest saved details. Group list and bulk PDF stay in sync too.
              </p>
            </div>
            <button type="button" className="button dark" onClick={bulkDownload} disabled={downloading}>
              <Download size={15} />
              {downloading ? 'Preparing…' : 'Bulk download all IDs'}
            </button>
          </div>

          <div className="assistant-name-row expenses-focus-row assistant-name-locked">
            <span className="assistant-name-label">{focusName ? 'ID for' : 'Unlock and pick your name first'}</span>
            {focusName && (
              <button type="button" className="on" disabled>
                {focusName}
              </button>
            )}
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
                  <select
                    value={idType}
                    onChange={(event) => {
                      setIdType(event.target.value as IdProofType);
                      markDirty();
                    }}
                  >
                    <option value="aadhaar">Aadhaar</option>
                    <option value="passport">Passport</option>
                    <option value="other">Other ID</option>
                  </select>
                </label>
                <label>
                  {idType === 'aadhaar' ? 'Aadhaar number' : 'ID number'}
                  <input
                    value={idNumber}
                    onChange={(event) => {
                      setIdNumber(event.target.value);
                      markDirty();
                    }}
                    inputMode={idType === 'aadhaar' ? 'numeric' : 'text'}
                    placeholder={idType === 'aadhaar' ? '12 digit Aadhaar number' : 'ID number'}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Name on the card
                  <input
                    value={nameOnId}
                    onChange={(event) => {
                      setNameOnId(event.target.value);
                      markDirty();
                    }}
                  />
                </label>
                <label>
                  Note for the hotel
                  <input
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      markDirty();
                    }}
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
                {fileName && <p className="id-proof-file">{fileName} is ready to {proof ? 'update' : 'save'}.</p>}
                {dirty && <p className="id-proof-dirty">Unsaved edits — tap Update ID proof to apply.</p>}
                {savedFlash && <p className="id-proof-file">Updated. The chatbot will use these new details.</p>}
                {error && <p className="id-proof-error">{error}</p>}
                <div className="id-proof-actions">
                  <button type="submit" className="button dark" disabled={!dirty && Boolean(proof)}>
                    {proof ? 'Update ID proof' : 'Save ID'}
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
                    {proof.note ? <p className="id-proof-file">{proof.note}</p> : null}
                    <p className="id-proof-file">
                      Last updated {new Date(proof.updatedAt).toLocaleString('en-IN')}
                    </p>
                    {image && fileDataUrl && <img src={fileDataUrl} alt={`${focusName} ID`} />}
                    {!image && fileDataUrl && (
                      <p className="id-proof-file">A PDF is saved. Open check-in view to show it.</p>
                    )}
                    <p className="id-proof-file">
                      Edit the form on the left, tap Update ID proof, then ask the chatbot for your ID.
                    </p>
                  </>
                ) : (
                  <p>Add the number or a photo, then save. The chatbot reads the latest saved ID when you ask.</p>
                )}
              </aside>
            </div>
          )}

          <div className="id-roster-block">
            <div className="id-roster-head">
              <div>
                <h3>Everyone’s ID list</h3>
                <p>
                  {savedCount} of {roster.length} travellers have details saved. Bulk download includes this table plus
                  each uploaded photo.
                </p>
              </div>
              <button type="button" className="button pale" onClick={bulkDownload} disabled={downloading}>
                <Download size={15} />
                Download group PDF
              </button>
            </div>

            <ListFilterBar
              search={idSearch}
              onSearchChange={setIdSearch}
              searchPlaceholder="Search traveller or ID number…"
              resultCount={filteredRoster.length}
              resultLabel="travellers"
              onClear={() => {
                setIdSearch('');
                setIdStatusFilter('all');
              }}
              filters={[
                {
                  id: 'status',
                  label: 'Status',
                  value: idStatusFilter,
                  onChange: setIdStatusFilter,
                  options: [
                    { value: 'all', label: 'All' },
                    { value: 'saved', label: 'Saved' },
                    { value: 'missing', label: 'Missing' },
                  ],
                },
              ]}
            />

            <div className="id-roster-table-wrap">
              <table className="id-roster-table">
                <thead>
                  <tr>
                    <th>Traveller</th>
                    <th>ID type</th>
                    <th>Number</th>
                    <th>Name on card</th>
                    <th>Document</th>
                    <th>Note</th>
                    <th>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map(({ travellerName, proof: rowProof }) => {
                    const preview = rowProof?.fileDataUrl?.startsWith('data:image')
                      ? rowProof.fileDataUrl
                      : undefined;
                    const isYou =
                      focusName &&
                      travellerName.trim().toLowerCase() === focusName.trim().toLowerCase();
                    return (
                      <tr key={travellerName} className={isYou ? 'id-roster-you' : undefined}>
                        <td>
                          <strong>{travellerName}</strong>
                          {isYou ? <span className="id-roster-you-tag">You</span> : null}
                        </td>
                        <td>{rowProof ? idTypeLabel(rowProof.idType) : '—'}</td>
                        <td>{rowProof?.idNumber || 'Not saved'}</td>
                        <td>{rowProof?.nameOnId || travellerName}</td>
                        <td>{documentLabel(rowProof)}</td>
                        <td>{rowProof?.note || '—'}</td>
                        <td className="id-roster-preview-cell">
                          {preview ? (
                            <img src={preview} alt={`${travellerName} ID`} />
                          ) : rowProof?.fileDataUrl ? (
                            <span>PDF on file</span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="id-roster-cards">
              {filteredRoster.map(({ travellerName, proof: rowProof }) => {
                const preview = rowProof?.fileDataUrl?.startsWith('data:image')
                  ? rowProof.fileDataUrl
                  : undefined;
                const isYou =
                  focusName && travellerName.trim().toLowerCase() === focusName.trim().toLowerCase();
                return (
                  <article key={travellerName} className={`id-roster-card${isYou ? ' on' : ''}`}>
                    <header>
                      <strong>{travellerName}</strong>
                      {isYou ? <span>You</span> : null}
                    </header>
                    <p>
                      <b>{rowProof ? idTypeLabel(rowProof.idType) : 'No ID yet'}</b>
                      {rowProof?.idNumber ? ` · ${rowProof.idNumber}` : ''}
                    </p>
                    <p>{rowProof?.nameOnId || '—'}</p>
                    <p className="id-roster-card-meta">
                      {documentLabel(rowProof)}
                      {rowProof?.note ? ` · ${rowProof.note}` : ''}
                    </p>
                    {preview && <img src={preview} alt={`${travellerName} ID`} />}
                  </article>
                );
              })}
            </div>
          </div>
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
