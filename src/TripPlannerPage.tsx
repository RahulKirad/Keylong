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
  Thermometer,
} from 'lucide-react';
import { assignmentsForDay, subscribeAssignments } from './assignmentStore';
import SyncStatusBadge from './SyncStatusBadge';
import NavTempBadge from './NavTempBadge';
import AllenDraftModal from './AllenDraftModal';
import FinalRouteItineraryModal from './FinalRouteItineraryModal';
import { ALLEN_DRAFT } from './allenDraftAssets';
import { FINAL_ROUTE_ITINERARY } from './finalRouteItineraryAssets';
import BudgetCalculator from './BudgetCalculator';
import TripMap from './TripMap';
import TripAssistant from './TripAssistant';
import { openTripAssistant } from './assistantBridge';
import type { LatLng } from './routeUtils';
import type { Place } from './tripData';
import { mustCarryGroups, safetyCategories } from './tripData';
import {
  getDays,
  getPlaces,
  getSafetyChecklist,
  getTransportSegments,
  getTripMeta,
  subscribeItinerary,
} from './itineraryStore';

type RouteMode = 'all' | 'approach' | 'spiti' | 'return';

const ROUTE_SEGMENT_IDS: Record<RouteMode, string[]> = {
  all: [
    'pune',
    'mumbai',
    'delhi',
    'shimla',
    'narkanda',
    'sangla',
    'kalpa',
    'nako',
    'tabo',
    'kaza',
    'langza',
    'kufri',
    'delhi',
  ],
  approach: ['delhi', 'shimla', 'narkanda', 'sangla', 'kalpa'],
  spiti: ['kalpa', 'nako', 'tabo', 'kaza', 'langza'],
  return: ['kaza', 'tabo', 'nako', 'kalpa', 'narkanda', 'shimla', 'kufri', 'delhi'],
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
  const [selected, setSelected] = useState('shimla');
  const [routeMode, setRouteMode] = useState<RouteMode>('all');
  const [mobileNav, setMobileNav] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [allenDraft, setAllenDraft] = useState<{ open: boolean; tab: 'pdf' | 'ppt' }>({
    open: false,
    tab: 'pdf',
  });
  const [finalItineraryOpen, setFinalItineraryOpen] = useState(false);
  const [, setAssignmentTick] = useState(0);
  const [, setItineraryTick] = useState(0);

  useEffect(() => subscribeAssignments(() => setAssignmentTick((t) => t + 1)), []);
  useEffect(() => subscribeItinerary(() => setItineraryTick((t) => t + 1)), []);

  const places = getPlaces();
  const days = getDays();
  const safetyChecklist = getSafetyChecklist();
  const tripMeta = getTripMeta();
  const transportSegments = getTransportSegments();
  const trainRows = days.flatMap((day) =>
    day.scheduleRows.filter((row) => /train|rail|bdts|nzm|22917/i.test(`${row.mode} ${row.activity}`)),
  );
  const flightRows = days.flatMap((day) =>
    day.scheduleRows.filter((row) => /flight|airline|ai\d+/i.test(`${row.mode} ${row.activity} ${row.notes}`)),
  );
  const roadSegments = transportSegments.filter(
    (segment) => !/train|flight|pune → mumbai|mumbai → delhi|delhi → pune/i.test(segment.segment),
  );
  const trainHeadline =
    trainRows.find((row) => /22917|bdts|express/i.test(`${row.activity} ${row.notes}`))?.activity ||
    transportSegments.find((segment) => /train|22917/i.test(`${segment.segment} ${segment.mode}`))?.segment ||
    'Train legs';
  const flightHeadline =
    flightRows[0]?.activity ||
    transportSegments.find((segment) => /flight|delhi → pune/i.test(`${segment.segment} ${segment.mode}`))?.mode ||
    tripMeta.flight;

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
      places.filter((p) => (routeMode === 'all' ? true : ROUTE_SEGMENT_IDS[routeMode].includes(p.id))),
    [places, routeMode],
  );
  const routePlaces = useMemo(
    () => day.ids.map((id) => places.find((p) => p.id === id)).filter(Boolean) as Place[],
    [day, places],
  );
  const dayWaypoints = useMemo(() => routePlaces.map((p) => [p.lat, p.lng] as LatLng), [routePlaces]);
  const segmentWaypoints = useMemo(
    () =>
      ROUTE_SEGMENT_IDS[routeMode]
        .map((id) => places.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => [p!.lat, p!.lng] as LatLng),
    [places, routeMode],
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

  const routeTabs: RouteMode[] = ['all', 'approach', 'spiti', 'return'];
  const routeTabLabel: Record<RouteMode, string> = {
    all: 'Full route',
    approach: 'Approach',
    spiti: 'Spiti core',
    return: 'Return',
  };

  return (
    <div className="app">
      <header className="site-nav">
        <div className="site-nav-row site-nav-brand-row">
          <a href="#overview" className="nav-brand" onClick={closeNav}>
            <span className="brand-logo">
              <Mountain />
            </span>
            <span>
              <strong>SPITI</strong>
              <span className="brand-sub">TOUR 2026</span>
            </span>
          </a>
          <div className="nav-meta">
            <div className="nav-dates">
                <CalendarDays size={15} /> {tripMeta.dates}
            </div>
            <NavTempBadge />
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
                      {routeTabLabel[m]}
                    </button>
                  ))}
                </div>
                <nav className="nav-core">
                  <a href="#map" onClick={closeNav}>
                    <Route size={15} /> Map
                  </a>
                  <Link to="/trip-tables" onClick={closeNav}>
                    <CalendarDays size={15} /> Trip tables
                  </Link>
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
                  <Link to="/temperature" onClick={closeNav}>
                    <Thermometer size={15} /> Temperature
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
                  <Link to="/temperature" onClick={closeNav}>
                    <Thermometer size={15} /> Temperature calendar
                  </Link>
                  <Link to="/trip-tables" onClick={closeNav}>
                    <CalendarDays size={15} /> Trip tables page
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
              <span /> YOUR SPITI WINTER ROAD TRIP
            </div>
            <h1>
              Spiti<br />
              <i>Tour 2026.</i>
            </h1>
            <p>
              Pune to Spiti via Shimla, Sangla, Kalpa, Kaza and Langza — then home through Kufri and Delhi. Edit the
              live tables whenever the plan changes.
            </p>
            <div className="hero-meta">
              <span>
                <CalendarDays /> {tripMeta.dates}
              </span>
              <span>
                <MapPin /> Kinnaur · Spiti
              </span>
            </div>
            <div className="hero-actions">
              <Link to="/trip-tables" className="button light">
                Edit trip tables <ArrowRight size={16} />
              </Link>
              <a href="#map" className="button outline">
                Open interactive map
              </a>
            </div>
          </div>
          <div className="hero-index">SPITI TOUR / 01</div>
        </section>
        <section className="stats">
          <div className="stat">
            <CalendarDays />
            <small>TRIP DURATION</small>
            <strong>{days.length} days</strong>
            <span>23 Dec — 03 Jan</span>
          </div>
          <div className="stat">
            <Mountain />
            <small>REGIONS</small>
            <strong>8 phases</strong>
            <span>Kinnaur + Spiti</span>
          </div>
          <div className="stat">
            <Route />
            <small>ROUTE STOPS</small>
            <strong>{places.length} places</strong>
            <span>Transit + overnight bases</span>
          </div>
          <div className="stat">
            <Plane />
            <small>FINAL FLIGHT</small>
            <strong>AI9825</strong>
            <span>DEL 22:10 → PNQ 00:30+1</span>
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
              places={shown.map((p) => ({
                id: p.id,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                kind: p.kind,
                stayType: p.stayType,
                stayName: p.stayName,
              }))}
              onSelectPlace={(id) => {
                const p = places.find((x) => x.id === id);
                if (p) choosePlace(p);
              }}
            />
            <aside className="place-panel">
              <div className="panel-top">
                <span className="panel-tag">{chosen.region.toUpperCase()}</span>
                {chosen.isHalt ? <span className="panel-tag panel-tag-halt">HALT</span> : null}
                <span className="altitude">{chosen.alt}</span>
              </div>
              <h3>{chosen.name}</h3>
              <div className="place-kind">
                <MapPin size={14} />
                {chosen.isHalt ? 'Overnight halt · ' : ''}
                {chosen.kind}
              </div>
              {chosen.stayName?.trim() ? (
                <p className="place-stay">
                  <b>{chosen.stayType ? `${chosen.stayType[0].toUpperCase()}${chosen.stayType.slice(1)}` : 'Stay'}:</b>{' '}
                  {chosen.stayName}
                </p>
              ) : chosen.isHalt ? (
                <p className="place-stay muted">
                  Stay / hotel name not set — add it on the <Link to="/trip-tables">Trip tables</Link> page.
                </p>
              ) : null}
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
              <div className="eyebrow">{days.length} DAYS · SPITI TOUR 2026</div>
              <h2>Day by day, at your pace.</h2>
              <p>
                Select a day to move the map route and open that day’s practical notes. Days with assigned tasks are
                highlighted — add tasks on the <Link to="/assignments">Assignments</Link> page or via the assistant.
              </p>
            </div>
            <div className="small-counter">
              {String(activeDay + 1).padStart(2, '0')} <span>/ {days.length}</span>
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
              <p>
                Pulled live from the <Link to="/trip-tables">Trip tables</Link> page after you tap Update trip. Change a
                train row there
                and it appears here.
              </p>
            </div>
          </div>
          <div className="transport-grid">
            <article className="transport-card">
              <div className="transport-icon">
                <TrainFront />
              </div>
              <div className="transport-kicker">RAIL · FROM TRIP TABLES</div>
              <h3>{trainHeadline}</h3>
              <p className="transport-name">{tripMeta.train}</p>
              <div className="timeline">
                {trainRows.length > 0 ? (
                  trainRows.slice(0, 4).map((row) => (
                    <div key={row.id}>
                      <span className="timeline-dot" />
                      <small>{row.when}</small>
                      <b>{row.activity}</b>
                      <p>
                        {row.mode}
                        {row.notes ? ` · ${row.notes}` : ''}
                        {row.overnight ? ` · Stay: ${row.overnight}` : ''}
                      </p>
                    </div>
                  ))
                ) : (
                  <div>
                    <span className="timeline-dot" />
                    <small>NO TRAIN ROWS YET</small>
                    <b>
                      Add train details on the <Link to="/trip-tables">Trip tables</Link> page
                    </b>
                    <p>Use mode “Train” on Day 1–2 rows, then Update trip.</p>
                  </div>
                )}
              </div>
              <p className="fineprint">Confirm train status, platform and coach details with the railway operator.</p>
            </article>
            <article className="transport-card">
              <div className="transport-icon">
                <CarFront />
              </div>
              <div className="transport-kicker">BUS + PRIVATE CAB · FROM TRIP TABLES</div>
              <h3>Road transfers</h3>
              <p className="transport-name">{tripMeta.privateTransfer}</p>
              <ul className="transport-live-list">
                {roadSegments.slice(0, 6).map((segment) => (
                  <li key={segment.id}>
                    <b>{segment.segment}</b>
                    <span>
                      {segment.mode} — {segment.book}
                    </span>
                  </li>
                ))}
              </ul>
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
                  <input placeholder="Bus boarding point / cab pickup notes" />
                </label>
              </div>
              <button
                className="button dark"
                onClick={() =>
                  copy(
                    `Spiti Tour road notes\nDriver: [to confirm]\nPhone: [to confirm]\nVehicle: [to confirm]\n\n${tripMeta.privateTransfer}`,
                  )
                }
              >
                <Copy size={15} /> Copy transfer checklist
              </button>
              <p className="fineprint">
                Booking rows sync from the Trip tables page. Driver fields here are local notes only.
              </p>
            </article>
          </div>
        </section>
        <section id="flight" className="section">
          <div className="flight-card">
            <div className="flight-top">
              <div>
                <div className="eyebrow">FLIGHT · FROM TRIP TABLES</div>
                <h2>
                  Delhi <span>→</span> Pune
                </h2>
                <p>{flightHeadline}</p>
              </div>
              <div className="flight-logo">
                <Plane />
              </div>
            </div>
            <div className="flight-line">
              {flightRows.length > 0 ? (
                flightRows.slice(0, 2).map((row) => (
                  <div key={row.id}>
                    <small>{row.when}</small>
                    <strong>{row.activity}</strong>
                    <b>{row.mode}</b>
                    <span>
                      {row.notes}
                      {row.overnight ? ` · ${row.overnight}` : ''}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <div>
                    <small>DEPARTURE / ARRIVAL</small>
                    <strong>See trip tables</strong>
                    <b>Flight</b>
                    <span>{tripMeta.flight}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flight-specs">
              <div>
                <small>SUMMARY</small>
                <b>{tripMeta.flight}</b>
              </div>
            </div>
            <p className="fineprint">
              Edit the Day 12 flight row (or Delhi → Pune booking row) on the{' '}
              <Link to="/trip-tables">Trip tables</Link> page, then Update trip to refresh this
              card, the PDF and the assistant.
            </p>
          </div>
        </section>
        <BudgetCalculator />
        <section id="safety" className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">BE READY FOR THE MOUNTAINS</div>
              <h2>Winter safety & must-carry guide.</h2>
              <p>
                Detailed Spiti winter concerns — weather, calamities, altitude, women travellers, and packing. Tick
                items off; progress is saved in this browser only.
              </p>
            </div>
            <span className="check-progress">
              {checked.length}/{safetyChecklist.length} done
            </span>
          </div>

          <div className="safety-guide">
            {safetyCategories.map((category) => (
              <article key={category.id} className="safety-category">
                <header>
                  <h3>{category.title}</h3>
                  <p>{category.intro}</p>
                </header>
                <div className="safety-grid">
                  {category.points.map((t) => (
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
              </article>
            ))}
          </div>

          <div className="must-carry-block">
            <div className="section-head">
              <div>
                <div className="eyebrow">PACK BEFORE YOU LEAVE</div>
                <h3>Must-have items to carry</h3>
                <p>Winter Spiti essentials — clothing, health, documents and daypack. Tick as you pack.</p>
              </div>
            </div>
            <div className="must-carry-grid">
              {mustCarryGroups.map((group) => (
                <article key={group.id} className="must-carry-card">
                  <h4>{group.title}</h4>
                  <div className="safety-grid must-carry-list">
                    {group.items.map((item) => {
                      const line = `${group.title}: ${item}`;
                      return (
                        <label className={`check-item ${checked.includes(line) ? 'done' : ''}`} key={line}>
                          <input
                            type="checkbox"
                            checked={checked.includes(line)}
                            onChange={(e) =>
                              setChecked((old) =>
                                e.target.checked ? [...old, line] : old.filter((x) => x !== line),
                              )
                            }
                          />
                          <span className="fake-check">
                            <CheckCircle2 />
                          </span>
                          <span>{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="alert">
            <ShieldCheck />
            <p>
              <b>Use local judgement over the itinerary.</b> These are planning notes, not live weather, road, medical
              or transport advice. If conditions deteriorate, delay or cancel a drive. Women travellers: stick to the
              buddy system and raise concerns early with the group.
            </p>
          </div>
        </section>
        <footer className="footer">
          SPITI TOUR 2026 <span>·</span> PERSONAL TRAVEL PLANNER <span>·</span> MAP DATA © OPENSTREETMAP CONTRIBUTORS
        </footer>
      </main>
      <div id="assistant">
        <TripAssistant />
      </div>
    </div>
  );
}
