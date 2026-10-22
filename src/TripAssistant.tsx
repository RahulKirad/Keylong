import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Settings,
  X,
  Volume2,
  VolumeX,
  Download,
  Loader2,
  Wallet,
  ArrowRight,
  ClipboardList,
  IdCard,
} from 'lucide-react';
import {
  GEMINI_MODEL_OPTIONS,
  GeminiConfig,
  GeminiModelOption,
  fetchSharedGeminiConfig,
  loadGeminiConfig,
  mergeModelOptions,
  publishSharedGeminiConfig,
  saveGeminiConfig,
} from './geminiConfig';
import { ChatTurn, listGeminiModels, parseAssistantReply, sendToGemini } from './geminiClient';
import { downloadTripPdf } from './pdfExport';
import type { PdfKind } from './geminiClient';
import ChatFormattedText from './ChatFormattedText';
import {
  navigateToAssignments,
  navigateToExpenses,
  navigateToIdProof,
  registerAssistantOpener,
  type AssistantMode,
} from './assistantBridge';
import { addAssignment } from './assignmentStore';
import { parseAssignmentUtterance } from './assignmentParse';
import { addExpense, addFundTransfer, getExpenseState, queuePendingUtterance } from './expenseStore';
import { memberBalanceRemaining } from './expenseLedger';
import { parseMoneyUtterance } from './expenseParse';
import { getSelectedTraveller, setSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
import { days } from './tripData';
import {
  briefForName,
  formatPersonalReply,
  listTravellerNames,
  topicsFromQuestion,
  wantsPersonalCopy,
  type PersonalTopic,
} from './travellerBrief';
import { downloadPersonalPdf } from './travellerPdf';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
  expensesLink?: boolean;
  assignmentsLink?: boolean;
  idLink?: boolean;
  pdfTopics?: PersonalTopic[];
};

const ASK_NAME =
  'Who are you on this trip? Tap your name above the message box. The chat starts after that.';

function goToExpensesPage(closePanel = true) {
  if (closePanel) window.dispatchEvent(new CustomEvent('assistant-close-request'));
  window.requestAnimationFrame(() => navigateToExpenses());
}

function goToAssignmentsPage(closePanel = true) {
  if (closePanel) window.dispatchEvent(new CustomEvent('assistant-close-request'));
  window.requestAnimationFrame(() => navigateToAssignments());
}

function goToIdProof(closePanel = true, show = false) {
  if (closePanel) window.dispatchEvent(new CustomEvent('assistant-close-request'));
  window.requestAnimationFrame(() => navigateToIdProof(show));
}

function wantsExpensesNav(assistantText: string, userText?: string): boolean {
  const blob = `${assistantText} ${userText || ''}`.toLowerCase();
  return /expense|expenses page|spent|spending|tally|group money|who paid|cost split/.test(blob);
}

function speak(text: string, lang: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const plain = text.replace(/\*\*/g, '');
  const u = new SpeechSynthesisUtterance(plain);
  u.lang = lang;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

function stopSpeaking() {
  window.speechSynthesis?.cancel();
}

const TRIP_WELCOME =
  'Hi! I’m your **Winter Himachal** trip assistant. Ask about days, places, transport, or packing. Say “download itinerary PDF” when you need documents. Tap **mic** to talk.';

const ASSIGNMENTS_WELCOME =
  '**Assign tasks** — say who should do what, e.g. “Rahul is assigned to book the train tickets for 23rd” or “Sanket will confirm Kasol stay for 30 Dec”. I’ll add it to **Assignments** and highlight that day in the **itinerary**.';

function welcomeForMode(m: AssistantMode, name: string): string {
  const expense = `**Log expense** is for **${name}**. Say the date, what was bought, and the amount — for example “25 Dec dinner 2000 cash”. I will record it as paid by **${name}**. To hand someone cash, say “gave 5000 cash to another traveller”.`;
  const body = m === 'expense' ? expense : m === 'assignments' ? ASSIGNMENTS_WELCOME : TRIP_WELCOME;
  return `Hi **${name}**. I will use your records when you ask about tasks, expenses, or spending.\n\n${body}`;
}

function openingMessages(mode: AssistantMode, name: string | null): Message[] {
  return [
    {
      id: `open-${mode}-${name || 'ask'}`,
      role: 'assistant',
      text: name ? welcomeForMode(mode, name) : ASK_NAME,
    },
  ];
}

function shouldStartMic(m: AssistantMode): boolean {
  return m === 'expense' || m === 'assignments';
}

export default function TripAssistant() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('assistant-close-request', close);
    return () => window.removeEventListener('assistant-close-request', close);
  }, []);
  const [mode, setMode] = useState<AssistantMode>('trip');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<GeminiConfig>(() => loadGeminiConfig());
  const [draftKey, setDraftKey] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(() => getSelectedTraveller());
  const [names, setNames] = useState<string[]>(() => listTravellerNames());
  const offeredTopicsRef = useRef<PersonalTopic[]>([]);
  const selectedNameRef = useRef<string | null>(getSelectedTraveller());
  const [messages, setMessages] = useState<Message[]>(() => openingMessages('trip', getSelectedTraveller()));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(config.voiceEnabled);
  const [modelOptions, setModelOptions] = useState<GeminiModelOption[]>(GEMINI_MODEL_OPTIONS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsListNote, setModelsListNote] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ChatTurn[]>([]);

  const startListenRef = useRef<() => void>(() => {});

  useEffect(() => {
    selectedNameRef.current = selectedName;
  }, [selectedName]);

  useEffect(() => {
    const refreshNames = () => setNames(listTravellerNames());
    window.addEventListener('expenses-updated', refreshNames);
    return () => window.removeEventListener('expenses-updated', refreshNames);
  }, []);

  const applySelectedName = (name: string) => {
    if (selectedNameRef.current === name) return;
    const starting = !selectedNameRef.current;
    setSelectedName(name);
    selectedNameRef.current = name;
    if (starting) {
      setMessages(openingMessages(mode, name));
      if (shouldStartMic(mode)) window.setTimeout(() => startListenRef.current(), 500);
      return;
    }
    setMessages((current) => [
      ...current,
      {
        id: `hello-${Date.now()}`,
        role: 'assistant',
        text: `Hi **${name}**. I'll use your records from here.`,
      },
    ]);
  };

  const chooseName = (name: string) => {
    if (selectedNameRef.current === name) return;
    setSelectedTraveller(name);
  };

  useEffect(
    () =>
      subscribeSelectedTraveller((name) => {
        if (name) applySelectedName(name);
      }),
    [mode],
  );

  useEffect(() => {
    if (settingsOpen) setDraftKey(config.apiKey);
  }, [settingsOpen, config.apiKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = loadGeminiConfig();
      try {
        const shared = await fetchSharedGeminiConfig();
        if (cancelled) return;
        if (shared?.apiKey) {
          const next = { ...local, apiKey: shared.apiKey, model: shared.model || local.model };
          setConfig(next);
          setDraftKey(next.apiKey);
          setVoiceMode(next.voiceEnabled);
          saveGeminiConfig(next);
          return;
        }
        if (local.apiKey.trim()) {
          await publishSharedGeminiConfig({ apiKey: local.apiKey, model: local.model });
        }
      } catch {
        // Keep the key already stored in this browser if the server is unreachable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshModels = useCallback(async (key?: string) => {
    const apiKey = (key ?? draftKey ?? config.apiKey).trim();
    if (!apiKey) {
      setModelOptions(GEMINI_MODEL_OPTIONS);
      setModelsListNote('Add API key, then refresh to load models from your account.');
      return;
    }
    setModelsLoading(true);
    setModelsListNote('');
    try {
      const ids = await listGeminiModels(apiKey);
      setModelOptions(mergeModelOptions(ids));
      setModelsListNote(ids.length ? `${ids.length} models available for your key.` : 'Using built-in list.');
    } catch (e) {
      setModelOptions(GEMINI_MODEL_OPTIONS);
      setModelsListNote(e instanceof Error ? e.message : 'Could not refresh; using built-in list.');
    } finally {
      setModelsLoading(false);
    }
  }, [config.apiKey, draftKey]);

  useEffect(() => {
    if (!settingsOpen) return;
    if (config.apiKey.trim()) refreshModels(config.apiKey);
    else {
      setModelOptions(GEMINI_MODEL_OPTIONS);
      setModelsListNote('Built-in models below. Add key and refresh for your account list.');
    }
  }, [settingsOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const saveSettings = async () => {
    const next = { ...config, apiKey: draftKey.trim() };
    setConfig(next);
    saveGeminiConfig(next);
    setVoiceMode(next.voiceEnabled);
    try {
      await publishSharedGeminiConfig({ apiKey: next.apiKey, model: next.model });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save the shared Gemini key');
      return;
    }
    setSettingsOpen(false);
  };

  const runPdf = (kind: PdfKind) => {
    downloadTripPdf(kind);
    setMessages((m) => [
      ...m,
      { id: `pdf-${Date.now()}`, role: 'assistant', text: `Downloaded **${kind}** PDF to your device.` },
    ]);
  };

  const handleExpenseUtterance = async (
    trimmed: string,
    person: string,
  ): Promise<{ text: string; meta?: string }> => {
    const online = navigator.onLine;
    try {
      const parsed = await parseMoneyUtterance(trimmed, config, online, person);
      if (parsed.kind === 'give') {
        addFundTransfer(parsed);
        const { transfers, expenses } = getExpenseState();
        const left = memberBalanceRemaining(parsed.toPersonId, transfers, expenses);
        const pay =
          parsed.paymentMethod === 'cash'
            ? 'Cash'
            : parsed.paymentMethod === 'online'
              ? 'Online'
              : 'Payment not specified';
        return {
          text: `Recorded money given\n\n• **${parsed.fromPersonName}** → **${parsed.toPersonName}**\n• **Amount:** ₹${parsed.amountInr.toLocaleString('en-IN')} (${pay})\n• **${parsed.toPersonName}'s balance** to spend: **₹${left.toLocaleString('en-IN')}**\n\nSee the traveller table on **Winter Himachal Expenses**.`,
        };
      }
      const record = addExpense(parsed);
      const { transfers, expenses } = getExpenseState();
      const pay =
        record.paymentMethod === 'cash'
          ? 'Cash'
          : record.paymentMethod === 'online'
            ? 'Online'
            : 'Not specified';
      let balanceLine = '';
      if (record.spentFromBalance) {
        const holderId = record.balanceHolderPersonId || record.paidByPersonId;
        const left = memberBalanceRemaining(holderId, transfers, expenses);
        balanceLine = `\n• **From balance** (${record.balanceHolderName || record.paidByName}'s pool): **₹${record.amountInr.toLocaleString('en-IN')}** deducted. Remaining balance: **₹${left.toLocaleString('en-IN')}**.`;
      }
      const givenLine = record.givenByName ? `\n• **Originally from:** ${record.givenByName}` : '';
      return {
        text: `Recorded expense\n\n• **${record.dateLabel}** — ${record.description}\n• **Amount:** ₹${record.amountInr.toLocaleString('en-IN')} (${pay})\n• **Paid by:** ${record.paidByName}\n• **Category:** ${record.category}${balanceLine}${givenLine}\n\nUpdated on **Winter Himachal Expenses**.`,
      };
    } catch (e) {
      if (!online) {
        queuePendingUtterance(trimmed);
        return {
          text: 'You’re **offline**. I saved your note and will parse it with AI when the network returns. You can also edit rows on the **Expenses** page.',
        };
      }
      throw e;
    }
  };

  const handleAssignmentUtterance = async (trimmed: string): Promise<{ text: string }> => {
    const online = navigator.onLine;
    const parsed = await parseAssignmentUtterance(trimmed, config, online);
    const record = addAssignment(parsed);
    const dayTitle =
      record.tripDayNumber != null ? days.find((d) => d.day === record.tripDayNumber)?.title : undefined;
    const dayLine = record.tripDayNumber != null
      ? `\n• **Itinerary:** Day ${record.tripDayNumber}${dayTitle ? ` — ${dayTitle}` : ''} (${record.dateLabel || 'linked'})`
      : '\n• **Itinerary:** not linked to a specific day (edit on Assignments page if needed)';
    return {
      text: `Task assigned\n\n• **${record.assigneeName}:** ${record.task}${dayLine}\n\nSee **Assignments** and the highlighted day on the trip **itinerary**.`,
    };
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: trimmed }]);
      setInput('');
      setLoading(true);

      try {
        const person = selectedNameRef.current;
        if (!person) {
          setMessages((m) => [
            ...m,
            { id: `a-${Date.now()}`, role: 'assistant', text: ASK_NAME },
          ]);
          return;
        }

        if (wantsPersonalCopy(trimmed) && offeredTopicsRef.current.length) {
          const pdfTopics = [...new Set([...offeredTopicsRef.current, 'spending' as const, 'expenses' as const])];
          downloadPersonalPdf(person, pdfTopics);
          setMessages((m) => [
            ...m,
            {
              id: `pdf-${Date.now()}`,
              role: 'assistant',
              text: `Downloaded **${person}**'s PDF. It includes the total spent, any balance left, and the tables for what you asked about.`,
            },
          ]);
          return;
        }

        const topics = topicsFromQuestion(trimmed);
        const loggingRecord = /\b(is assigned|will |should |paid by|rupees|rs\.?\s*\d|\d+\s*(rupee|inr))\b/i.test(trimmed);
        const expenseEntry = mode === 'expense' && /\d/.test(trimmed) && !trimmed.includes('?') && !/^(what|show|tell|how|list|do i|did i)\b/i.test(trimmed);
        if (topics && !loggingRecord && !expenseEntry) {
          offeredTopicsRef.current = [...new Set([...offeredTopicsRef.current, ...topics])];
          const reply = formatPersonalReply(briefForName(person), topics);
          setMessages((m) => [
            ...m,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: reply,
              pdfTopics: [...offeredTopicsRef.current],
              expensesLink: topics.includes('expenses') || topics.includes('spending'),
              assignmentsLink: topics.includes('tasks'),
              idLink: topics.includes('identity'),
            },
          ]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          return;
        }

        if (mode === 'expense') {
          const { text: reply, meta } = await handleExpenseUtterance(trimmed, person);
          setMessages((m) => [
            ...m,
            { id: `a-${Date.now()}`, role: 'assistant', text: reply, meta, expensesLink: true },
          ]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          setLoading(false);
          return;
        }

        if (mode === 'assignments') {
          const { text: reply } = await handleAssignmentUtterance(trimmed);
          setMessages((m) => [
            ...m,
            { id: `a-${Date.now()}`, role: 'assistant', text: reply, assignmentsLink: true },
          ]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          setLoading(false);
          return;
        }

        const { text: reply, modelUsed } = await sendToGemini(
          config,
          historyRef.current,
          `The traveller speaking is ${person}. If they ask about tasks, expenses, or spending, answer only for ${person}.\n\n${trimmed}`,
          modelOptions.map((m) => m.id),
        );
        historyRef.current = [
          ...historyRef.current,
          { role: 'user' as const, text: trimmed },
          { role: 'model' as const, text: reply },
        ].slice(-20);

        const { displayText, pdfKind } = parseAssistantReply(reply);
        if (pdfKind) runPdf(pdfKind);

        const meta =
          modelUsed !== config.model ? `Used ${modelUsed} (primary model was busy)` : undefined;

        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: displayText,
            meta,
            expensesLink: wantsExpensesNav(displayText, trimmed),
          },
        ]);
        if (voiceMode && config.voiceEnabled) speak(displayText, config.voiceLang);
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Something went wrong.';
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: 'assistant', text: err }]);
      } finally {
        setLoading(false);
      }
    },
    [config, loading, voiceMode, modelOptions, mode],
  );

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const startListening = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    stopSpeaking();
    const rec = new Ctor();
    rec.lang = config.voiceLang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const transcript = Array.from(ev.results).map((r) => r[0].transcript).join('');
      setInput(transcript);
      if (ev.results[0]?.isFinal) {
        setListening(false);
        rec.stop();
        sendMessage(transcript);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  startListenRef.current = startListening;

  useEffect(() => {
    registerAssistantOpener((m) => {
      setMode(m);
      setOpen(true);
      setMessages(openingMessages(m, selectedNameRef.current));
      if (selectedNameRef.current && shouldStartMic(m)) window.setTimeout(() => startListenRef.current(), 500);
    });
  }, []);

  const switchMode = (m: AssistantMode) => {
    setMode(m);
    setMessages(openingMessages(m, selectedName));
    if (selectedName && shouldStartMic(m)) window.setTimeout(() => startListenRef.current(), 500);
  };

  const pdfButtons: { kind: PdfKind; label: string }[] = [
    { kind: 'itinerary', label: 'Itinerary' },
    { kind: 'transport', label: 'Transport' },
    { kind: 'safety', label: 'Safety' },
    { kind: 'full', label: 'Full pack' },
  ];

  return (
    <>
      <button
        type="button"
        className="assistant-fab"
        aria-label="AI assistant"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={24} /> : <Bot size={24} />}
      </button>

      {open && (
        <div className="assistant-panel assistant-panel-lg" role="dialog" aria-label="AI assistant">
          <header className="assistant-head">
            <div className="assistant-head-title">
              <span className="assistant-symbol" aria-hidden="true"><Bot size={22} /></span>
              <div>
                <strong>
                  {mode === 'expense'
                    ? 'Expense assistant'
                    : mode === 'assignments'
                      ? 'Assignment assistant'
                      : 'Trip assistant'}
                </strong>
                <span>{selectedName ? `Signed in as ${selectedName}` : 'Pick your name to start'}</span>
              </div>
            </div>
            <div className="assistant-head-actions">
              <button type="button" aria-label={voiceMode ? 'Voice on' : 'Voice off'} onClick={() => {
                const v = !voiceMode;
                setVoiceMode(v);
                const next = { ...config, voiceEnabled: v };
                setConfig(next);
                saveGeminiConfig(next);
                if (!v) stopSpeaking();
              }}>
                {voiceMode ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
              </button>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="assistant-mode-row">
            <button type="button" className={mode === 'trip' ? 'on' : ''} onClick={() => switchMode('trip')}>
              Trip Q&A
            </button>
            <button type="button" className={mode === 'expense' ? 'on' : ''} onClick={() => switchMode('expense')}>
              <Wallet size={14} /> Log expense
            </button>
            <button type="button" className={mode === 'assignments' ? 'on' : ''} onClick={() => switchMode('assignments')}>
              <ClipboardList size={14} /> Assign tasks
            </button>
            <button type="button" className="assistant-goto-expenses-bar" onClick={() => goToExpensesPage(true)}>
              <Wallet size={14} /> Expenses
            </button>
            <button type="button" className="assistant-goto-expenses-bar" onClick={() => goToAssignmentsPage(true)}>
              <ClipboardList size={14} /> Assignments
            </button>
            <button type="button" className="assistant-goto-expenses-bar" onClick={() => goToIdProof(true, false)}>
              <IdCard size={14} /> ID proof
            </button>
          </div>

          {!config.apiKey && mode === 'trip' && selectedName && (
            <div className="assistant-banner">
              Add your <button type="button" onClick={() => setSettingsOpen(true)}>Gemini API key</button> in settings.
            </div>
          )}

          {mode === 'trip' && selectedName && (
            <div className="assistant-pdf-row">
              {pdfButtons.map((b) => (
                <button key={b.kind} type="button" onClick={() => runPdf(b.kind)}>
                  <Download size={12} /> {b.label}
                </button>
              ))}
            </div>
          )}

          <div className="assistant-messages" ref={listRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`assistant-bubble ${msg.role}`}>
                {msg.role === 'assistant' ? <ChatFormattedText text={msg.text} /> : msg.text}
                {msg.meta && <div className="assistant-meta">{msg.meta}</div>}
                {msg.role === 'assistant' && msg.expensesLink && (
                  <button type="button" className="assistant-goto-expenses" onClick={() => goToExpensesPage(true)}>
                    Open expenses list <ArrowRight size={14} />
                  </button>
                )}
                {msg.role === 'assistant' && msg.pdfTopics && msg.pdfTopics.length > 0 && selectedName && (
                  <button
                    type="button"
                    className="assistant-goto-expenses"
                    onClick={() => {
                      const topics = [...new Set([...(msg.pdfTopics || []), 'spending' as const, 'expenses' as const])];
                      downloadPersonalPdf(selectedName, topics);
                    }}
                  >
                    <Download size={14} /> Download my PDF
                  </button>
                )}
                {msg.role === 'assistant' && msg.assignmentsLink && (
                  <button type="button" className="assistant-goto-expenses" onClick={() => goToAssignmentsPage(true)}>
                    Open assignments <ArrowRight size={14} />
                  </button>
                )}
                {msg.role === 'assistant' && msg.idLink && (
                  <button type="button" className="assistant-goto-expenses" onClick={() => goToIdProof(true, true)}>
                    <IdCard size={14} /> Show ID for check-in
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="assistant-bubble assistant-loading">
                <Loader2 size={16} className="spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="assistant-name-row">
            <span className="assistant-name-label">{selectedName ? 'You are' : 'Tap your name to start'}</span>
            {names.map((name) => (
              <button
                key={name}
                type="button"
                className={selectedName === name ? 'on' : ''}
                onClick={() => chooseName(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <form
            className="assistant-compose"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <button
              type="button"
              className={`assistant-mic ${listening ? 'on' : ''}`}
              aria-label={listening ? 'Stop' : 'Speak'}
              disabled={!selectedName}
              onClick={() => (listening ? stopListening() : startListening())}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                listening
                  ? 'Listening…'
                  : !selectedName
                    ? 'Chat starts after you pick a name'
                  : mode === 'expense'
                    ? `Log an expense for ${selectedName}…`
                    : mode === 'assignments'
                      ? 'e.g. Rahul is assigned to book train tickets for 23rd…'
                      : `Ask about your tasks or spending, ${selectedName}…`
              }
              disabled={loading || !selectedName}
            />
            <button type="submit" className="assistant-send" disabled={loading || !input.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="assistant-settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="assistant-settings" onClick={(e) => e.stopPropagation()}>
            <h3>AI configuration</h3>
            <p>One Gemini key for this site. Save it once and every browser — Chrome, Edge, and the rest — uses that same key.</p>
            <label>
              Gemini API key
              <input
                type="password"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
              />
            </label>
            <label>
              Model
              <select
                value={modelOptions.some((m) => m.id === config.model) ? config.model : modelOptions[0]?.id}
                onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <button type="button" className="assistant-refresh-models" disabled={modelsLoading} onClick={() => refreshModels()}>
              {modelsLoading ? 'Loading…' : 'Refresh model list from API'}
            </button>
            {modelsListNote && <p className="assistant-models-note">{modelsListNote}</p>}
            <label>
              Voice language
              <select value={config.voiceLang} onChange={(e) => setConfig((c) => ({ ...c, voiceLang: e.target.value }))}>
                <option value="en-IN">English (India)</option>
                <option value="en-US">English (US)</option>
                <option value="hi-IN">Hindi (India)</option>
              </select>
            </label>
            <label className="assistant-check">
              <input
                type="checkbox"
                checked={config.voiceEnabled}
                onChange={(e) => setConfig((c) => ({ ...c, voiceEnabled: e.target.checked }))}
              />
              Speak replies aloud
            </label>
            <div className="assistant-settings-actions">
              <button type="button" className="button pale" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button type="button" className="button dark" onClick={saveSettings}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
