type OpenFn = () => void;

let openFn: OpenFn | null = null;

export function registerSmartCalculatorOpener(fn: OpenFn | null): void {
  openFn = fn;
}

export function openSmartCalculator(): void {
  openFn?.();
}
