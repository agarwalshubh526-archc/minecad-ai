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
          <div className="text-3xl mb-3">🎓</div>
          <p className="text-[11px] text-[#484f58] font-mono leading-relaxed">
            Generate a design first and I&apos;ll explain it part by part.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
      {sections.map((section, i) => (
        <div key={i} className="bg-[#161b22]/70 border border-[#30363d] rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-[#58a6ff] font-bold font-mono mb-2">
            {section.title}
          </div>
          <ul className="space-y-1.5">
            {section.points.map((point, j) => (
              <li key={j} className="text-[11px] text-[#8b949e] leading-relaxed flex gap-1.5">
                <span className="text-[#36d399] shrink-0">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
