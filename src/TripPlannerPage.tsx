import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mountain,
  MapPin,
  CalendarDays,
  TrainFront,
  CarFront,
  Plane,
  ShieldCheck,
  ChevronRight,
  Clock,
  Route,
  Info,
  Menu,
  X,
  ArrowRight,
  LocateFixed,
  CheckCircle2,
  Copy,
  IndianRupee,
  Bot,
  Wallet,
  FileText,
  ClipboardList,
  IdCard,
} from 'lucide-react';
import { assignmentsForDay, subscribeAssignments } from './assignmentStore';
import SyncStatusBadge from './SyncStatusBadge';
import AllenDraftModal from './AllenDraftModal';
import FinalRouteItineraryModal from './FinalRouteItineraryModal';
import { ALLEN_DRAFT } from './allenDraftAssets';
import { FINAL_ROUTE_ITINERARY } from './finalRouteItineraryAssets';
import BudgetCalculator from './BudgetCalculator';
import TripMap from './TripMap';
import TripAssistant from './TripAssistant';
import { openTripAssistant } from './assistantBridge';
import type { LatLng } from './routeUtils';
import { places, days, safetyChecklist, type Place } from './tripData';

const ROUTE_SEGMENT_IDS: Record<'all' | 'lahaul' | 'parvati', string[]> = {
  all: ['delhi', 'manali', 'sissu', 'keylong', 'jispa', 'bhuntar', 'kasol', 'delhi'],
  lahaul: ['manali', 'sissu', 'keylong', 'jispa'],
  parvati: ['bhuntar', 'kasol', 'chalal', 'malana', 'manikaran'],
};
function HeroBg() {
  return (
    <div className="hero-bg" aria-hidden="true">
      <video className="hero-video" autoPlay muted loop playsInline preload="metadata">
        <source src="/campfire-banner.mp4" type="video/mp4" />
      </video>
      <div className="hero-video-scrim" />
    </div>
  );
}

export default function TripPlannerPage() {
  const [activeDay, setActiveDay] = useState(2);
  const [selected, setSelected] = useState('sissu');
  const [routeMode, setRouteMode] = useState<'all' | 'lahaul' | 'parvati'>('all');
  const [mobileNav, setMobileNav] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [allenDraft, setAllenDraft] = useState<{ open: boolean; tab: 'pdf' | 'ppt' }>({
    open: false,
    tab: 'pdf',
  });
  const [finalItineraryOpen, setFinalItineraryOpen] = useState(false);
  const [, setAssignmentTick] = useState(0);

  useEffect(() => subscribeAssignments(() => setAssignmentTick((t) => t + 1)), []);

  useEffect(() => {
    if (!mobileNav) return;
    const onPointer = (event: MouseEvent) => {
      if (!navMenuRef.current?.contains(event.target as Node)) setMobileNav(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNav(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileNav]);
  const day = days[activeDay];
  const shown = useMemo(
    () =>
      places.filter((p) =>
        routeMode === 'all'
          ? true
          : routeMode === 'lahaul'
            ? ['manali', 'sissu', 'keylong', 'jispa'].includes(p.id)
            : ['bhuntar', 'kasol', 'chalal', 'malana', 'manikaran'].includes(p.id),
      ),
    [routeMode],
  );
  const routePlaces = useMemo(
    () => day.ids.map((id) => places.find((p) => p.id === id)).filter(Boolean) as Place[],
    [day],
  );
  const dayWaypoints = useMemo(() => routePlaces.map((p) => [p.lat, p.lng] as LatLng), [routePlaces]);
  const segmentWaypoints = useMemo(
    () =>
      ROUTE_SEGMENT_IDS[routeMode]
        .map((id) => places.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => [p!.lat, p!.lng] as LatLng),
    [routeMode],
  );
  const mapWaypoints = dayWaypoints.length >= 2 ? dayWaypoints : segmentWaypoints;
  const chosen = places.find((p) => p.id === selected) || places[2];

  function chooseDay(i: number) {
    setActiveDay(i);
    setSelected(days[i].ids[0]);
    document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function choosePlace(p: Place) {
    setSelected(p.id);
    const i = days.findIndex((d) => d.ids.includes(p.id));
    if (i >= 0) setActiveDay(i);
  }

  function closeNav() {
    setMobileNav(false);
  }

  function openAllenDraft(tab: 'pdf' | 'ppt') {
    setAllenDraft({ open: true, tab });
    closeNav();
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard');
    } catch {
      alert(text);
    }
  };

  const routeTabs = ['all', 'lahaul', 'parvati'] as const;

  return (
    <div className="app">
      <header className="site-nav">
        <div className="site-nav-row site-nav-brand-row">
          <a href="#overview" className="nav-brand" onClick={closeNav}>
            <span className="brand-logo">
              <Mountain />
            </span>
            <span>
              <strong>WINTER</strong>
              <span className="brand-sub">HIMACHAL</span>
            </span>
          </a>
          <div className="nav-meta">
            <div className="nav-dates">
              <CalendarDays size={15} /> 23 DEC ’26 — 03 JAN ’27
            </div>
            <SyncStatusBadge compact />
          </div>
          <div className="nav-dropdown" ref={navMenuRef}>
            <button
              type="button"
              className="nav-menu-btn"
              aria-label="Open menu"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav((open) => !open)}
            >
              {mobileNav ? <X size={16} /> : <Menu size={16} />}
              Menu
            </button>
            {mobileNav && (
              <div className="nav-dropdown-panel">
                <div className="nav-route-tabs">
                  {routeTabs.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={routeMode === m ? 'on' : ''}
                      onClick={() => setRouteMode(m)}
                    >
                      {m === 'all' ? 'Full route' : m === 'lahaul' ? 'Lahaul' : 'Parvati'}
                    </button>
                  ))}
                </div>
                <nav className="nav-core">
                  <a href="#map" onClick={closeNav}>
                    <Route size={15} /> Map
                  </a>
                  <a href="#itinerary" onClick={closeNav}>
                    <CalendarDays size={15} /> Itinerary
                  </a>
                  <a href="#budget" onClick={closeNav}>
                    <IndianRupee size={15} /> Budget
                  </a>
                  <Link to="/expenses" onClick={closeNav}>
                    <Wallet size={15} /> Expenses
                  </Link>
                  <Link to="/assignments" onClick={closeNav}>
                    <ClipboardList size={15} /> Assignments
                  </Link>
                  <Link to="/id-proof" onClick={closeNav}>
                    <IdCard size={15} /> ID proof
                  </Link>
                  <button type="button" className="nav-allen-draft" onClick={() => openAllenDraft('pdf')}>
                    <FileText size={15} />
                    <span>
                      {ALLEN_DRAFT.shortLabel}
                      <span className="nav-allen-hint"> {ALLEN_DRAFT.navbarHint}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="nav-allen-draft nav-final-itinerary"
                    onClick={() => {
                      setFinalItineraryOpen(true);
                      closeNav();
                    }}
                  >
                    <Route size={15} />
                    <span>
                      {FINAL_ROUTE_ITINERARY.shortLabel}
                      <span className="nav-allen-hint"> {FINAL_ROUTE_ITINERARY.navbarHint}</span>
                    </span>
                  </button>
                </nav>
                <nav className="nav-secondary">
                  <a href="#overview" onClick={closeNav}>
                    <Mountain size={15} /> Overview
                  </a>
                  <a href="#transport" onClick={closeNav}>
                    <TrainFront size={15} /> Transport
                  </a>
                  <a href="#flight" onClick={closeNav}>
                    <Plane size={15} /> Flight
                  </a>
                  <a href="#safety" onClick={closeNav}>
                    <ShieldCheck size={15} /> Safety
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      openTripAssistant('trip');
                      closeNav();
                    }}
                  >
                    <Bot size={15} /> AI assistant
                  </button>
                  <Link to="/expenses" onClick={closeNav}>
                    <Wallet size={15} /> Expenses page
                  </Link>
                  <Link to="/assignments" onClick={closeNav}>
                    <ClipboardList size={15} /> Assignments page
                  </Link>
                  <Link to="/id-proof" onClick={closeNav}>
                    <IdCard size={15} /> ID proof page
                  </Link>
                  <button type="button" onClick={() => openAllenDraft('pdf')}>
                    <FileText size={15} /> {ALLEN_DRAFT.pdf.navLabel}
                  </button>
                  <button type="button" onClick={() => openAllenDraft('ppt')}>
                    <FileText size={15} /> {ALLEN_DRAFT.ppt.navLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFinalItineraryOpen(true);
                      closeNav();
                    }}
                  >
                    <Route size={15} /> {FINAL_ROUTE_ITINERARY.title}
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>
      <AllenDraftModal
        open={allenDraft.open}
        initialTab={allenDraft.tab}
        onClose={() => setAllenDraft((s) => ({ ...s, open: false }))}
      />
      <FinalRouteItineraryModal open={finalItineraryOpen} onClose={() => setFinalItineraryOpen(false)} />
      <main className="main">
        <section id="overview" className="hero">
          <HeroBg />
          <div className="hero-content">
            <div className="kicker">
              <span /> YOUR PERSONAL WINTER ESCAPE
            </div>
            <h1>
              Winter<br />
              <i>Himachal.</i>
            </h1>
            <p>
              Snow-dusted valleys, quiet mountain villages and winding Himalayan roads. Explore your trip one stop at a
              time.
            </p>
            <div className="hero-meta">
              <span>
                <CalendarDays /> 23 Dec 2026 — 03 Jan 2027
              </span>
              <span>
                <MapPin /> Lahaul · Parvati Valley
              </span>
            </div>
            <div className="hero-actions">
              <a href="#itinerary" className="button light">
                Explore itinerary <ArrowRight size={16} />
              </a>
              <a href="#map" className="button outline">
                Open interactive map
              </a>
            </div>
          </div>
          <div className="hero-index">HIMALAYAN WINTER / 01</div>
        </section>
        <section className="stats">
          <div className="stat">
            <CalendarDays />
            <small>TRIP DURATION</small>
            <strong>12 days</strong>
            <span>23 Dec — 03 Jan</span>
          </div>
          <div className="stat">
            <Mountain />
            <small>REGIONS</small>
            <strong>2 valleys</strong>
            <span>Lahaul + Parvati</span>
          </div>
          <div className="stat">
            <Route />
            <small>ROUTE STOPS</small>
            <strong>9 places</strong>
            <span>Transit + overnight bases</span>
          </div>
          <div className="stat">
            <Plane />
            <small>FINAL FLIGHT</small>
            <strong>SG105</strong>
            <span>Delhi → Pune · 03 Jan</span>
          </div>
        </section>
        <section id="map" className="section map-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">ROAD-MAPPED ROUTE</div>
              <h2>Your journey, on the map.</h2>
              <p>
                Pick a day or route segment in the navbar. Click the red road line, a stop, or <b>Drive route</b> to move
                your vehicle along the mapped path.
              </p>
            </div>
          </div>
          <div className="map-layout">
            <TripMap
              waypoints={mapWaypoints}
              places={shown.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.kind }))}
              onSelectPlace={(id) => {
                const p = places.find((x) => x.id === id);
                if (p) choosePlace(p);
              }}
            />
            <aside className="place-panel">
              <div className="panel-top">
                <span className="panel-tag">{chosen.region.toUpperCase()}</span>
                <span className="altitude">{chosen.alt}</span>
              </div>
              <h3>{chosen.name}</h3>
              <div className="place-kind">
                <MapPin size={14} />
                {chosen.kind}
              </div>
              <p className="place-about">{chosen.about}</p>
              <div className="info-title">
                <Info size={15} /> GOOD TO KNOW
              </div>
              <ul className="tips">
                {chosen.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <div className="panel-bottom">
                <span>DAY {activeDay + 1} · {day.date.toUpperCase()}</span>
                <button onClick={() => document.getElementById('itinerary')?.scrollIntoView({ behavior: 'smooth' })}>
                  View day <ChevronRight size={15} />
                </button>
              </div>
            </aside>
          </div>
          <div className="map-caption">
            <LocateFixed size={14} /> Driving geometry from OpenStreetMap via OSRM (planning reference only). Winter
            closures may differ from mapped roads — confirm locally before travel.
          </div>
        </section>
        <section id="itinerary" className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">12 DAYS · 11 NIGHTS APPROX.</div>
              <h2>Day by day, at your pace.</h2>
              <p>
                Select a day to move the map route and open that day’s practical notes. Days with assigned tasks are
                highlighted — add tasks on the <Link to="/assignments">Assignments</Link> page or via the assistant.
              </p>
            </div>
            <div className="small-counter">
              {String(activeDay + 1).padStart(2, '0')} <span>/ 12</span>
            </div>
          </div>
          <div className="itinerary-layout">
            <div className="day-list">
              {days.map((d, i) => {
                const dayTasks = assignmentsForDay(d.day);
                return (
                  <button
                    key={d.day}
                    className={`day-row ${i === activeDay ? 'selected' : ''} ${dayTasks.length ? 'has-assignments' : ''}`}
                    onClick={() => chooseDay(i)}
                  >
                    <span className="day-num">{String(d.day).padStart(2, '0')}</span>
                    <span className="day-info">
                      <small>{d.date.toUpperCase()}</small>
                      <b>{d.title}</b>
                      <em>{d.transport} · {d.place}</em>
                      {dayTasks.length > 0 && (
                        <span className="day-assignment-preview">
                          {dayTasks.map((a) => `${a.assigneeName}: ${a.task}`).join(' · ')}
                        </span>
                      )}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="day-assignment-badge" title="Assigned tasks">
                        {dayTasks.length}
                      </span>
                    )}
                    <ChevronRight size={17} />
                  </button>
                );
              })}
            </div>
            <article className="day-detail">
              <div className="detail-top">
                <div>
                  <span className="detail-day">DAY {day.day} / 12</span>
                  <h3>{day.title}</h3>
                  <p>
                    <MapPin size={15} />
                    {day.place}
                  </p>
                </div>
                <div className="detail-icon">
                  {day.transport === 'Train' ? (
                    <TrainFront />
                  ) : day.transport === 'Flight' ? (
                    <Plane />
                  ) : day.transport.includes('traveller') || day.transport === 'Private traveller' ? (
                    <CarFront />
                  ) : (
                    <Mountain />
                  )}
                </div>
              </div>
              <div className="time-strip">
                <Clock />
                <div>
                  <small>PLAN / TARGET</small>
                  <b>{day.time}</b>
                </div>
              </div>
              {assignmentsForDay(day.day).length > 0 && (
                <div className="day-assignments-highlight">
                  <h4>ASSIGNED FOR THIS DAY</h4>
                  <ul>
                    {assignmentsForDay(day.day).map((a) => (
                      <li key={a.id}>
                        <strong>{a.assigneeName}</strong> — {a.task}
                      </li>
                    ))}
                  </ul>
                  <Link to="/assignments" className="day-assignments-link">Open assignments page</Link>
                </div>
              )}
              <h4>THE PLAN</h4>
              <ul className="activity-list">
                {day.details.map((x) => (
                  <li key={x}>
                    <CheckCircle2 size={16} />
                    {x}
                  </li>
                ))}
              </ul>
              {day.warning && (
                <div className="warning">
                  <ShieldCheck />
                  <div>
                    <b>Important note</b>
                    <p>{day.warning}</p>
                  </div>
                </div>
              )}
              <div className="stay-row">
                <span>OVERNIGHT / END POINT</span>
                <b>{day.stay}</b>
              </div>
              <div className="detail-actions">
                <button
                  className="button dark"
                  onClick={() => {
                    setSelected(day.ids[0]);
                    document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <MapPin size={15} /> Show route on map
                </button>
                <button
                  className="button pale"
                  onClick={() =>
                    copy(
                      `${day.date} — ${day.title}\n${day.time}\n${day.details.map((x) => '• ' + x).join('\n')}\nOvernight: ${day.stay}${day.warning ? '\nNote: ' + day.warning : ''}`,
                    )
                  }
                >
                  <Copy size={15} /> Copy day plan
                </button>
              </div>
              <div className="day-switch">
                <button disabled={activeDay === 0} onClick={() => chooseDay(activeDay - 1)}>← Previous day</button>
                <button disabled={activeDay === days.length - 1} onClick={() => chooseDay(activeDay + 1)}>
                  Next day →
                </button>
              </div>
            </article>
          </div>
        </section>
        <section id="transport" className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">GETTING THERE & BACK</div>
              <h2>Long journeys, clearly planned.</h2>
              <p>Transport information provided for this itinerary. Unconfirmed details are intentionally left blank.</p>
            </div>
          </div>
          <div className="transport-grid">
            <article className="transport-card">
              <div className="transport-icon">
                <TrainFront />
              </div>
              <div className="transport-kicker">23–24 DEC 2026 · RAIL</div>
              <h3>BDTS → NZM</h3>
              <p className="transport-name">22917 BDTS–NZM SF Express</p>
              <div className="timeline">
                <div>
                  <span className="timeline-dot" />
                  <small>DEPARTURE</small>
                  <b>23 Dec · 12:45 PM</b>
                  <p>Bandra Terminus (BDTS)</p>
                </div>
                <div>
                  <span className="timeline-dot" />
                  <small>ARRIVAL</small>
                  <b>24 Dec · 08:35 AM</b>
                  <p>Hazrat Nizamuddin (NZM)</p>
                </div>
              </div>
              <p className="fineprint">Confirm train status, platform and coach details with the railway operator.</p>
            </article>
            <article className="transport-card">
              <div className="transport-icon">
                <CarFront />
              </div>
              <div className="transport-kicker">PRIVATE TRANSFER · DRIVER DETAILS TO FILL</div>
              <h3>Delhi ↔ Mountains</h3>
              <p className="transport-name">Private traveller / driver</p>
              <div className="editable-fields">
                <label>
                  Driver name
                  <input placeholder="Add driver name" />
                </label>
                <label>
                  Phone number
                  <input placeholder="Add contact number" />
                </label>
                <label>
                  Vehicle / registration
                  <input placeholder="Add vehicle details" />
                </label>
                <label>
                  Pickup notes
                  <input placeholder="Pickup point or agreed stops" />
                </label>
              </div>
              <button
                className="button dark"
                onClick={() =>
                  copy(
                    'Private traveller details\nDriver: [to confirm]\nPhone: [to confirm]\nVehicle: [to confirm]\nPickup Delhi: 24 Dec 2026, 6:00 PM planned\nReturn from Kasol: 2 Jan 2027, time unconfirmed',
                  )
                }
              >
                <Copy size={15} /> Copy transfer checklist
              </button>
              <p className="fineprint">Fields are for your notes only and are not saved to a server.</p>
            </article>
          </div>
        </section>
        <section id="flight" className="section">
          <div className="flight-card">
            <div className="flight-top">
              <div>
                <div className="eyebrow">FINAL JOURNEY · 03 JANUARY 2027</div>
                <h2>
                  Delhi <span>→</span> Pune
                </h2>
                <p>SpiceJet · SG105 · Direct flight</p>
              </div>
              <div className="flight-logo">
                <Plane />
              </div>
            </div>
            <div className="flight-line">
              <div>
                <small>DEPARTURE</small>
                <strong>9:00 <i>PM</i></strong>
                <b>DEL</b>
                <span>Delhi Indira Gandhi International</span>
              </div>
              <div className="plane-track">
                <span />
                <Plane />
                <span />
              </div>
              <div className="flight-arrive">
                <small>ARRIVAL · SAME DAY</small>
                <strong>11:10 <i>PM</i></strong>
                <b>PNQ</b>
                <span>Pune Airport</span>
              </div>
            </div>
            <div className="flight-specs">
              <div>
                <small>DURATION</small>
                <b>2h 10m</b>
              </div>
              <div>
                <small>AIRCRAFT</small>
                <b>Boeing 737 narrowbody*</b>
              </div>
              <div>
                <small>SEATING</small>
                <b>3–3 layout · 74 cm pitch*</b>
              </div>
              <div>
                <small>ONBOARD</small>
                <b>Light meal for fee · streaming*</b>
              </div>
            </div>
            <p className="fineprint">
              *Aircraft and onboard details are user-provided and can change. Reconfirm flight schedule, terminal,
              baggage allowance, check-in and operational status directly with SpiceJet. Flight details are not
              live-verified.
            </p>
          </div>
        </section>
        <BudgetCalculator />
        <section id="safety" className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">BE READY FOR THE MOUNTAINS</div>
              <h2>Winter safety checklist.</h2>
              <p>Tick these off before and during the trip. Your checklist is saved in this browser only.</p>
            </div>
            <span className="check-progress">{checked.length}/8 done</span>
          </div>
          <div className="safety-grid">
            {safetyChecklist.map((t) => (
              <label className={`check-item ${checked.includes(t) ? 'done' : ''}`} key={t}>
                <input
                  type="checkbox"
                  checked={checked.includes(t)}
                  onChange={(e) =>
                    setChecked((old) => (e.target.checked ? [...old, t] : old.filter((x) => x !== t)))
                  }
                />
                <span className="fake-check">
                  <CheckCircle2 />
                </span>
                <span>{t}</span>
              </label>
            ))}
          </div>
          <div className="alert">
            <ShieldCheck />
            <p>
              <b>Use local judgement over the itinerary.</b> These are planning notes, not live weather, road, medical
              or transport advice. If conditions deteriorate, delay or cancel a drive.
            </p>
          </div>
        </section>
        <footer className="footer">
          WINTER HIMACHAL <span>·</span> PERSONAL TRAVEL PLANNER <span>·</span> MAP DATA © OPENSTREETMAP CONTRIBUTORS
        </footer>
      </main>
      <div id="assistant">
        <TripAssistant />
      </div>
    </div>
  );
}
