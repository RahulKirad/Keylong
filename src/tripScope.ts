/** Hard scope: Spiti Tour 2026 chatbot answers trip topics only. */

export const TRIP_SCOPE_REFUSAL = [
  'I only help with **Spiti Tour 2026** — itinerary, places, train/flight, stays, packing, safety, temperature, expenses (who owes / to receive), assignments, and ID proof.',
  '',
  'Ask something about this trip (for example: “What’s the train?”, “Who owes whom?”, or “How much should I receive?”).',
].join('\n');

const TRIP_TOPIC =
  /\b(spiti|himachal|kinnaur|tour|trip|itinerary|schedule|day\s*\d+|phase|place|stop|halt|overnight|stay|staying|hotel|homestay|home\s*stay|camping|accommodation|lodge|shimla|sangla|chitkul|kalpa|nako|tabo|kaza|langza|kufri|delhi|mumbai|pune|bandra|nizamuddin|train|22917|flight|ai\s*9825|bus|cab|driver|road|altitude|pack|packing|cold|snow|winter|temperature|weather|safety|budget|expense|spent|paid|balance|transfer|owe|owes|owing|debt|settle|settlement|receivable|receive|splitwise|assign|task|aadhaar|aadhar|passport|id\s*proof|check-?in|pdf|download|map|route|traveller|member)\b/i;

const GREETING_OR_META =
  /^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good evening|help|what can you (do|help)|who are you)\b/i;

const CLEARLY_OFF_TOPIC =
  /\b(python|javascript|typescript|java\b|c\+\+|sql|html|css|react native|write (me )?(a |an )?(code|program|script|essay|poem|story|song)|solve (this )?(math|equation|homework)|integral|derivative|stock|crypto|bitcoin|forex|netflix|bollywood|cricket score|ipl|election|politics|president|prime minister|recipe|cook|bake|diet plan|lose weight|medical diagnos|prescribe|ignore (all |previous )?instructions|jailbreak|system prompt)\b/i;

/**
 * Returns false when the message is clearly unrelated to Spiti Tour 2026.
 * Ambiguous messages are allowed through so Gemini can refuse using the system prompt.
 */
export function isTripRelatedQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (GREETING_OR_META.test(trimmed)) return true;
  if (TRIP_TOPIC.test(trimmed)) return true;
  if (CLEARLY_OFF_TOPIC.test(trimmed)) return false;
  // Short follow-ups like "what about day 3?" may lack keywords — allow Gemini + prompt.
  if (trimmed.length <= 80 && !CLEARLY_OFF_TOPIC.test(trimmed)) return true;
  return !CLEARLY_OFF_TOPIC.test(trimmed);
}
