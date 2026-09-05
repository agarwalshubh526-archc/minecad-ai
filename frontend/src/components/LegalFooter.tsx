'use client';

import React from 'react';
import Link from 'next/link';

export default function LegalFooter() {
  return (
    <footer className="shrink-0 bg-[#161b22] border-t border-[#30363d] px-6 py-2 flex items-center justify-between flex-wrap gap-2">
      {/* Left: branding + copyright */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gradient-to-br from-[#f97316] to-[#ef4444] rounded-sm" />
          <span className="font-mono text-[10px] font-semibold text-[#8b949e]">MineCAD AI</span>
        </div>
        <span className="text-[#484f58] text-[10px] font-mono">·</span>
        <span className="text-[#484f58] text-[10px] font-mono">
          © {new Date().getFullYear()} MineCAD AI. All rights reserved.
        </span>
      </div>

      {/* Right: legal links */}
      <nav className="flex items-center gap-4">
        {[
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Cookies', href: '/cookies' },
        ].map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-[#8b949e] hover:text-[#58a6ff] transition-colors"
          >
            {label}
          </Link>
        ))}
        <span className="text-[#484f58] text-[10px] font-mono">·</span>
        <span className="text-[10px] font-mono text-[#484f58]">
          AI outputs require professional engineering review
        </span>
      </nav>
    </footer>
  );
}
