import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import {
  clearTravellerPhoto,
  getTravellerPhoto,
  readProfilePhotoFile,
  saveTravellerProfile,
  subscribeTravellerProfiles,
} from './travellerProfileStore';

type Props = {
  name: string;
  personId?: string;
  size?: 'sm' | 'md' | 'lg';
  /** When true, show camera control to upload / replace / clear. */
  editable?: boolean;
  className?: string;
};

export default function TravellerAvatar({
  name,
  personId,
  size = 'md',
  editable = false,
  className = '',
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | undefined>(() => getTravellerPhoto(personId || name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const refresh = () => setPhoto(getTravellerPhoto(personId || name));
    refresh();
    return subscribeTravellerProfiles(refresh);
  }, [name, personId]);

  async function onFile(file: File | undefined) {
    if (!file || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await readProfilePhotoFile(file);
      saveTravellerProfile({
        personId,
        personName: name,
        photoDataUrl: dataUrl,
      });
      setPhoto(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload photo.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removePhoto() {
    if (!name.trim()) return;
    if (!window.confirm(`Remove profile photo for ${name}?`)) return;
    clearTravellerPhoto(personId || name);
    setPhoto(undefined);
  }

  const initial = (name.trim()[0] || '?').toUpperCase();

  return (
    <div className={`traveller-avatar-wrap traveller-avatar-${size}${className ? ` ${className}` : ''}`}>
      <div className={`traveller-avatar${photo ? ' has-photo' : ''}`} title={name}>
        {photo ? <img src={photo} alt="" /> : <span aria-hidden>{initial}</span>}
      </div>
      {editable && (
        <div className="traveller-avatar-actions">
          <label htmlFor={inputId} className="traveller-avatar-upload" title={photo ? 'Change photo' : 'Add photo'}>
            <Camera size={size === 'sm' ? 11 : 13} />
            <span className="sr-only">{photo ? 'Change photo' : 'Add photo'}</span>
            <input
              id={inputId}
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              disabled={busy}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
          {photo && (
            <button
              type="button"
              className="traveller-avatar-clear"
              aria-label={`Remove photo for ${name}`}
              title="Remove photo"
              disabled={busy}
              onClick={removePhoto}
            >
              <Trash2 size={size === 'sm' ? 11 : 13} />
            </button>
          )}
        </div>
      )}
      {error ? <p className="traveller-avatar-error">{error}</p> : null}
    </div>
  );
}
