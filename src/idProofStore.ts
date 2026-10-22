export type IdProofType = 'aadhaar' | 'passport' | 'other';

export type IdProof = {
  travellerName: string;
  idType: IdProofType;
  idNumber: string;
  nameOnId: string;
  note: string;
  fileDataUrl?: string;
  fileName?: string;
  updatedAt: number;
};

const STORAGE_KEY = 'winter-himachal-id-proofs-v1';

function readAll(): IdProof[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IdProof[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(proofs: IdProof[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
  window.dispatchEvent(new CustomEvent('id-proofs-updated'));
}

export function listIdProofs(): IdProof[] {
  return readAll();
}

export function getIdProof(name: string): IdProof | undefined {
  const key = name.trim().toLowerCase();
  return readAll().find((proof) => proof.travellerName.trim().toLowerCase() === key);
}

export function saveIdProof(input: Omit<IdProof, 'updatedAt'>): IdProof {
  const next: IdProof = {
    ...input,
    travellerName: input.travellerName.trim(),
    idNumber: input.idNumber.trim(),
    nameOnId: input.nameOnId.trim(),
    note: input.note.trim(),
    updatedAt: Date.now(),
  };
  if (!next.travellerName) throw new Error('Choose a traveller first.');
  if (!next.idNumber && !next.fileDataUrl) {
    throw new Error('Add the ID number or upload a photo of the card.');
  }
  const proofs = readAll().filter(
    (proof) => proof.travellerName.trim().toLowerCase() !== next.travellerName.toLowerCase(),
  );
  proofs.push(next);
  try {
    writeAll(proofs);
  } catch {
    throw new Error('This phone could not store the file. Use a smaller photo of the card.');
  }
  return next;
}

export function deleteIdProof(name: string): void {
  const key = name.trim().toLowerCase();
  writeAll(readAll().filter((proof) => proof.travellerName.trim().toLowerCase() !== key));
}

export function subscribeIdProofs(listener: () => void): () => void {
  window.addEventListener('id-proofs-updated', listener);
  return () => window.removeEventListener('id-proofs-updated', listener);
}

export function idTypeLabel(type: IdProofType): string {
  if (type === 'aadhaar') return 'Aadhaar';
  if (type === 'passport') return 'Passport';
  return 'Other ID';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export function readProofFile(file: File): Promise<{ dataUrl: string; fileName: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > 1_200_000) {
      return Promise.reject(new Error('That PDF is too large. Take a photo of the card instead.'));
    }
    return readAsDataUrl(file).then((dataUrl) => ({ dataUrl, fileName: file.name }));
  }
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Upload a photo or a PDF of the ID.'));
  }
  return compressImage(file).then((dataUrl) => ({ dataUrl, fileName: file.name }));
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxEdge = 1400;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not prepare that photo.'));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo.'));
    };
    image.src = url;
  });
}
