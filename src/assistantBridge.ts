export type AssistantMode = 'trip' | 'expense' | 'assignments';

type OpenFn = (mode: AssistantMode) => void;

let openFn: OpenFn | null = null;

export function registerAssistantOpener(fn: OpenFn): void {
  openFn = fn;
}

export function openTripAssistant(mode: AssistantMode = 'trip'): void {
  openFn?.(mode);
}

let expensesNavFn: (() => void) | null = null;

export function registerExpensesNavigation(fn: () => void): void {
  expensesNavFn = fn;
}

export function navigateToExpenses(): void {
  if (expensesNavFn) {
    expensesNavFn();
    return;
  }
  window.location.assign('/expenses');
}

let assignmentsNavFn: (() => void) | null = null;

export function registerAssignmentsNavigation(fn: () => void): void {
  assignmentsNavFn = fn;
}

export function navigateToAssignments(): void {
  if (assignmentsNavFn) {
    assignmentsNavFn();
    return;
  }
  window.location.assign('/assignments');
}

let idProofNavFn: ((show: boolean) => void) | null = null;

export function registerIdProofNavigation(fn: (show: boolean) => void): void {
  idProofNavFn = fn;
}

export function navigateToIdProof(show = false): void {
  if (idProofNavFn) {
    idProofNavFn(show);
    return;
  }
  window.location.assign(show ? '/id-proof?show=1' : '/id-proof');
}
