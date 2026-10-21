import React, { useEffect } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { FINAL_ROUTE_ITINERARY } from './finalRouteItineraryAssets';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function FinalRouteItineraryModal({ open, onClose }: Props) {
  const pdfUrl = FINAL_ROUTE_ITINERARY.pdf.path;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="allen-draft-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="final-itinerary-title"
      onClick={onClose}
    >
      <div className="allen-draft-modal" onClick={(e) => e.stopPropagation()}>
        <header className="allen-draft-head">
          <div>
            <h2 id="final-itinerary-title">{FINAL_ROUTE_ITINERARY.title}</h2>
            <p>
              {FINAL_ROUTE_ITINERARY.subtitle} — view or download the saved <b>final route itinerary</b> PDF.
            </p>
          </div>
          <button type="button" className="allen-draft-close" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="allen-draft-actions">
          <a className="button dark" href={pdfUrl} download={FINAL_ROUTE_ITINERARY.pdf.fileName}>
            <Download size={15} /> Download PDF
          </a>
          <a className="button pale" href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Open in new tab
          </a>
        </div>

        <div className="allen-draft-viewer">
          <iframe title="Final route itinerary PDF" src={pdfUrl} className="allen-draft-iframe" />
          <p className="allen-draft-ppt-note">
            <FileText size={12} /> If the preview is blank in your browser, use <b>Download PDF</b> or <b>Open in new tab</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
