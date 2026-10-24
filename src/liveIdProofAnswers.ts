import {
  getIdProof,
  idTypeLabel,
  saveIdProof,
  type IdProofType,
} from './idProofStore';

export function wantsIdAnswer(question: string): boolean {
  const lower = question.toLowerCase();
  if (/\b(assign|expense|spent|paid|gave|balance|train|flight|itinerary)\b/i.test(lower)) {
    return false;
  }
  return /\b(aadhaar|aadhar|id proof|identity|passport|id card|check-?in|name on (the )?(id|card)|id number)\b/i.test(
    lower,
  );
}

export function formatLiveIdReply(person: string): string {
  const proof = getIdProof(person);
  if (!proof) {
    return [
      `**Your ID proof** (live from this phone)`,
      '',
      '• Nothing saved yet.',
      '',
      'Open **ID proof**, enter your details or upload a photo, tap **Update ID proof**, then ask me again.',
    ].join('\n');
  }

  const updated = new Date(proof.updatedAt).toLocaleString('en-IN');
  return [
    `**Your ID proof** (live — last updated ${updated})`,
    '',
    `• **Type:** ${idTypeLabel(proof.idType)}`,
    proof.idNumber ? `• **Number:** ${proof.idNumber}` : '• **Number:** not entered',
    `• **Name on card:** ${proof.nameOnId || person}`,
    proof.note ? `• **Note:** ${proof.note}` : '• **Note:** —',
    proof.fileDataUrl
      ? `• **Document:** ${proof.fileName || 'Photo/PDF'} saved on this phone`
      : '• **Document:** no file uploaded yet',
    '',
    'Edit anytime on the **ID proof** page — then ask again here to confirm the new details.',
  ].join('\n');
}

/** Parse simple “update my aadhaar to …” style edits from chat. */
export function tryUpdateIdFromChat(
  text: string,
  person: string,
): { ok: true; reply: string } | { ok: false } {
  const lower = text.toLowerCase();
  const existing = getIdProof(person);

  const numberMatch = text.match(
    /\b(?:update|change|set|save)?\s*(?:my\s+)?(?:aadhaar|aadhar|passport|id(?:\s*(?:proof|number|card))?)\s*(?:number\s*)?(?:to|is|=|:)\s*([A-Za-z0-9\s-]{4,20})/i,
  );
  const nameMatch = text.match(
    /\b(?:update|change|set)?\s*(?:my\s+)?name on (?:the )?(?:id|card)\s*(?:to|is|=|:)\s*(.+)$/i,
  );
  const noteMatch = text.match(
    /\b(?:update|change|set)?\s*(?:my\s+)?(?:id\s+)?note\s*(?:to|is|=|:)\s*(.+)$/i,
  );
  const typeMatch = lower.match(/\b(?:change|set|update)\s+(?:my\s+)?(?:id\s+)?type\s+to\s+(aadhaar|aadhar|passport|other)\b/);

  if (!numberMatch && !nameMatch && !noteMatch && !typeMatch) {
    return { ok: false };
  }

  let idType: IdProofType = existing?.idType || 'aadhaar';
  if (typeMatch) {
    const raw = typeMatch[1];
    idType = raw.startsWith('pass') ? 'passport' : raw.startsWith('other') ? 'other' : 'aadhaar';
  } else if (/\bpassport\b/i.test(text)) {
    idType = 'passport';
  } else if (/\baadhaar|aadhar\b/i.test(text)) {
    idType = 'aadhaar';
  }

  const idNumber = (numberMatch?.[1] || existing?.idNumber || '').trim();
  const nameOnId = (nameMatch?.[1] || existing?.nameOnId || person).trim();
  const note = (noteMatch?.[1] || existing?.note || '').trim();

  if (!idNumber && !existing?.fileDataUrl) {
    return {
      ok: true,
      reply:
        'I need an ID number (or a saved card photo). Say e.g. “update my Aadhaar to 1234 5678 9012” or upload a photo on the **ID proof** page first.',
    };
  }

  try {
    const saved = saveIdProof({
      travellerName: person,
      idType,
      idNumber: idNumber || existing?.idNumber || '',
      nameOnId,
      note,
      fileDataUrl: existing?.fileDataUrl,
      fileName: existing?.fileName,
    });
    return {
      ok: true,
      reply: [
        'Updated your **ID proof** on this phone.',
        '',
        `• **Type:** ${idTypeLabel(saved.idType)}`,
        saved.idNumber ? `• **Number:** ${saved.idNumber}` : '• **Number:** not entered',
        `• **Name on card:** ${saved.nameOnId}`,
        saved.note ? `• **Note:** ${saved.note}` : '',
        '',
        'Ask “show my ID proof” anytime for the latest details.',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  } catch (err) {
    return {
      ok: true,
      reply: err instanceof Error ? err.message : 'Could not update the ID proof.',
    };
  }
}
