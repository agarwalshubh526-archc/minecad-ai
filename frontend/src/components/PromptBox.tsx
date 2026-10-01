'use client';

import React from 'react';

interface PromptBoxProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  /** v2 parser confirmation — "Understood: open pit — 5 benches × 12 m …" */
  note?: { id: number; text: string } | null;
  error?: string;
  method?: string;
  feedback?: string[];
  componentCount?: number;
}

const EXAMPLES = [
  'Create an open pit with 5 benches and a 200m conveyor.',
  'Add a ventilation network to this layout.',
  'Create an open pit mine with 10m bench height, 8m bench width, and 22m haul road.',
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

export default function PromptBox({ onGenerate, isGenerating, note = null, error = '', method = '', feedback = [], componentCount = 0 }: PromptBoxProps) {
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
    <div className="shrink-0 bg-surface-raised border-b border-edge p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold tracking-wide text-fg">Describe your mine</div>
          <div className="text-[10px] text-fg-muted mt-0.5">Create a layout, then add or change individual components.</div>
        </div>
        <div className="text-[10px] font-mono text-accent whitespace-nowrap">{componentCount} COMPONENT{componentCount === 1 ? '' : 'S'}</div>
      </div>
      {error && <div role="alert" className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</div>}
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

      <details className="text-[10px] text-fg-muted">
        <summary className="cursor-pointer hover:text-fg">Prompt examples and supported components</summary>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 mt-2 scrollbar-thin">
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
        <p className="mt-2">Supported: pits, room and pillar, ventilation, conveyors, blast patterns, declines, survey traverses, contours, borehole sections, longwall panels, cut and fill. Unsupported requests stop before creating a partial design.</p>
      </details>

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
            placeholder='Create an open pit with 5 benches and a conveyor. Then try: add a ventilation network...'
            aria-label="Describe a conceptual mining design"
            className="input w-full px-3 py-2 text-base md:text-sm font-mono h-14 resize-none leading-relaxed"
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
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_CHIPS.map(chip => <button key={chip} type="button" onClick={() => onGenerate(`Create ${chip}`)} disabled={isGenerating} className="chip shrink-0 text-[10px] px-2.5 py-1 font-mono disabled:opacity-40">{chip}</button>)}
      </div>
      <div className="text-[10px] text-fg-faint" role="status">{method}. Conceptual geometry; dimensions and connections require review.</div>
      {feedback.length > 0 && <div className="max-h-16 overflow-y-auto text-[10px] text-warn" role="note">{feedback.map((item, index) => <p key={index}>{item}</p>)}</div>}
    </div>
  );
}
