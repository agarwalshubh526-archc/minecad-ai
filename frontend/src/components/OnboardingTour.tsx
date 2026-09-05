'use client';

import React, { useState, useSyncExternalStore } from 'react';

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

const STEPS = [
  {
    icon: '✍️',
    title: 'Describe your mine in plain English',
    body: 'No AutoCAD needed. Type something like "open pit with 5 benches 10m high" — or pick a ready-made template from the left panel to start instantly.',
    hint: '💡 Try the "Open Pit Mine" template if you just want to look around first.',
  },
  {
    icon: '🎚️',
    title: 'Tune every number yourself',
    body: 'Everything you typed becomes a slider-free, editable value in the right Properties panel. Hover (or tap) the ⓘ next to any parameter to learn what it means in real mining.',
    hint: '💡 Change "bench height" and watch the 3D pit change shape.',
  },
  {
    icon: '📐',
    title: 'View in 2D/3D, export like AutoCAD',
    body: 'Switch between plan-view 2D and an orbitable 3D model, measure distances on screen, and export your design as DXF (opens in AutoCAD), PDF, OBJ or STL.',
    hint: '💡 Exported DXF files open directly in AutoCAD or LibreCAD.',
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

  if (onboarded || dismissed) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-6 select-none">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-wider text-[#484f58] font-mono font-bold">
            Welcome to MineCAD AI — step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-[#484f58] hover:text-white text-sm px-2 py-1"
            title="Skip tour"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <div className="text-3xl mb-3">{current.icon}</div>
          <h2 className="text-base font-semibold text-[#e6edf3] mb-2">{current.title}</h2>
          <p className="text-xs text-[#8b949e] leading-relaxed">{current.body}</p>
          <p className="text-[11px] text-[#58a6ff] mt-3 font-mono">{current.hint}</p>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full ${i === step ? 'w-6 bg-[#1f6feb]' : 'w-1.5 bg-[#30363d]'}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="text-[11px] text-[#8b949e] hover:text-white font-mono px-3 py-2 transition-colors"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="text-xs text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] rounded-lg px-4 py-2 font-mono transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStep(step + 1))}
              className="text-xs text-white bg-[#1f6feb] hover:bg-[#388bfd] rounded-lg px-4 py-2 font-mono transition-colors"
            >
              {isLast ? 'Start designing 🚀' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
