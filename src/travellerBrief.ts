import { getAssignmentState, type TripAssignment } from './assignmentStore';
import { DEFAULT_TRAVELLER_NAMES } from './defaultTravellers';
import {
  buildTravellerLedger,
  type TravellerLedgerRow,
} from './expenseLedger';
import {
  getExpenseState,
  type ExpenseRecord,
  type FundTransfer,
  type TripMember,
} from './expenseStore';
import { getIdProof, idTypeLabel, type IdProof } from './idProofStore';

export type PersonalTopic = 'tasks' | 'expenses' | 'spending' | 'transfers' | 'identity';

export type PersonalBrief = {
  name: string;
  member?: TripMember;
  tasks: TripAssignment[];
  expenses: ExpenseRecord[];
  transfers: FundTransfer[];
  ledger?: TravellerLedgerRow;
  identity?: IdProof;
};

const ALL_TOPICS: PersonalTopic[] = ['tasks', 'expenses', 'spending', 'transfers', 'identity'];

export function listTravellerNames(): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const push = (name: string) => {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  };
  for (const member of getExpenseState().members) push(member.name);
  for (const name of DEFAULT_TRAVELLER_NAMES) push(name);
  return names;
}

export function briefForName(name: string): PersonalBrief {
  const key = name.trim().toLowerCase();
  const { members, expenses, transfers } = getExpenseState();
  const member = members.find((item) => item.name.trim().toLowerCase() === key);
  const tasks = getAssignmentState().assignments.filter((task) => {
    if (task.assigneeName.trim().toLowerCase() === key) return true;
    return Boolean(member && task.assigneePersonId === member.id);
  });
  const mineExpenses = expenses.filter((expense) => {
    if (expense.paidByName.trim().toLowerCase() === key) return true;
    if ((expense.balanceHolderName || '').trim().toLowerCase() === key) return true;
    if (!member) return false;
    return expense.paidByPersonId === member.id || expense.balanceHolderPersonId === member.id;
  });
  const mineTransfers = transfers.filter((transfer) => {
    if (transfer.fromPersonName.trim().toLowerCase() === key || transfer.toPersonName.trim().toLowerCase() === key) {
      return true;
    }
    if (!member) return false;
    return transfer.fromPersonId === member.id || transfer.toPersonId === member.id;
  });
  const ledger = member
    ? buildTravellerLedger(members, transfers, expenses).find((row) => row.member.id === member.id)
    : undefined;
  return { name: name.trim(), member, tasks, expenses: mineExpenses, transfers: mineTransfers, ledger, identity: getIdProof(name) };
}

export function topicsFromQuestion(text: string): PersonalTopic[] | null {
  const raw = text.trim().toLowerCase();
  if (!raw || /^(hi|hello|hey|thanks|thank you|ok|okay)\b[.! ]*$/.test(raw)) return null;
  const aboutPerson =
    /\b(my|mine|myself)\b/.test(raw) ||
    /\b(what|show|tell|list|how much).{0,24}\b(i|me)\b/.test(raw) ||
    /\b(i|i've|i’m|im)\b.{0,40}\b(spend|spent|paid|owe|assigned|task)/.test(raw);
  const mentions =
    /task|assign|to-?do|dut(y|ies)|expense|spent|spend|paid|payment|balance|money|transfer|bill|cost|aadhaar|aadhar|id proof|identity|passport|id card|check-?in/.test(raw);
  const idAsk = /aadhaar|aadhar|id proof|identity|passport|id card|check-?in/.test(raw);
  const everything = /everything about me|all my (things|stuff|records|info)|my summary|full (brief|copy|record)/.test(raw);
  if (everything) return [...ALL_TOPICS];
  if (!aboutPerson && !idAsk && !/^(my )?(tasks|expenses|spending|balance|assignments|aadhaar|aadhar|id)\b/.test(raw)) return null;
  if (!mentions && !idAsk && !/^(my )?(tasks|expenses|spending|balance|assignments)\b/.test(raw)) return null;

  const topics: PersonalTopic[] = [];
  if (/task|assign|to-?do|dut/.test(raw)) topics.push('tasks');
  if (/expense|bill|paid|payment|cost/.test(raw)) topics.push('expenses');
  if (/spend|spent|spending|balance|money left|owe/.test(raw)) topics.push('spending');
  if (/transfer|gave|given|received/.test(raw)) topics.push('transfers');
  if (idAsk) topics.push('identity');
  if (!topics.length && /\b(my|mine)\b|about me|my things/.test(raw)) return [...ALL_TOPICS];
  return topics.length ? topics : [...ALL_TOPICS];
}

export function wantsPersonalCopy(text: string): boolean {
  const raw = text.trim().toLowerCase();
  if (!raw) return false;
  if (/^(yes|yeah|yep|sure|ok|okay|please|download)$/.test(raw)) return true;
  return /\b(pdf|copy|download)\b/.test(raw) && /\b(yes|want|please|send|get|download|copy|pdf)\b/.test(raw);
}

function inr(amount: number): string {
  return `INR ${amount.toLocaleString('en-IN')}`;
}

export function formatPersonalReply(brief: PersonalBrief, topics: PersonalTopic[]): string {
  const blocks: string[] = [`**${brief.name}**, here is what I have for you.`];

  if (topics.includes('tasks')) {
    if (!brief.tasks.length) {
      blocks.push('**Assigned tasks**\n\n• No tasks assigned to you yet.');
    } else {
      const lines = brief.tasks.map((task) => {
        const day = task.tripDayNumber != null ? `Day ${task.tripDayNumber}` : 'No day';
        const date = task.dateLabel ? ` (${task.dateLabel})` : '';
        return `• ${task.task} — **${day}**${date}`;
      });
      blocks.push(`**Assigned tasks**\n\n${lines.join('\n')}`);
    }
  }

  if (topics.includes('spending') && brief.ledger) {
    const row = brief.ledger;
    blocks.push(
      `**Spending**\n\n• Paid on the trip: **${inr(row.totalSpentAsPayer)}**\n• Cash: **${inr(row.cashSpent)}**\n• Online: **${inr(row.onlineSpent)}**\n• Spent from your balance: **${inr(row.spentFromBalanceTotal)}**\n• Balance left to spend: **${inr(row.balanceRemaining)}**`,
    );
  } else if (topics.includes('spending')) {
    blocks.push('**Spending**\n\n• No spending recorded for you yet.');
  }

  if (topics.includes('expenses')) {
    if (!brief.expenses.length) {
      blocks.push('**Expenses**\n\n• No expenses recorded for you yet.');
    } else {
      const total = brief.expenses.reduce((sum, expense) => sum + expense.amountInr, 0);
      const balance = brief.ledger?.balanceRemaining ?? 0;
      const lines = brief.expenses.map(
        (expense) =>
          `• **${expense.dateLabel || expense.tripDate}** — ${expense.description} — **${inr(expense.amountInr)}** (${expense.category})`,
      );
      lines.push(`• **Total spent:** ${inr(total)}`);
      lines.push(
        balance > 0
          ? `• **Balance left:** ${inr(balance)}`
          : `• **Balance left:** ${inr(0)} (none held)`,
      );
      blocks.push(`**Expenses**\n\n${lines.join('\n')}`);
    }
  }

  if (topics.includes('transfers')) {
    if (!brief.transfers.length) {
      blocks.push('**Money given or received**\n\n• No transfers recorded for you yet.');
    } else {
      const lines = brief.transfers.map((transfer) => {
        const direction =
          transfer.fromPersonName.trim().toLowerCase() === brief.name.toLowerCase()
            ? `You gave **${transfer.toPersonName}**`
            : `**${transfer.fromPersonName}** gave you`;
        return `• ${transfer.dateLabel || transfer.tripDate}: ${direction} **${inr(transfer.amountInr)}**`;
      });
      blocks.push(`**Money given or received**\n\n${lines.join('\n')}`);
    }
  }

  if (topics.includes('identity')) {
    const proof = brief.identity;
    if (!proof) {
      blocks.push('**ID proof**\n\n• Nothing saved yet. Open **ID proof** and add the Aadhaar number or a photo of the card.');
    } else {
      const lines = [
        `• **Type:** ${idTypeLabel(proof.idType)}`,
        proof.idNumber ? `• **Number:** ${proof.idNumber}` : '• **Number:** not entered',
        `• **Name on card:** ${proof.nameOnId || brief.name}`,
        proof.note ? `• **Note:** ${proof.note}` : '',
        proof.fileDataUrl ? '• A photo or PDF of the card is saved on this phone.' : '• No card photo saved yet.',
      ].filter(Boolean);
      blocks.push(`**ID proof**\n\n${lines.join('\n')}\n\nOpen the check-in card when the hotel asks to see it.`);
    }
  }

  blocks.push('Do you want a copy of this? I can download a structured PDF with your tables.');
  return blocks.join('\n\n');
}
