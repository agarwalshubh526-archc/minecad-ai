'use client';

import React, { useRef, useEffect } from 'react';

interface CommandLineProps {
  history: string[];
  onCommandSubmit: (cmd: string) => void;
  activeProvider?: string;
}

export default function CommandLine({ history, onCommandSubmit, activeProvider = 'local' }: CommandLineProps) {
  const [inputValue, setInputValue] = React.useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      onCommandSubmit(inputValue.trim());
      setInputValue('');
    }
  };

  // Keep scrolled to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div className="h-24 md:h-32 shrink-0 bg-surface-sunken border-t border-edge flex flex-col overflow-hidden">
      {/* Window chrome: traffic-light dots + title + provider badge */}
      <div className="flex items-center gap-2 px-3 h-7 border-b border-edge shrink-0 select-none">
        <div className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-[#e5534b]/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#e8a33d]/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#3fb68b]/70" />
        </div>
        <span className="eyebrow ml-1">Terminal</span>
        <span className="flex-1" />
        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-semibold border ${
          activeProvider === 'deepseek'
            ? 'bg-success/10 text-success border-success/30'
            : 'bg-surface-overlay text-fg-muted border-edge'
        }`}>
          AI: {activeProvider.toUpperCase()}
        </span>
      </div>

      {/* Console log outputs */}
      <div
        ref={containerRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-xs text-fg-muted space-y-1 select-text scrollbar-thin leading-relaxed"
      >
        <div className="text-fg-faint border-b border-edge pb-1.5 mb-2 flex items-center justify-between flex-wrap gap-1">
          <span>MineCAD AI CLI Console v1.1.0</span>
        </div>
        {history.map((line, idx) => {
          let style = 'text-fg-muted';
          if (line.startsWith('Command:')) style = 'text-accent';
          else if (line.startsWith('Success:')) style = 'text-success';
          else if (line.startsWith('Error:')) style = 'text-danger';
          else if (line.startsWith('System:')) style = 'text-info';
          else if (line.startsWith('DeepSeek:')) style = 'text-success bg-success/10 px-1.5 py-0.5 rounded border-l-2 border-success';

          return (
            <div key={idx} className={`${style} whitespace-pre-wrap break-words`}>
              {line}
            </div>
          );
        })}
      </div>

      {/* CLI Input Line */}
      <div className="h-9 md:h-8 bg-surface-raised border-t border-edge flex items-center px-3 gap-2">
        <span className="font-mono text-xs text-accent select-none font-bold shrink-0" aria-hidden>
          ❯
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-base md:text-xs text-fg font-mono outline-none border-none caret-[#f7b84e]"
          placeholder='Type command or "deepseek <query>" (e.g., "bench_height 12", "help")'
        />
      </div>
    </div>
  );
}
