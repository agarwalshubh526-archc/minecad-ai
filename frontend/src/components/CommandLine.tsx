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
    <div className="h-32 bg-[#0d1117] border-t border-[#30363d] flex flex-col overflow-hidden">
      {/* Console log outputs */}
      <div
        ref={containerRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-xs text-[#8b949e] space-y-1 select-text scrollbar-thin"
      >
        <div className="text-[#30363d] border-b border-[#30363d]/50 pb-1 mb-2 flex items-center justify-between flex-wrap gap-1">
          <span>MineCAD AI CLI Terminal Console v1.1.0</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
            activeProvider === 'deepseek'
              ? 'bg-[#052e16] text-[#36d399] border border-[#15803d]'
              : 'bg-[#161b22] text-[#8b949e]'
          }`}>
            AI Provider: {activeProvider.toUpperCase()}
          </span>
        </div>
        {history.map((line, idx) => {
          let style = 'text-[#8b949e]';
          if (line.startsWith('Command:')) style = 'text-[#58a6ff]';
          else if (line.startsWith('Success:')) style = 'text-[#3fb950]';
          else if (line.startsWith('Error:')) style = 'text-[#f85149]';
          else if (line.startsWith('System:')) style = 'text-[#d38aea]';
          else if (line.startsWith('DeepSeek:')) style = 'text-[#36d399] bg-[#052e16]/30 px-1 py-0.5 rounded border-l-2 border-[#36d399]';

          return (
            <div key={idx} className={`${style} whitespace-pre-wrap break-words`}>
              {line}
            </div>
          );
        })}
      </div>

      {/* CLI Input Line */}
      <div className="h-9 md:h-8 bg-[#161b22] border-t border-[#30363d] flex items-center px-3 gap-2">
        <span className="font-mono text-xs text-[#58a6ff] select-none font-bold shrink-0">
          Command:
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-base md:text-xs text-[#e6edf3] font-mono outline-none border-none"
          placeholder='Type command or "deepseek <query>" (e.g., "deepseek how to design bench height", "bench_height 12", "help")'
        />
      </div>
    </div>
  );
}

