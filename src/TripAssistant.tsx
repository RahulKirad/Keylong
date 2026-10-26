import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
  MessageSquarePlus,
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
import {
  addDebtSettlement,
  addExpense,
  addFundTransfer,
  getExpenseState,
  queuePendingUtterance,
} from './expenseStore';
import { memberBalanceRemaining } from './expenseLedger';
import { parseMoneyUtterance } from './expenseParse';
import { outstandingBetweenSimple } from './expenseSplit';
import {
  confirmDeductFromPool,
  poolsWithRemaining,
  preferredPoolForExpense,
} from './poolManagers';
import { getSelectedTraveller, subscribeSelectedTraveller } from './selectedTraveller';
import { getDays, subscribeItinerary } from './itineraryStore';
import {
  briefForName,
  formatPersonalReply,
  personFromQuestion,
  topicsFromQuestion,
  wantsPersonalCopy,
  type PersonalTopic,
} from './travellerBrief';
import { downloadPersonalPdf } from './travellerPdf';
import {
  clearChatThread,
  geminiHistoryFromMessages,
  getChatThread,
  saveChatThread,
  type StoredChatMessage,
} from './chatHistoryStore';
import { formatLiveScheduleReply, wantsLiveScheduleAnswer } from './liveScheduleAnswers';
import {
  formatLiveIdReply,
  tryUpdateIdFromChat,
  wantsIdAnswer,
} from './liveIdProofAnswers';
import { formatLiveExpenseReply, wantsLiveExpenseAnswer } from './liveExpenseAnswers';
import { subscribeIdProofs } from './idProofStore';
import { isTripRelatedQuestion, TRIP_SCOPE_REFUSAL } from './tripScope';
import { formatLiveStayReply, wantsStayAnswer } from './liveStayAnswers';

type Message = StoredChatMessage;

/** Compact professional mark for the trip assistant FAB / panel. */
function AssistantMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="28" height="20" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M10 24 L8 28 L14 24" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M8 17.5 L13 11 L16.5 14.5 L20 9.5 L24 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="9.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

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
  'Hi! I’m your **Spiti Tour 2026** trip assistant. Ask about days, places, transport, packing, or **who owes / should receive** money. Say “download itinerary PDF” when you need documents. Tap **mic** to talk.';

const ASSIGNMENTS_WELCOME =
  '**Assign tasks** — say who should do what, e.g. “Rahul is assigned to book the train tickets for 23rd” or “Sanket will confirm Kaza stay for 31 Dec”. I’ll add it to **Assignments** and highlight that day in the **itinerary**.';

function welcomeForMode(m: AssistantMode, name: string): string {
  const expense = `**Log expense** (shared group ledger). You are signed in as **${name}**. Spends split among **everyone** by default. Example: “Sanket spent 17500 Rs on dinner exclude Allen, Piyu and Rutika”. When you repay someone, say “I have given the amount of train travel to Sanket” — that clears pending debt. Ask exact debts anytime: “Who owes whom?”, “How much do I owe?”, “How much should I receive?”, “How much does Rahul owe Sanket?”. Hand pool cash: “Rahul gave 5000 to Sanket cash”.`;
  const trip =
    'I only answer **Spiti Tour 2026** questions — days, places, train/flight, packing, temperature, **your** tasks, spending, and **exact who owes / to receive**. Example: “Who owes me?” or “Show Allen’s expenses”. Off-topic questions are declined.';
  const body = m === 'expense' ? expense : m === 'assignments' ? ASSIGNMENTS_WELCOME : trip;
  return `Hi **${name}**. This login stays on your name.\n\n${body}`;
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

function initialMessagesFor(mode: AssistantMode, name: string | null): Message[] {
  const saved = getChatThread(name, mode);
  if (saved?.messages?.length) return saved.messages;
  return openingMessages(mode, name);
}

function initialGeminiHistory(mode: AssistantMode, name: string | null): ChatTurn[] {
  const saved = getChatThread(name, mode);
  if (saved?.geminiHistory?.length) return saved.geminiHistory;
  if (saved?.messages?.length) return geminiHistoryFromMessages(saved.messages);
  return [];
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
  const offeredTopicsRef = useRef<PersonalTopic[]>([]);
  const offeredSubjectRef = useRef<string | null>(getSelectedTraveller());
  const selectedNameRef = useRef<string | null>(getSelectedTraveller());
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessagesFor('trip', getSelectedTraveller()),
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(config.voiceEnabled);
  const [modelOptions, setModelOptions] = useState<GeminiModelOption[]>(GEMINI_MODEL_OPTIONS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsListNote, setModelsListNote] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ChatTurn[]>(initialGeminiHistory('trip', getSelectedTraveller()));
  const skipPersistRef = useRef(false);
  /** Finalised speech chunks for the current mic session (full sentence). */
  const speechFinalRef = useRef('');
  const speechSilenceTimerRef = useRef<number | null>(null);
  const speechIntentionalStopRef = useRef(false);
  const listeningRef = useRef(false);
  /** Wait this long after you stop talking before sending the full sentence. */
  const SPEECH_SILENCE_MS = 2200;

  const startListenRef = useRef<() => void>(() => {});

  const loadThread = useCallback((name: string | null, nextMode: AssistantMode) => {
    skipPersistRef.current = true;
    const saved = getChatThread(name, nextMode);
    if (saved?.messages?.length) {
      setMessages(saved.messages);
      historyRef.current = saved.geminiHistory?.length
        ? saved.geminiHistory
        : geminiHistoryFromMessages(saved.messages);
    } else {
      setMessages(openingMessages(nextMode, name));
      historyRef.current = [];
    }
    window.setTimeout(() => {
      skipPersistRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    selectedNameRef.current = selectedName;
  }, [selectedName]);

  useEffect(() => {
    if (skipPersistRef.current || !selectedName) return;
    saveChatThread(selectedName, mode, messages, historyRef.current);
  }, [messages, mode, selectedName]);

  useEffect(
    () =>
      subscribeItinerary(() => {
        // Drop Gemini memory so old train/flight answers cannot override Trip tables.
        historyRef.current = [];
        setMessages((current) => {
          const notice = {
            id: `itinerary-sync-${Date.now()}`,
            role: 'assistant' as const,
            text: 'Trip tables were **updated**. I’ll use the new schedule, train and flight details from now on. Ask again if you need the latest train info.',
          };
          const withoutOldSync = current.filter((msg) => !msg.id.startsWith('itinerary-sync-'));
          return [...withoutOldSync, notice];
        });
      }),
    [],
  );

  useEffect(
    () =>
      subscribeIdProofs(() => {
        historyRef.current = [];
        setMessages((current) => {
          const notice = {
            id: `id-sync-${Date.now()}`,
            role: 'assistant' as const,
            text: 'Your **ID proof** was updated. Ask “show my ID proof” to see the latest details.',
          };
          const withoutOld = current.filter((msg) => !msg.id.startsWith('id-sync-'));
          return [...withoutOld, notice];
        });
      }),
    [],
  );

  const applySelectedName = (name: string) => {
    if (selectedNameRef.current === name) return;
    const starting = !selectedNameRef.current;
    setSelectedName(name);
    selectedNameRef.current = name;
    offeredSubjectRef.current = name;
    if (starting) {
      loadThread(name, mode);
      if (shouldStartMic(mode)) window.setTimeout(() => startListenRef.current(), 500);
      return;
    }
    loadThread(name, mode);
  };

  const startNewChat = () => {
    const name = selectedNameRef.current;
    clearChatThread(name, mode);
    skipPersistRef.current = true;
    historyRef.current = [];
    offeredTopicsRef.current = [];
    offeredSubjectRef.current = name;
    setMessages(openingMessages(mode, name));
    setInput('');
    window.setTimeout(() => {
      skipPersistRef.current = false;
      if (name) saveChatThread(name, mode, openingMessages(mode, name), []);
    }, 0);
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

  const runPdf = (kind: PdfKind, announce = true) => {
    downloadTripPdf(kind);
    if (!announce) return;
    setMessages((m) => [
      ...m,
      {
        id: `pdf-${Date.now()}`,
        role: 'assistant',
        text: `Saved the **${kind}** PDF to your device.`,
      },
    ]);
  };

  const userAskedForPdf = (text: string) =>
    /\b(download|pdf|export|print)\b/i.test(text);

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
          text: `Recorded money given\n\n• **${parsed.fromPersonName}** → **${parsed.toPersonName}**\n• **Amount:** ₹${parsed.amountInr.toLocaleString('en-IN')} (${pay})\n• **${parsed.toPersonName}'s balance** to spend: **₹${left.toLocaleString('en-IN')}**\n\nSee the traveller table on **Spiti Tour Expenses**.`,
        };
      }
      if (parsed.kind === 'settle') {
        if (!parsed.amountInr || parsed.amountInr <= 0) {
          throw new Error(
            `Nothing pending from ${parsed.fromPersonName} to ${parsed.toPersonName}${
              parsed.note ? ` for “${parsed.note}”` : ''
            }. Already cleared, or no matching split.`,
          );
        }
        const record = addDebtSettlement(parsed);
        const { expenses, members, settlements } = getExpenseState();
        const still = outstandingBetweenSimple(
          expenses,
          members,
          settlements || [],
          record.fromPersonId,
          record.toPersonId,
        );
        const pay =
          record.paymentMethod === 'cash'
            ? 'Cash'
            : record.paymentMethod === 'online'
              ? 'Online'
              : 'Not specified';
        return {
          text: `Marked as **paid**\n\n• **${record.fromPersonName}** paid **${record.toPersonName}**\n• **Cleared:** ₹${record.amountInr.toLocaleString('en-IN')} (${pay})${
            record.note ? `\n• **For:** ${record.note}` : ''
          }\n• **Still pending** ${record.fromPersonName} → ${record.toPersonName}: **₹${still.toLocaleString('en-IN')}**${
            still === 0 ? ' (fully cleared)' : ''
          }\n\nSummed totals on **Spiti Tour Expenses** now hide cleared amounts.`,
        };
      }
      let expenseInput = { ...parsed };
      if (!expenseInput.spentFromBalance) {
        const stateNow = getExpenseState();
        const pools = poolsWithRemaining(stateNow.members, stateNow.transfers, stateNow.expenses);
        const preferred = preferredPoolForExpense(pools, expenseInput.paidByPersonId);
        if (preferred) {
          const chosen = confirmDeductFromPool({
            amountInr: expenseInput.amountInr,
            description: expenseInput.description,
            pools,
            preferred,
          });
          if (chosen) {
            expenseInput = {
              ...expenseInput,
              spentFromBalance: true,
              balanceHolderPersonId: chosen.member.id,
              balanceHolderName: chosen.member.name,
            };
          }
        }
      }
      const record = addExpense(expenseInput);
      const { transfers, expenses, members } = getExpenseState();
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
      let splitLine = '';
      if (record.splitEnabled !== false) {
        const excludedIds = new Set(record.splitExcludedPersonIds || []);
        const participants = members.filter((m) => !excludedIds.has(m.id));
        const n = Math.max(1, participants.length);
        const share = Math.round(record.amountInr / n);
        const excludedNames = members
          .filter((m) => excludedIds.has(m.id))
          .map((m) => m.name)
          .join(', ');
        const oweNames = participants
          .filter((m) => m.id !== record.paidByPersonId)
          .map((m) => `${m.name} owes ₹${share.toLocaleString('en-IN')}`)
          .join('; ');
        splitLine = `\n• **Split:** ₹${share.toLocaleString('en-IN')} each among **${n}** travellers${
          excludedNames ? `\n• **Excluded:** ${excludedNames}` : ''
        }${oweNames ? `\n• **To be given to ${record.paidByName}:** ${oweNames}` : ''}`;
      } else {
        splitLine = '\n• **Split:** off (personal / not shared)';
      }
      return {
        text: `Recorded expense\n\n• **${record.dateLabel}** — ${record.description}\n• **Amount:** ₹${record.amountInr.toLocaleString('en-IN')} (${pay})\n• **Paid by:** ${record.paidByName}\n• **Category:** ${record.category}${balanceLine}${givenLine}${splitLine}\n\nSee **Spend compartments** and **Bill splits** on **Spiti Tour Expenses**.`,
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
      record.tripDayNumber != null ? getDays().find((d) => d.day === record.tripDayNumber)?.title : undefined;
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
          const subject = offeredSubjectRef.current || person;
          const pdfTopics = [...new Set([...offeredTopicsRef.current, 'spending' as const, 'expenses' as const])];
          downloadPersonalPdf(subject, pdfTopics);
          setMessages((m) => [
            ...m,
            {
              id: `pdf-${Date.now()}`,
              role: 'assistant',
              text: `Downloaded **${subject}**'s PDF. It includes the total spent, any balance left, and the tables for what you asked about.`,
            },
          ]);
          return;
        }

        if (wantsIdAnswer(trimmed)) {
          const updated = tryUpdateIdFromChat(trimmed, person);
          const reply = updated.ok ? updated.reply : formatLiveIdReply(person);
          historyRef.current = [
            ...historyRef.current,
            { role: 'user' as const, text: trimmed },
            { role: 'model' as const, text: reply },
          ].slice(-20);
          setMessages((m) => [
            ...m,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: reply,
              idLink: true,
            },
          ]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          setLoading(false);
          return;
        }

        // Exact owe / receive / settle-up from live ledger — before personal brief or Gemini.
        if (wantsLiveExpenseAnswer(trimmed)) {
          const reply = formatLiveExpenseReply(trimmed, person);
          historyRef.current = [
            ...historyRef.current,
            { role: 'user' as const, text: trimmed },
            { role: 'model' as const, text: reply },
          ].slice(-20);
          setMessages((m) => [
            ...m,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: reply,
              expensesLink: true,
            },
          ]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          setLoading(false);
          return;
        }

        const askedTopics = topicsFromQuestion(trimmed);
        const subject = personFromQuestion(trimmed, person);
        const loggingRecord = /\b(is assigned|will |should |paid by|rupees|rs\.?\s*\d|\d+\s*(rupee|inr))\b/i.test(trimmed);
        const expenseEntry = mode === 'expense' && /\d/.test(trimmed) && !trimmed.includes('?') && !/^(what|show|tell|how|list|do i|did i)\b/i.test(trimmed);
        if (askedTopics && !loggingRecord && !expenseEntry) {
          const aboutSelf = subject.toLowerCase() === person.toLowerCase();
          let topics = aboutSelf ? askedTopics : askedTopics.filter((topic) => topic !== 'identity');
          if (!topics.length) topics = ['tasks'];
          offeredTopicsRef.current = [...new Set([...offeredTopicsRef.current, ...topics])];
          offeredSubjectRef.current = subject;
          const reply = formatPersonalReply(briefForName(subject), topics, person);
          setMessages((m) => [
            ...m,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: reply,
              pdfTopics: [...offeredTopicsRef.current],
              expensesLink: aboutSelf && (topics.includes('expenses') || topics.includes('spending')),
              assignmentsLink: aboutSelf && topics.includes('tasks'),
              idLink: aboutSelf && topics.includes('identity'),
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

        if (wantsLiveScheduleAnswer(trimmed)) {
          const reply = formatLiveScheduleReply(trimmed);
          historyRef.current = [
            ...historyRef.current,
            { role: 'user' as const, text: trimmed },
            { role: 'model' as const, text: reply },
          ].slice(-20);
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: reply }]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          setLoading(false);
          return;
        }

        if (wantsStayAnswer(trimmed)) {
          const reply = formatLiveStayReply(trimmed);
          historyRef.current = [
            ...historyRef.current,
            { role: 'user' as const, text: trimmed },
            { role: 'model' as const, text: reply },
          ].slice(-20);
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: reply }]);
          if (voiceMode && config.voiceEnabled) speak(reply, config.voiceLang);
          setLoading(false);
          return;
        }

        if (!isTripRelatedQuestion(trimmed)) {
          historyRef.current = [
            ...historyRef.current,
            { role: 'user' as const, text: trimmed },
            { role: 'model' as const, text: TRIP_SCOPE_REFUSAL },
          ].slice(-20);
          setMessages((m) => [
            ...m,
            { id: `a-${Date.now()}`, role: 'assistant', text: TRIP_SCOPE_REFUSAL },
          ]);
          if (voiceMode && config.voiceEnabled) speak(TRIP_SCOPE_REFUSAL, config.voiceLang);
          setLoading(false);
          return;
        }

        const { text: reply, modelUsed } = await sendToGemini(
          config,
          historyRef.current,
          [
            `SCOPE: Answer only Spiti Tour 2026 trip topics. If this message is unrelated, refuse and steer back to the trip.`,
            `The traveller speaking is ${person}. They may ask about anyone’s tasks or spending on this shared trip.`,
            `Prefer LIVE schedule/TRAIN/FLIGHT fields over any older chat turns.`,
            `For owing / to-receive / settle-up amounts, use ONLY the LIVE SPLITWISE DEBTS block — exact ₹ figures, never guess.`,
            '',
            trimmed,
          ].join('\n'),
          modelOptions.map((m) => m.id),
        );
        const { displayText, pdfKind } = parseAssistantReply(reply);
        historyRef.current = [
          ...historyRef.current,
          { role: 'user' as const, text: trimmed },
          { role: 'model' as const, text: displayText },
        ].slice(-20);

        // Never auto-download from chat answers — show an in-chat button instead.
        const offerPdf =
          pdfKind || (userAskedForPdf(trimmed) ? ('full' as const) : null);

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
            pdfOffer: offerPdf || undefined,
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

  const clearSpeechSilenceTimer = () => {
    if (speechSilenceTimerRef.current != null) {
      window.clearTimeout(speechSilenceTimerRef.current);
      speechSilenceTimerRef.current = null;
    }
  };

  const finishSpeechAndSend = (raw: string) => {
    clearSpeechSilenceTimer();
    const text = raw.replace(/\s+/g, ' ').trim();
    speechFinalRef.current = '';
    speechIntentionalStopRef.current = true;
    listeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
    if (text) void sendMessage(text);
  };

  const stopListening = (opts?: { send?: boolean }) => {
    clearSpeechSilenceTimer();
    speechIntentionalStopRef.current = true;
    listeningRef.current = false;
    const text = (speechFinalRef.current || input).replace(/\s+/g, ' ').trim();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
    speechFinalRef.current = '';
    if (opts?.send !== false && text) void sendMessage(text);
  };

  const startListening = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    stopSpeaking();
    clearSpeechSilenceTimer();
    speechFinalRef.current = '';
    speechIntentionalStopRef.current = false;

    const rec = new Ctor();
    rec.lang = config.voiceLang;
    rec.interimResults = true;
    // Keep the mic open so short pauses mid-sentence do not auto-send.
    rec.continuous = true;

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const piece = (ev.results[i][0]?.transcript || '').trim();
        if (!piece) continue;
        if (ev.results[i].isFinal) {
          speechFinalRef.current = [speechFinalRef.current, piece].filter(Boolean).join(' ');
        } else {
          interim = [interim, piece].filter(Boolean).join(' ');
        }
      }
      const live = [speechFinalRef.current, interim].filter(Boolean).join(' ');
      setInput(live);

      // Only send after a clear pause — waits for the full sentence.
      clearSpeechSilenceTimer();
      speechSilenceTimerRef.current = window.setTimeout(() => {
        const ready = speechFinalRef.current.replace(/\s+/g, ' ').trim();
        if (!ready) return;
        finishSpeechAndSend(ready);
      }, SPEECH_SILENCE_MS);
    };

    rec.onerror = () => {
      clearSpeechSilenceTimer();
      listeningRef.current = false;
      setListening(false);
    };

    rec.onend = () => {
      // Chrome sometimes ends continuous sessions early — restart until we choose to stop.
      if (!speechIntentionalStopRef.current && listeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      listeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  };

  startListenRef.current = startListening;

  useEffect(
    () => () => {
      clearSpeechSilenceTimer();
      speechIntentionalStopRef.current = true;
      listeningRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  useEffect(() => {
    registerAssistantOpener((m) => {
      setMode(m);
      setOpen(true);
      loadThread(selectedNameRef.current, m);
      if (selectedNameRef.current && shouldStartMic(m)) window.setTimeout(() => startListenRef.current(), 500);
    });
  }, [loadThread]);

  const switchMode = (m: AssistantMode) => {
    if (m === mode) return;
    if (selectedName) saveChatThread(selectedName, mode, messages, historyRef.current);
    setMode(m);
    loadThread(selectedName, m);
    if (selectedName && shouldStartMic(m)) window.setTimeout(() => startListenRef.current(), 500);
  };

  const pdfButtons: { kind: PdfKind; label: string }[] = [
    { kind: 'itinerary', label: 'Itinerary' },
    { kind: 'transport', label: 'Transport' },
    { kind: 'safety', label: 'Safety' },
    { kind: 'full', label: 'Full pack' },
  ];

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    if (narrow) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`assistant-fab${open ? ' assistant-fab-open' : ''}`}
        aria-label="AI assistant"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} strokeWidth={2.25} /> : <AssistantMark size={24} />}
      </button>

      {open && (
        <div className="assistant-panel assistant-panel-lg" role="dialog" aria-modal="true" aria-label="AI assistant">
          <header className="assistant-head">
            <div className="assistant-head-title">
              <span className="assistant-symbol" aria-hidden="true">
                <AssistantMark size={20} />
              </span>
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
              <button
                type="button"
                className="assistant-new-chat"
                aria-label="Start a new chat"
                title="Start a new chat"
                onClick={startNewChat}
              >
                <MessageSquarePlus size={18} />
                <span>New chat</span>
              </button>
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
                {msg.role === 'assistant' && msg.pdfOffer && (
                  <button
                    type="button"
                    className="assistant-goto-expenses"
                    onClick={() => runPdf(msg.pdfOffer!, true)}
                  >
                    <Download size={14} /> Download {msg.pdfOffer} PDF
                  </button>
                )}
                {msg.role === 'assistant' && msg.pdfTopics && msg.pdfTopics.length > 0 && selectedName && (
                  <button
                    type="button"
                    className="assistant-goto-expenses"
                    onClick={() => {
                      const subject = offeredSubjectRef.current || selectedName;
                      const topics = [...new Set([...(msg.pdfTopics || []), 'spending' as const, 'expenses' as const])];
                      downloadPersonalPdf(subject, topics);
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

          <div className="assistant-footer">
            <div className="assistant-name-row assistant-name-locked">
              <span className="assistant-name-label">
                {selectedName ? 'Signed in as' : 'Unlock the trip and pick your name first'}
              </span>
              {selectedName && (
                <button type="button" className="on" disabled>
                  {selectedName}
                </button>
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
                disabled={!selectedName}
                onClick={() => (listening ? stopListening({ send: true }) : startListening())}
                title={
                  listening
                    ? 'Tap when finished — sends your full sentence'
                    : 'Speak your full sentence; sends after you pause'
                }
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  listening
                    ? 'Listening to your full sentence… pause when done'
                    : !selectedName
                      ? 'Chat starts after you pick a name'
                    : mode === 'expense'
                      ? `e.g. Sanket spent 17500 on dinner exclude Allen, Piyu and Rutika`
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
