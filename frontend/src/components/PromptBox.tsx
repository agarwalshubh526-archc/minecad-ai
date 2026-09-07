'use client';

import React from 'react';

interface PromptBoxProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  /** v2 parser confirmation — "Understood: open pit — 5 benches × 12 m …" */
  note?: { id: number; text: string } | null;
}

const EXAMPLES = [
  'Create an open pit mine with 10m bench height, 8m bench width, 22m haul road, and 55° overall slope.',
  'Design a room and pillar underground mine layout with 6m room width, 8m pillar width, 5 rooms by 4 rooms.',
  'Generate an underground ventilation network with 6 airways, 100m airway length, and 6m shaft diameter.',
  'Design a conveyor route with 200m length, 1.2m width, and 15 degrees inclination.',
  'Create a staggered blast pattern layout with 4m burden, 5m spacing, 4 rows, and 8 holes per row.',
  'Design a decline access tunnel with 4 levels, 30m level spacing, and 10% gradient.',
  'Increase overall slope to 62 degrees and reduce bench height to 8 meters.',
  'Add another level to the decline access.',
];

// One-tap starter prompts for beginners (fill + submit immediately)
const QUICK_CHIPS = [
  'open pit with 5 benches 10m high',
  'room and pillar coal mine',
  'ventilation network for a mine',
  'blast pattern for a quarry',
];

const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 mt-px">
    <circle cx="12" cy="12" r="10" strokeWidth="1.6" />
    <path d="m8.5 12.2 2.4 2.4 4.6-5" />
  </svg>
);

export default function PromptBox({ onGenerate, isGenerating, note = null }: PromptBoxProps) {
  const [prompt, setPrompt] = React.useState('');
  const [dismissedId, setDismissedId] = React.useState<number | null>(null);

  // Auto-dismiss the interpretation note after 4 s (keyed by note.id so a new
  // parse re-arms the timer)
  React.useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setDismissedId(note.id), 4000);
    return () => clearTimeout(t);
  }, [note]);

  const visibleNote = note && note.id !== dismissedId ? note : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <div className="bg-surface-raised border-t border-edge p-3 md:p-4 flex flex-col gap-3">
      {/* Parser interpretation confirmation (v2) — sleek inline pill */}
      {visibleNote && (
        <div
          key={visibleNote.id}
          className="flex items-start gap-2 bg-accent-dim border border-edge-accent rounded-lg px-3 py-2 text-[11px] font-mono text-fg animate-toast-in"
          role="status"
        >
          <span className="text-accent">{CheckIcon}</span>
          <span className="leading-relaxed">
            <span className="text-fg-faint">Understood:&nbsp;</span>
            {visibleNote.text}
          </span>
        </div>
      )}

      {/* One-tap suggestion chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onGenerate(chip)}
            disabled={isGenerating}
            className="chip shrink-0 text-[11px] px-3 py-1.5 font-mono disabled:opacity-40"
            title={chip}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Quick Examples */}
      <div>
        <div className="eyebrow mb-2">Suggested Engineering Prompts</div>
        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1 scrollbar-thin">
          {EXAMPLES.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(ex)}
              className="chip text-[10px] px-2.5 py-1 text-left font-mono max-w-[400px] truncate"
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Main input area */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder='Describe your mine in plain words — e.g. "open pit with 5 benches 10m high", "room and pillar coal mine"...'
            className="input w-full px-3 py-2 text-base md:text-xs font-mono h-14 resize-none leading-relaxed"
          />
        </div>
        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          className="btn-primary rounded-lg px-4 md:px-6 shrink-0 h-14 flex flex-col justify-center items-center text-xs font-mono tracking-[0.14em] disabled:opacity-40 disabled:pointer-events-none"
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-[#1c1305] animate-spin" />
              <span>WORKING</span>
            </div>
          ) : (
            <span>GENERATE</span>
          )}
        </button>
      </form>
    </div>
  );
}
