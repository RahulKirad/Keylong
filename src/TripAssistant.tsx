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

type Message = { id: string; role: 'user' | 'assistant'; text: string };

function speak(text: string, lang: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 1;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

function stopSpeaking() {
  window.speechSynthesis?.cancel();
}

export default function TripAssistant() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<GeminiConfig>(() => loadGeminiConfig());
  const [draftKey, setDraftKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I’m your Winter Himachal trip assistant. Ask about days, places, transport, packing, or say “download my itinerary PDF”. Open settings to add your Gemini API key. Tap the mic to talk.',
    },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opening settings
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
      {
        id: `pdf-${Date.now()}`,
        role: 'assistant',
        text: `Downloaded ${kind} PDF to your device.`,
      },
    ]);
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
      setMessages((m) => [...m, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const { text: reply, modelUsed } = await sendToGemini(
          config,
          historyRef.current,
          trimmed,
          modelOptions.map((m) => m.id),
        );
        const nextHistory: ChatTurn[] = [
          ...historyRef.current,
          { role: 'user' as const, text: trimmed },
          { role: 'model' as const, text: reply },
        ].slice(-20);
        historyRef.current = nextHistory;

        const { displayText, pdfKind } = parseAssistantReply(reply);
        if (pdfKind) runPdf(pdfKind);

        const modelNote =
          modelUsed !== config.model ? `\n\n(Used ${modelUsed} — primary model was busy.)` : '';
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: displayText + modelNote,
        };
        setMessages((m) => [...m, assistantMsg]);

        if (voiceMode && config.voiceEnabled) speak(displayText, config.voiceLang);
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Something went wrong.';
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: 'assistant', text: err }]);
      } finally {
        setLoading(false);
      }
    },
    [config, loading, voiceMode, modelOptions],
  );

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
      const transcript = Array.from(ev.results)
        .map((r) => r[0].transcript)
        .join('');
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

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
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
        aria-label="Trip AI assistant"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>

      {open && (
        <div className="assistant-panel" role="dialog" aria-label="Trip assistant">
          <header className="assistant-head">
            <div>
              <strong>Trip voice assistant</strong>
              <span>Gemini · this trip only</span>
            </div>
            <div className="assistant-head-actions">
              <button
                type="button"
                aria-label={voiceMode ? 'Voice replies on' : 'Voice replies off'}
                onClick={() => {
                  const v = !voiceMode;
                  setVoiceMode(v);
                  const next = { ...config, voiceEnabled: v };
                  setConfig(next);
                  saveGeminiConfig(next);
                  if (!v) stopSpeaking();
                }}
              >
                {voiceMode ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button type="button" aria-label="AI settings" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
              </button>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </header>

          {!config.apiKey && (
            <div className="assistant-banner">
              Add your <button type="button" onClick={() => setSettingsOpen(true)}>Gemini API key</button>{' '}
              to chat. Stored only in this browser.
            </div>
          )}

          <div className="assistant-pdf-row">
            {pdfButtons.map((b) => (
              <button key={b.kind} type="button" onClick={() => runPdf(b.kind)}>
                <Download size={12} /> {b.label}
              </button>
            ))}
          </div>

          <div className="assistant-messages" ref={listRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`assistant-bubble ${msg.role}`}>
                {msg.text}
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
              aria-label={listening ? 'Stop listening' : 'Speak'}
              onClick={() => (listening ? stopListening() : startListening())}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? 'Listening…' : 'Ask about your trip…'}
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
            <p>Calls Google Gemini directly from your browser. Your key stays in localStorage on this device.</p>
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
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.hint ? ` — ${m.hint}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="assistant-refresh-models"
              disabled={modelsLoading}
              onClick={() => refreshModels()}
            >
              {modelsLoading ? 'Loading models…' : 'Refresh model list from API'}
            </button>
            {modelsListNote && <p className="assistant-models-note">{modelsListNote}</p>}
            <label>
              Voice language
              <select
                value={config.voiceLang}
                onChange={(e) => setConfig((c) => ({ ...c, voiceLang: e.target.value }))}
              >
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
              <button type="button" className="button pale" onClick={() => setSettingsOpen(false)}>
                Cancel
              </button>
              <button type="button" className="button dark" onClick={saveSettings}>Save</button>
            </div>
            <p className="assistant-settings-note">
              Get a key at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              . Restrict the key if possible; never share it publicly.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
