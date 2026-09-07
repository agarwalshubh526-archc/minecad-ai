'use client';

import React, { useMemo } from 'react';
import type { GeometryData } from '@/types';
import { buildExplanation } from '@/lib/explainDesign';

interface ExplainPanelProps {
  geometry: GeometryData | null;
}

export default function ExplainPanel({ geometry }: ExplainPanelProps) {
  const sections = useMemo(() => {
    if (!geometry) return null;
    const objectType =
      (typeof geometry.properties._object_type === 'string' && geometry.properties._object_type) ||
      '';
    return buildExplanation(objectType, geometry.properties);
  }, [geometry]);

  if (!geometry || !sections) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 mx-auto text-fg-faint mb-3" aria-hidden="true">
            <path d="M12 3 2.5 8.5v7L12 21l9.5-5.5v-7L12 3Z" />
            <path d="M2.5 8.5 12 14l9.5-5.5M12 14v7" />
          </svg>
          <p className="text-[11px] text-fg-faint font-mono leading-relaxed">
            Generate a design first and I&apos;ll explain it part by part.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
      {sections.map((section, i) => (
        <div key={i} className="bg-surface-overlay/60 border border-edge rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-info font-bold font-mono mb-2">
            {section.title}
          </div>
          <ul className="space-y-1.5">
            {section.points.map((point, j) => (
              <li key={j} className="text-[11px] text-fg-muted leading-relaxed flex gap-1.5">
                <span className="text-success shrink-0">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
