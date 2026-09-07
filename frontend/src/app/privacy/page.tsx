import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — MineCAD AI',
  description: 'Privacy Policy for MineCAD AI — learn how we handle your data, AI prompts, and engineering project files.',
};

export default function PrivacyPage() {
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
          <div className="inline-block bg-info/10 border border-info/30 text-info text-xs font-mono px-3 py-1 rounded-full mb-4">
            Legal Document
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-fg-muted text-sm font-mono">
            Effective Date: <span className="text-info">{effectiveDate}</span> &nbsp;·&nbsp; Version 1.0
          </p>
        </div>

        <div className="space-y-8 text-[#c9d1d9] leading-relaxed text-sm">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">01.</span> Introduction
            </h2>
            <p>
              MineCAD AI (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy
              explains what information we collect, how we use it, and what rights you have in relation to it
              when you use MineCAD AI (the &ldquo;Service&rdquo;). We operate in compliance with the Information
              Technology Act, 2000 (India), and follow best practices aligned with the General Data Protection
              Regulation (GDPR) principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">02.</span> Information We Collect
            </h2>

            <div className="space-y-4">
              <div className="bg-surface-raised border border-edge rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2 text-sm">2.1 Information You Provide</h3>
                <ul className="list-none space-y-2">
                  {[
                    'Natural language prompts you submit to generate CAD designs',
                    'Engineering parameters you enter (bench heights, slope angles, etc.)',
                    'API keys you optionally configure for third-party AI providers',
                    'Survey data or coordinates you input for mine traverse calculations',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-info mt-0.5">▸</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-surface-raised border border-edge rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2 text-sm">2.2 Technical Information (Automatically Collected)</h3>
                <ul className="list-none space-y-2">
                  {[
                    'Browser type and version for compatibility purposes',
                    'Operating system type (macOS, Windows, Linux)',
                    'Referral URL and pages visited within the app',
                    'IP address (used for rate limiting and security, not tracking)',
                    'Session timing and feature usage frequency (anonymized)',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-info mt-0.5">▸</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-bg-base border border-success/40 rounded-lg p-4">
                <h3 className="text-[#3fb950] font-semibold mb-2 text-sm">✓ What We Do NOT Collect</h3>
                <ul className="list-none space-y-2">
                  {[
                    'We do NOT collect names, email addresses, or account credentials (no user accounts required)',
                    'We do NOT store your generated CAD files on our servers beyond the request lifecycle',
                    'We do NOT sell your data to advertisers or data brokers',
                    'We do NOT track your activity across other websites',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#3fb950] mt-0.5">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">03.</span> How We Use Your Information
            </h2>
            <p className="mb-3">We use the collected information to:</p>
            <ul className="list-none space-y-2 pl-4">
              {[
                'Process your natural language prompts and generate CAD geometry outputs',
                'Pass engineering parameters to geometry generators and exporters',
                'Route API keys to your chosen third-party AI provider (keys never stored on our servers)',
                'Monitor server health, error rates, and API response times',
                'Improve parsing accuracy and geometry generation quality over time',
                'Detect and prevent abuse, fraud, or unauthorized API access',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-info mt-0.5">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">04.</span> Data Retention
            </h2>
            <p className="mb-3">
              MineCAD AI is designed with a <strong className="text-white">minimal data retention</strong> approach:
            </p>
            <ul className="list-none space-y-2 pl-4">
              {[
                'Prompts and generated geometry are processed in-memory and not persisted to disk after request completion.',
                'API keys you enter are stored only in your browser\'s session memory and are never sent to our servers unencrypted.',
                'Server access logs (IP, timestamp, endpoint) are retained for up to 30 days for security purposes, then automatically deleted.',
                'Anonymized aggregate usage statistics (feature counts, not content) may be retained indefinitely.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-info mt-0.5">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">05.</span> Third-Party AI Providers &amp; Data Transfer
            </h2>
            <p className="mb-3">
              When you configure MineCAD AI to use a third-party AI provider, your prompts are transmitted
              directly to that provider&apos;s API. This data transfer is governed by that provider&apos;s privacy
              policy, not ours:
            </p>
            <div className="bg-surface-raised border border-edge rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge">
                    <th className="text-left px-4 py-3 text-fg-muted font-mono text-xs">Provider</th>
                    <th className="text-left px-4 py-3 text-fg-muted font-mono text-xs">Data Sent</th>
                    <th className="text-left px-4 py-3 text-fg-muted font-mono text-xs">Privacy Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {[
                    ['DeepSeek AI', 'Your prompt text', 'https://www.deepseek.com/privacy'],
                    ['Ollama (local)', 'Nothing – runs on your machine', 'N/A (local only)'],
                    ['Hugging Face', 'Your prompt text', 'https://huggingface.co/privacy'],
                  ].map(([provider, data, link]) => (
                    <tr key={provider}>
                      <td className="px-4 py-3 text-white font-mono text-xs">{provider}</td>
                      <td className="px-4 py-3 text-[#c9d1d9] text-xs">{data}</td>
                      <td className="px-4 py-3 text-xs">
                        {link.startsWith('http') ? (
                          <a href={link} target="_blank" rel="noopener noreferrer"
                             className="text-info hover:underline">View Policy</a>
                        ) : (
                          <span className="text-[#3fb950]">{link}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">06.</span> Security
            </h2>
            <p>
              We implement industry-standard technical measures to protect your data:
            </p>
            <ul className="list-none space-y-2 pl-4 mt-3">
              {[
                'All API communications are encrypted in transit using TLS 1.2+',
                'API keys are transmitted over HTTPS and never logged',
                'Backend server uses rate limiting and CORS restrictions',
                'No plaintext credentials are stored anywhere in our system',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#3fb950] mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">07.</span> Your Rights
            </h2>
            <p className="mb-3">Under applicable data protection law, you have the right to:</p>
            <ul className="list-none space-y-2 pl-4">
              {[
                'Access the personal data we hold about you',
                'Request correction of inaccurate personal data',
                'Request deletion of your personal data (right to erasure)',
                'Object to or restrict processing of your personal data',
                'Data portability — receive your data in a machine-readable format',
                'Withdraw consent at any time where processing is based on consent',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-info mt-0.5">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-fg-muted">
              Since MineCAD AI collects minimal personal data and does not require user accounts,
              most of these rights are automatically satisfied by our design.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">08.</span> Children&apos;s Privacy
            </h2>
            <p>
              MineCAD AI is a professional engineering tool intended for users aged 18 and older.
              We do not knowingly collect personal information from children under the age of 18.
              If you believe a child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">09.</span> Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you by updating the
              effective date at the top of this page. We encourage you to review this Privacy Policy
              periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-info font-mono">10.</span> Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or want to exercise your data rights,
              please reach out through the MineCAD AI platform terminal or open an issue on the project repository.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-edge flex flex-wrap gap-4 text-sm">
          <Link href="/terms" className="text-info hover:underline font-mono">Terms &amp; Conditions →</Link>
          <Link href="/cookies" className="text-info hover:underline font-mono">Cookie Policy →</Link>
          <Link href="/" className="text-info hover:underline font-mono">Back to App →</Link>
        </div>
      </main>
    </div>
  );
}
