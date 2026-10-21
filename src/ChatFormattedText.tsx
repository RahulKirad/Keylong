import React from 'react';

/** Renders assistant text: **bold**, bullet lines (• or *), short paragraphs. */
export default function ChatFormattedText({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="chat-formatted">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const isList = lines.every((l) => /^[\s]*[•*\-]\s/.test(l) || lines.length === 1);
        if (isList && lines.some((l) => /^[\s]*[•*\-]\s/.test(l))) {
          return (
            <ul key={bi} className="chat-list">
              {lines.map((line, li) => (
                <li key={li}>{formatInline(line.replace(/^[\s]*[•*\-]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="chat-para">
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {formatInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(line: string): React.ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
