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
    <div className="bg-[#161b22] border-t border-[#30363d] p-3 md:p-4 flex flex-col gap-3">
      {/* Parser interpretation confirmation (v2) */}
      {visibleNote && (
        <div
          key={visibleNote.id}
          className="flex items-start gap-2 bg-[#052e16] border border-[#238636]/60 rounded-lg px-3 py-2 text-[11px] font-mono text-[#3fb950]"
          role="status"
        >
          <span className="shrink-0">✓</span>
          <span>
            <span className="text-[#8b949e]">Understood: </span>
            {visibleNote.text}
          </span>
        </div>
      )}

      {/* One-tap suggestion chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onGenerate(chip)}
            disabled={isGenerating}
            className="shrink-0 text-[11px] text-[#e6edf3] bg-[#1f6feb]/20 hover:bg-[#1f6feb] border border-[#1f6feb]/50 rounded-full px-3 py-1.5 transition-colors font-mono disabled:opacity-40"
            title={chip}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Quick Examples */}
      <div>
        <div className="text-[10px] text-[#8b949e] uppercase tracking-wider font-mono font-semibold mb-2">
          Suggested Engineering Prompts
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1 scrollbar-thin">
          {EXAMPLES.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(ex)}
              className="text-[10px] text-[#58a6ff] hover:text-white bg-[#0d1117] hover:bg-[#1f6feb] border border-[#30363d] rounded-full px-2.5 py-1 text-left transition-colors font-mono max-w-[400px] truncate"
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
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-base md:text-xs text-[#e6edf3] font-mono placeholder-[#484f58] focus:border-[#1f6feb] outline-none h-14 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          className="bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#238636]/40 disabled:text-[#8b949e]/40 text-white text-xs font-semibold rounded-lg px-3 md:px-5 shrink-0 flex flex-col justify-center items-center font-mono transition-colors"
        >
          {isGenerating ? (
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-t-transparent border-white animate-spin" />
              <span>Generating...</span>
            </div>
          ) : (
            <span>GENERATE</span>
          )}
        </button>
      </form>
    </div>
  );
}
