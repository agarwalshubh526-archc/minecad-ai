'use client';

import React, { useState, useSyncExternalStore, useEffect } from 'react';

const STORAGE_KEY = 'minecad-onboarded';

function readOnboarded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true; // storage unavailable — don't block the app
  }
}

// Server snapshot says "onboarded" so no overlay markup is rendered during
// SSR; React re-renders after hydration if localStorage says otherwise.
function useOnboarded() {
  return useSyncExternalStore(
    () => () => {},
    readOnboarded,
    () => true,
  );
}

const I = {
  pen: (
    <>
      <path d="M9.5 3 13 6.5 6 13.5H2.5V10L9.5 3Z" />
      <path d="M8 4.5l3.5 3.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M2.5 5h11M2.5 12h11" />
      <circle cx="6" cy="5" r="1.8" />
      <circle cx="10" cy="12" r="1.8" />
    </>
  ),
  cube: (
    <>
      <path d="M8 1.7 14.7 5v6.6L8 15 1.3 11.6V5L8 1.7Z" />
      <path d="M1.3 5 8 8.3 14.7 5M8 8.3V15" />
    </>
  ),
  bulb: (
    <>
      <path d="M8 1.5a4.5 4.5 0 0 1 2.6 8.2c-.5.4-.8.8-.8 1.3H6.2c0-.5-.3-.9-.8-1.3A4.5 4.5 0 0 1 8 1.5Z" />
      <path d="M6.5 13.5h3M7 15.5h2" />
    </>
  ),
};

function Icon({ d, className = 'w-5 h-5' }: { d: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d}
    </svg>
  );
}

const STEPS = [
  {
    icon: I.pen,
    title: 'Describe your mine in plain English',
    body: 'No AutoCAD needed. Type something like "open pit with 5 benches 10m high" — or pick a ready-made template from the left panel to start instantly.',
    hint: 'Try the "Open Pit Mine" template if you just want to look around first.',
  },
  {
    icon: I.sliders,
    title: 'Tune every number yourself',
    body: 'Everything you typed becomes a slider-free, editable value in the right Properties panel. Hover (or tap) the info icon next to any parameter to learn what it means in real mining.',
    hint: 'Change "bench height" and watch the 3D pit change shape.',
  },
  {
    icon: I.cube,
    title: 'View in 2D/3D, export like AutoCAD',
    body: 'Switch between plan-view 2D and an orbitable 3D model, measure distances on screen, and export your design as DXF (opens in AutoCAD), PDF, OBJ or STL.',
    hint: 'Exported DXF files open directly in AutoCAD or LibreCAD.',
  },
];

export default function OnboardingTour() {
  const onboarded = useOnboarded();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  // Esc closes the tour; arrow keys step through it
  useEffect(() => {
    if (onboarded || dismissed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, STEPS.length - 1));
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onboarded, dismissed]);

  if (onboarded || dismissed) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Welcome tour">
      <div className="w-full max-w-md card shadow-[var(--shadow-pop)] p-6 select-none animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <span className="eyebrow">
            Welcome to MineCAD AI — step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="btn p-1 text-fg-faint"
            title="Skip tour"
            aria-label="Skip tour"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
              <path d="M3 3l10 10M13 3 3 13" />
            </svg>
          </button>
        </div>

        <div className="mb-5">
          <div className="w-10 h-10 rounded-lg bg-accent-dim border border-edge-accent text-accent flex items-center justify-center mb-4">
            <Icon d={current.icon} />
          </div>
          <h2 className="text-base font-semibold text-fg mb-2 tracking-tight">{current.title}</h2>
          <p className="text-xs text-fg-muted leading-relaxed">{current.body}</p>
          <p className="text-[11px] text-info mt-3 font-mono flex items-start gap-1.5">
            <Icon d={I.bulb} className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{current.hint}</span>
          </p>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : 'w-1.5 bg-edge-strong'}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="text-[11px] text-fg-muted hover:text-fg font-mono px-3 py-2 transition-colors"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="btn text-xs px-4 py-2"
              >
                ← Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStep(step + 1))}
              className={`text-xs px-4 py-2 rounded-md font-medium transition-all ${isLast ? 'btn-primary' : 'btn'}`}
            >
              {isLast ? 'Start designing' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
