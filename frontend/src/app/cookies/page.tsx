import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy — MineCAD AI',
  description: 'Cookie Policy for MineCAD AI — understand how cookies and local storage are used in our engineering CAD platform.',
};

export default function CookiesPage() {
  const effectiveDate = 'September 4, 2026';

  return (
    <div className="min-h-screen bg-bg-base text-fg font-sans">
      {/* Header */}
      <header className="border-b border-edge bg-surface-raised sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-info hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="font-mono text-sm font-semibold">Back to MineCAD AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gradient-to-br from-[#f97316] to-[#ef4444] rounded" />
            <span className="font-mono font-bold text-sm text-white">MineCAD AI</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="inline-block bg-[#3fb950]/10 border border-[#3fb950]/30 text-[#3fb950] text-xs font-mono px-3 py-1 rounded-full mb-4">
            Legal Document
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Cookie Policy</h1>
          <p className="text-fg-muted text-sm font-mono">
            Effective Date: <span className="text-info">{effectiveDate}</span> &nbsp;·&nbsp; Version 1.0
          </p>
        </div>

        <div className="space-y-8 text-[#c9d1d9] leading-relaxed text-sm">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">01.</span> What Are Cookies?
            </h2>
            <p>
              Cookies are small text files placed on your device when you visit a website. They are widely
              used to make websites work efficiently and to provide analytical information to site owners.
              In addition to traditional cookies, we also use browser <strong className="text-white">Local Storage</strong> and
              <strong className="text-white"> Session Storage</strong> for application state management.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">02.</span> How MineCAD AI Uses Storage
            </h2>
            <p className="mb-4">
              MineCAD AI uses a <strong className="text-white">minimal cookie footprint</strong>.
              We prioritize browser-side storage for user preferences rather than server-set tracking cookies:
            </p>

            <div className="bg-surface-raised border border-edge rounded-lg overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-edge bg-bg-base">
                <span className="text-fg-muted font-mono text-xs uppercase tracking-wider">Essential / Functional Storage</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge">
                    <th className="text-left px-4 py-3 text-fg-muted font-mono text-xs">Name</th>
                    <th className="text-left px-4 py-3 text-fg-muted font-mono text-xs">Type</th>
                    <th className="text-left px-4 py-3 text-fg-muted font-mono text-xs">Purpose</th>
                    <th className="text-left px-4 py-3 text-fg-muted font-mono text-xs">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {[
                    ['minecad_ai_config', 'Local Storage', 'Stores your AI provider preference (local/deepseek/ollama) and model selection', 'Until manually cleared'],
                    ['minecad_view_mode', 'Local Storage', 'Remembers 2D/3D view preference', 'Until manually cleared'],
                    ['minecad_sidebar_state', 'Session Storage', 'Sidebar collapse/expand state during your session', 'Session end'],
                    ['minecad_cmd_history', 'Session Storage', 'Terminal command history during active session', 'Session end'],
                    ['minecad_projects', 'Local Storage', 'Your current working project files and geometry data', 'Until manually cleared'],
                  ].map(([name, type, purpose, expires]) => (
                    <tr key={name}>
                      <td className="px-4 py-3 font-mono text-xs text-[#f97316]">{name}</td>
                      <td className="px-4 py-3 text-xs text-info">{type}</td>
                      <td className="px-4 py-3 text-xs text-[#c9d1d9]">{purpose}</td>
                      <td className="px-4 py-3 text-xs text-fg-muted">{expires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-bg-base border border-success/40 rounded-lg p-4">
              <h3 className="text-[#3fb950] font-semibold mb-2 text-sm">✓ Tracking Cookies: None</h3>
              <p>
                MineCAD AI does <strong className="text-white">NOT</strong> use:
              </p>
              <ul className="mt-2 list-none space-y-1">
                {[
                  'Google Analytics or any behavioural tracking cookies',
                  'Facebook Pixel or social media tracking',
                  'Advertising or retargeting cookies',
                  'Cross-site tracking mechanisms',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#3fb950] mt-0.5">✓</span>
                    <span className="text-[#c9d1d9]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">03.</span> Third-Party Storage
            </h2>
            <p className="mb-3">
              Certain third-party services integrated with MineCAD AI may set their own cookies
              or storage when their APIs are invoked from your browser:
            </p>
            <ul className="list-none space-y-2 pl-4">
              {[
                'Next.js framework may set internal route-caching state in session storage.',
                'Font loading from Google Fonts CDN may involve CDN-level caching headers (not tracking cookies).',
                'If you directly configure a DeepSeek or Hugging Face API call from the browser, those requests are subject to their respective cookie policies.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-fg-muted mt-0.5">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">04.</span> API Keys in Storage
            </h2>
            <div className="bg-[#f97316]/5 border border-[#f97316]/25 rounded-lg p-4">
              <p className="text-[#f97316] font-semibold text-xs font-mono mb-2">⚠ Security Notice</p>
              <p>
                If you choose to save your third-party AI API keys (DeepSeek, Hugging Face) in the
                MineCAD AI settings, those keys are stored in your browser&apos;s <strong className="text-white">Local Storage</strong>.
                This is standard practice for client-side applications, but carries inherent risk on
                shared or public computers. We recommend:
              </p>
              <ul className="mt-3 list-none space-y-1">
                {[
                  'Do not save API keys on shared/public computers.',
                  'Clear browser local storage after using MineCAD AI on untrusted devices.',
                  'Use restricted API keys with usage limits from your AI provider\'s dashboard.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#f97316] mt-0.5">!</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">05.</span> Managing &amp; Clearing Storage
            </h2>
            <p className="mb-3">You have full control over browser storage. To clear MineCAD AI data:</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  browser: 'Chrome / Edge',
                  steps: 'Settings → Privacy and security → Clear browsing data → Cookies and site data'
                },
                {
                  browser: 'Firefox',
                  steps: 'Settings → Privacy & Security → Cookies and Site Data → Clear Data'
                },
                {
                  browser: 'Safari',
                  steps: 'Preferences → Privacy → Manage Website Data → Remove all'
                },
                {
                  browser: 'Developer Tools',
                  steps: 'F12 → Application/Storage tab → Local Storage → Right-click → Clear'
                },
              ].map(({ browser, steps }) => (
                <div key={browser} className="bg-surface-raised border border-edge rounded-lg p-3">
                  <div className="text-white font-semibold text-xs font-mono mb-2">{browser}</div>
                  <div className="text-fg-muted text-xs leading-relaxed">{steps}</div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-fg-muted text-xs">
              Note: Clearing storage will reset your AI provider settings, project files stored in the browser,
              and view preferences. Exported files (DXF, PDF, SVG, etc.) saved to your computer are not affected.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">06.</span> Consent
            </h2>
            <p>
              By using MineCAD AI, you consent to our use of functional browser storage as described in this
              Cookie Policy. Since we do not use advertising or tracking cookies, no cookie consent banner
              is required under most jurisdictions. However, we disclose all storage use transparently through
              this policy in the spirit of full compliance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">07.</span> Updates to This Policy
            </h2>
            <p>
              We may update this Cookie Policy when we add new features that use storage. The effective date
              at the top of the page will always reflect when it was last modified. Please review this page
              periodically.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#3fb950] font-mono">08.</span> Contact
            </h2>
            <p>
              For questions about our cookie and storage practices, please contact us through the MineCAD AI
              platform terminal or the project repository.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-edge flex flex-wrap gap-4 text-sm">
          <Link href="/terms" className="text-info hover:underline font-mono">Terms &amp; Conditions →</Link>
          <Link href="/privacy" className="text-info hover:underline font-mono">Privacy Policy →</Link>
          <Link href="/" className="text-info hover:underline font-mono">Back to App →</Link>
        </div>
      </main>
    </div>
  );
}
