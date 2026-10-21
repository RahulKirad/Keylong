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
} from 'lucide-react';
import {
  GEMINI_MODEL_OPTIONS,
  GeminiConfig,
  GeminiModelOption,
  loadGeminiConfig,
  mergeModelOptions,
  saveGeminiConfig,
} from './geminiConfig';
import { ChatTurn, listGeminiModels, parseAssistantReply, sendToGemini } from './geminiClient';
import { downloadTripPdf } from './pdfExport';
import type { PdfKind } from './geminiClient';
import ChatFormattedText from './ChatFormattedText';
import { registerAssistantOpener, type AssistantMode } from './assistantBridge';
import { addExpense, queuePendingUtterance } from './expenseStore';
import { parseExpenseUtterance } from './expenseParse';

type Message = { id: string; role: 'user' | 'assistant'; text: string; meta?: string };

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

const EXPENSE_WELCOME =
  '**Expense mode** — say something like: “25 December dinner 2000 rupees paid by Rahul”. I’ll add it to your **Expenses** table and update each person’s total. Add traveller names on the Expenses page first.';

export default function TripAssistant() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('trip');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<GeminiConfig>(() => loadGeminiConfig());
  const [draftKey, setDraftKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', text: TRIP_WELCOME },
  ]);
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
    if (settingsOpen) setDraftKey(config.apiKey);
  }, [settingsOpen, config.apiKey]);

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

  const saveSettings = () => {
    const next = { ...config, apiKey: draftKey.trim() };
    setConfig(next);
    saveGeminiConfig(next);
    setVoiceMode(next.voiceEnabled);
    setSettingsOpen(false);
  };

  const runPdf = (kind: PdfKind) => {
    downloadTripPdf(kind);
    setMessages((m) => [
      ...m,
      { id: `pdf-${Date.now()}`, role: 'assistant', text: `Downloaded **${kind}** PDF to your device.` },
    ]);
  };

  const handleExpenseUtterance = async (trimmed: string): Promise<{ text: string; meta?: string }> => {
    const online = navigator.onLine;
    try {
      const parsed = await parseExpenseUtterance(trimmed, config, online);
      addExpense(parsed);
      return {
        text: `Recorded expense\n\n• **${parsed.dateLabel}** — ${parsed.description}\n• **Amount:** ₹${parsed.amountInr.toLocaleString('en-IN')}\n• **Paid by:** ${parsed.paidByName}\n• **Category:** ${parsed.category}\n\nTotals updated on the **Expenses** page.`,
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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: trimmed }]);
      setInput('');
      setLoading(true);

      try {
        if (mode === 'expense') {
          const { text: reply, meta } = await handleExpenseUtterance(trimmed);
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: reply, meta }]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          setLoading(false);
          return;
        }

        const { text: reply, modelUsed } = await sendToGemini(
          config,
          historyRef.current,
          trimmed,
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

        setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: displayText, meta }]);
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
      setMessages([
        {
          id: `mode-${Date.now()}`,
          role: 'assistant',
          text: m === 'expense' ? EXPENSE_WELCOME : TRIP_WELCOME,
        },
      ]);
      if (m === 'expense') window.setTimeout(() => startListenRef.current(), 500);
    });
  }, []);

  const switchMode = (m: AssistantMode) => {
    setMode(m);
    setMessages([
      { id: `sw-${Date.now()}`, role: 'assistant', text: m === 'expense' ? EXPENSE_WELCOME : TRIP_WELCOME },
    ]);
    if (m === 'expense') window.setTimeout(() => startListenRef.current(), 500);
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
                <strong>{mode === 'expense' ? 'Expense assistant' : 'Trip assistant'}</strong>
                <span>Gemini · voice & chat</span>
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
          </div>

          {!config.apiKey && mode === 'trip' && (
            <div className="assistant-banner">
              Add your <button type="button" onClick={() => setSettingsOpen(true)}>Gemini API key</button> in settings.
            </div>
          )}

          {mode === 'trip' && (
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
              </div>
            ))}
            {loading && (
              <div className="assistant-bubble assistant-loading">
                <Loader2 size={16} className="spin" /> Thinking…
              </div>
            )}
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
                  : mode === 'expense'
                    ? 'e.g. 25 Dec dinner 2000 Rahul…'
                    : 'Ask about your trip…'
              }
              disabled={loading}
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
            <p>Calls Google Gemini from your browser. Key stored in localStorage only.</p>
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
