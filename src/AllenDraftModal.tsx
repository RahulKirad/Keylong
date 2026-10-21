import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Presentation, X } from 'lucide-react';
import { ALLEN_DRAFT, allenDraftAbsoluteUrl, officePptEmbedUrl } from './allenDraftAssets';

type Tab = 'pdf' | 'ppt';

type Props = {
  open: boolean;
  initialTab?: Tab;
  onClose: () => void;
};

export default function AllenDraftModal({ open, initialTab = 'pdf', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pdfUrl = ALLEN_DRAFT.pdf.path;
  const pptUrl = ALLEN_DRAFT.ppt.path;
  const pptEmbed = useMemo(() => officePptEmbedUrl(pptUrl), [pptUrl]);

  if (!open) return null;

  return (
    <div className="allen-draft-backdrop" role="dialog" aria-modal="true" aria-labelledby="allen-draft-title" onClick={onClose}>
      <div className="allen-draft-modal" onClick={(e) => e.stopPropagation()}>
        <header className="allen-draft-head">
          <div>
            <h2 id="allen-draft-title">{ALLEN_DRAFT.title}</h2>
            <p>Saved copies: <b>Allen PDF</b> · <b>Allen PPT</b> — view here or download.</p>
          </div>
          <button type="button" className="allen-draft-close" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="allen-draft-tabs">
          <button type="button" className={tab === 'pdf' ? 'on' : ''} onClick={() => setTab('pdf')}>
            <FileText size={16} /> {ALLEN_DRAFT.pdf.navLabel}
          </button>
          <button type="button" className={tab === 'ppt' ? 'on' : ''} onClick={() => setTab('ppt')}>
            <Presentation size={16} /> {ALLEN_DRAFT.ppt.navLabel}
          </button>
        </div>

        <div className="allen-draft-actions">
          {tab === 'pdf' ? (
            <>
              <a className="button dark" href={pdfUrl} download={ALLEN_DRAFT.pdf.fileName}>
                <Download size={15} /> Download PDF
              </a>
              <a className="button pale" href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} /> Open in new tab
              </a>
            </>
          ) : (
            <>
              <a className="button dark" href={pptUrl} download={ALLEN_DRAFT.ppt.fileName}>
                <Download size={15} /> Download PPT
              </a>
              <a className="button pale" href={pptUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} /> Open in new tab
              </a>
            </>
          )}
        </div>

        <div className="allen-draft-viewer">
          {tab === 'pdf' ? (
            <iframe title="Allen PDF draft" src={pdfUrl} className="allen-draft-iframe" />
          ) : (
            <>
              <iframe title="Allen PPT draft" src={pptEmbed} className="allen-draft-iframe" />
              <p className="allen-draft-ppt-note">
                Slide preview uses Microsoft Office Online when your site is on HTTPS (e.g. Netlify). If the embed is
                blank, use <b>Download PPT</b> or open on a deployed link:{' '}
                <code>{allenDraftAbsoluteUrl(pptUrl)}</code>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
