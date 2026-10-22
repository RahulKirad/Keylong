import type { AssistantMode } from './assistantBridge';
import type { ChatTurn } from './geminiClient';
import type { PersonalTopic } from './travellerBrief';

export type StoredChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
  expensesLink?: boolean;
  assignmentsLink?: boolean;
  idLink?: boolean;
  pdfTopics?: PersonalTopic[];
};

export type ChatThread = {
  travellerKey: string;
  mode: AssistantMode;
  messages: StoredChatMessage[];
  geminiHistory: ChatTurn[];
  updatedAt: number;
};

const STORAGE_KEY = 'winter-himachal-chat-history-v1';
const MAX_MESSAGES = 150;
const MAX_GEMINI_TURNS = 20;

type ChatStore = Record<string, ChatThread>;

function threadKey(travellerName: string, mode: AssistantMode): string {
  return `${travellerName.trim().toLowerCase()}::${mode}`;
}

function readStore(): ChatStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChatStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: ChatStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or private mode — keep the in-session chat only.
  }
}

export function getChatThread(travellerName: string | null | undefined, mode: AssistantMode): ChatThread | null {
  if (!travellerName?.trim()) return null;
  return readStore()[threadKey(travellerName, mode)] || null;
}

export function saveChatThread(
  travellerName: string | null | undefined,
  mode: AssistantMode,
  messages: StoredChatMessage[],
  geminiHistory: ChatTurn[],
): void {
  if (!travellerName?.trim()) return;
  const key = threadKey(travellerName, mode);
  const store = readStore();
  store[key] = {
    travellerKey: travellerName.trim().toLowerCase(),
    mode,
    messages: messages.slice(-MAX_MESSAGES),
    geminiHistory: geminiHistory.slice(-MAX_GEMINI_TURNS),
    updatedAt: Date.now(),
  };
  writeStore(store);
}

export function clearChatThread(travellerName: string | null | undefined, mode: AssistantMode): void {
  if (!travellerName?.trim()) return;
  const store = readStore();
  delete store[threadKey(travellerName, mode)];
  writeStore(store);
}

export function geminiHistoryFromMessages(messages: StoredChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      turns.push({ role: 'user', text: message.text });
      continue;
    }
    if (
      message.role === 'assistant' &&
      !message.id.startsWith('open-') &&
      !message.id.startsWith('hello-')
    ) {
      turns.push({ role: 'model', text: message.text });
    }
  }
  return turns.slice(-MAX_GEMINI_TURNS);
}
