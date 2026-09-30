import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Conditions — MineCAD AI',
  description: 'Terms and Conditions governing the use of MineCAD AI, an AI-powered CAD platform for mining engineering.',
};

export default function TermsPage() {
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

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="inline-block bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316] text-xs font-mono px-3 py-1 rounded-full mb-4">
            Legal Document
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Terms &amp; Conditions</h1>
          <p className="text-fg-muted text-sm font-mono">
            Effective Date: <span className="text-info">{effectiveDate}</span> &nbsp;·&nbsp; Version 1.0
          </p>
        </div>

        <div className="space-y-8 text-[#c9d1d9] leading-relaxed text-sm">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">01.</span> Agreement to Terms
            </h2>
            <p>
              By accessing or using MineCAD AI (&ldquo;the Service&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;), you agree to be bound by
              these Terms &amp; Conditions. If you disagree with any part of these terms, you do not have
              permission to access the Service. These Terms apply to all users, including visitors, registered
              users, and mining engineering professionals.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">02.</span> Description of Service
            </h2>
            <p className="mb-3">
              MineCAD AI is an AI-powered CAD (Computer-Aided Design) platform specifically built for mining
              engineers, surveyors, and geotechnical professionals. The Service provides:
            </p>
            <ul className="list-none space-y-2 pl-4">
              {[
                'AI-driven natural language to 2D/3D CAD geometry generation',
                'Mine surveying traverse computation and topographic contour mapping',
                'Blast pattern design, ventilation network layout, and decline access planning',
                'Conceptual pit geometry with a clear notice that slope stability is not assessed',
                'Engineering drawing export in DXF, SVG, PDF, OBJ, and STL formats',
                'DeepSeek AI terminal integration for mining engineering queries',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#f97316] mt-0.5">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">03.</span> Professional Disclaimer &amp; No Engineering Warranty
            </h2>
            <div className="bg-[#f97316]/5 border border-[#f97316]/25 rounded-lg p-4 mb-3">
              <p className="text-[#f97316] font-semibold text-xs font-mono mb-2">⚠ CRITICAL SAFETY NOTICE</p>
              <p>
                MineCAD AI generates <strong className="text-white">preliminary conceptual designs only</strong>.
                All outputs — including pit geometry, blast patterns, ventilation designs, and
                survey traverses — must be reviewed, verified, and validated by a <strong className="text-white">licensed
                and qualified mining engineer or geotechnical engineer</strong> before use in any real-world
                mining operation.
              </p>
            </div>
            <p className="mb-3">
              The Service does <strong className="text-white">NOT</strong> replace professional engineering judgment.
              You expressly agree that:
            </p>
            <ul className="list-none space-y-2 pl-4">
              {[
                'AI-generated designs are conceptual aids, not certified engineering documents.',
                'The Service does not calculate a site-specific factor of safety.',
                'Blast patterns require approval from licensed explosives engineers and regulatory bodies.',
                'All survey data must be independently checked against control points.',
                'Geotechnical recommendations must comply with local mining safety regulations.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#ef4444] mt-0.5">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">04.</span> Intellectual Property
            </h2>
            <p className="mb-3">
              The MineCAD AI platform, including all software, algorithms, user interface designs, and
              documentation, is owned by the developer and protected under applicable copyright and intellectual
              property laws.
            </p>
            <p>
              CAD designs and geometry files <strong className="text-white">you generate</strong> using the Service
              belong to you. You retain full ownership of the output data you export. However, you grant us a
              non-exclusive, royalty-free license to use anonymized usage patterns for service improvement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">05.</span> Acceptable Use Policy
            </h2>
            <p className="mb-3">You agree NOT to use MineCAD AI to:</p>
            <ul className="list-none space-y-2 pl-4">
              {[
                'Design illegal or unauthorized mining operations in violation of local laws.',
                'Reverse engineer, decompile, or extract the Service\'s source code.',
                'Transmit malware, viruses, or harmful code through the platform.',
                'Attempt to gain unauthorized access to backend infrastructure.',
                'Resell or commercially redistribute the Service without authorization.',
                'Generate or use outputs that endanger human life or violate safety regulations.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#ef4444] mt-0.5">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">06.</span> Third-Party AI Services
            </h2>
            <p>
              MineCAD AI optionally integrates with <strong className="text-white">DeepSeek AI</strong>.
              When selected, your prompt and API key pass through this site to DeepSeek. We are not responsible for the policies, data handling,
              or availability of these third-party services. You must comply with their respective Terms of Service:
            </p>
            <ul className="mt-3 list-none space-y-1 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-info">→</span>
                <a href="https://www.deepseek.com/terms" target="_blank" rel="noopener noreferrer"
                   className="text-info hover:underline">DeepSeek Terms of Service</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">07.</span> Limitation of Liability
            </h2>
            <div className="bg-surface-raised border border-edge rounded-lg p-4">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, MINECAD AI AND ITS DEVELOPERS SHALL NOT BE LIABLE
                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM
                YOUR USE OF OR INABILITY TO USE THE SERVICE, INCLUDING ANY ENGINEERING DECISIONS MADE BASED
                ON AI-GENERATED DESIGNS.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">08.</span> Disclaimer of Warranties
            </h2>
            <p>
              THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
              WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT DEFECTS WILL BE CORRECTED.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">09.</span> Regulatory Compliance
            </h2>
            <p>
              Mining operations are subject to extensive regulatory frameworks varying by jurisdiction (e.g.,
              DGMS in India, MSHA in the United States, HSE in the UK). You are solely responsible for
              ensuring that any designs, layouts, or analyses generated using MineCAD AI comply with all
              applicable local, state/provincial, and national mining safety laws and regulations. MineCAD AI
              makes no representations about regulatory compliance of generated outputs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">10.</span> Modifications to Terms
            </h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective immediately
              upon posting the updated Terms with a new effective date. Your continued use of the Service
              after any changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">11.</span> Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India, without
              regard to its conflict of law provisions. Any disputes arising under these Terms shall be
              subject to the exclusive jurisdiction of courts in India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-[#f97316] font-mono">12.</span> Contact
            </h2>
            <p>
              For questions about these Terms, please contact us through the MineCAD AI platform&apos;s
              built-in terminal or raise an issue on our project repository.
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-edge flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="text-info hover:underline font-mono">Privacy Policy →</Link>
          <Link href="/cookies" className="text-info hover:underline font-mono">Cookie Policy →</Link>
          <Link href="/" className="text-info hover:underline font-mono">Back to App →</Link>
        </div>
      </main>
    </div>
  );
}
