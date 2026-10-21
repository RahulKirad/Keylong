/** Allen’s Winter Spiti / Himachal itinerary drafts (static files in /public). */
export const ALLEN_DRAFT = {
  title: 'Allen draft — Winter Spiti & Himachal',
  shortLabel: 'Allen draft',
  navbarHint: '(Allen PDF · Allen PPT)',
  pdf: {
    fileName: 'Winter-Spiti-Himachal-Allen-Draft.pdf',
    path: '/allen-draft/winter-spiti-himachal-itinerary.pdf',
    navLabel: 'Allen PDF',
  },
  ppt: {
    fileName: 'Winter-Spiti-Himachal-Allen-Draft.pptx',
    path: '/allen-draft/winter-spiti-himachal-itinerary.pptx',
    navLabel: 'Allen PPT',
  },
} as const;

export function allenDraftAbsoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).href;
}

export function officePptEmbedUrl(pptPath: string): string {
  const absolute = allenDraftAbsoluteUrl(pptPath);
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absolute)}`;
}
