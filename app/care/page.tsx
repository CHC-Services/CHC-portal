'use client'

import { useState } from 'react'

// ─── Update this URL when the BFLO Hydration site is ready ────────────────────
const BFLO_HYDRATION_URL = 'https://bfloiv.com'

type ResourceLink = {
  label: string
  description: string
  href: string
  badge?: string
  iconDomain: string
}

const selfCare: ResourceLink[] = [
  {
    label: 'How We Feel',
    description: 'Free iPhone app developed with Yale University to help you identify, track, and understand your emotions. Simple, science-backed, and beautifully designed.',
    href: 'https://howwefeel.org',
    badge: 'Free · iPhone',
    iconDomain: 'howwefeel.org',
  },
  {
    label: 'Insight Timer',
    description: 'Free app with thousands of guided meditations, sleep music, and breathing exercises. No subscription required.',
    href: 'https://insighttimer.com',
    badge: 'Free',
    iconDomain: 'insighttimer.com',
  },
  {
    label: 'Calm',
    description: 'Guided meditations, sleep stories, and stress-reduction programs. Includes a dedicated section for healthcare workers.',
    href: 'https://www.calm.com',
    badge: 'Subscription',
    iconDomain: 'calm.com',
  },
  {
    label: 'Headspace',
    description: 'Structured mindfulness courses with sessions as short as 3 minutes. Great for building a daily habit around a busy schedule.',
    href: 'https://www.headspace.com',
    badge: 'Subscription',
    iconDomain: 'headspace.com',
  },
  {
    label: 'Ten Percent Happier',
    description: 'Meditation for skeptics — practical, no-fluff approach built around real science. Popular with healthcare professionals.',
    href: 'https://www.tenpercent.com',
    badge: 'Subscription',
    iconDomain: 'tenpercent.com',
  },
]

const seekAssistance: ResourceLink[] = [
  {
    label: 'SAMHSA National Helpline',
    description: 'Free, confidential 24/7 treatment referral service for mental health and substance use. Call or text 1-800-662-4357.',
    href: 'https://www.samhsa.gov/find-help/national-helpline',
    badge: 'Free · 24/7',
    iconDomain: 'samhsa.gov',
  },
]

const musicStations = [
  {
    label: 'Lo-Fi Chill',
    mood: 'Focus & Unwind',
    videoId: 'jfKfPfyJRdk',
    emoji: '🎧',
  },
  {
    label: 'Healing Frequencies',
    mood: 'Calm & Restore',
    videoId: 'O4FBHwNLdaA',
    emoji: '🎵',
  },
  {
    label: 'Nature & Rain',
    mood: 'Ground & Reset',
    videoId: 'mPZkdNFkNps',
    emoji: '🌧️',
  },
]

// ── Decorative SVG lotus ──────────────────────────────────────────────────────
function LotusWatermark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="currentColor" aria-hidden="true">
      {[0,1,2,3,4,5,6,7].map(i => (
        <g key={i} transform={`rotate(${i * 45} 100 100)`}>
          <path d="M100,100 C91,78 89,54 100,40 C111,54 109,78 100,100" />
        </g>
      ))}
      {[0,1,2,3,4,5,6,7].map(i => (
        <g key={`b${i}`} transform={`rotate(${i * 45 + 22.5} 100 100)`}>
          <path d="M100,100 C93,82 91,64 100,54 C109,64 107,82 100,100" opacity="0.55" />
        </g>
      ))}
      <circle cx="100" cy="100" r="8" />
    </svg>
  )
}

function AppCard({ r }: { r: ResourceLink }) {
  return (
    <a
      href={r.href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ background: 'linear-gradient(145deg, #ffffff, #f1f7f1)' }}
      className="group flex flex-col gap-2.5 border border-[#cddacd] rounded-2xl p-4 hover:border-[#7A8F79] hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${r.iconDomain}&sz=64`}
          alt={r.label}
          className="w-10 h-10 rounded-xl object-contain flex-shrink-0 shadow-sm bg-white p-0.5"
        />
        <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
          <p className="font-semibold text-[#2F3E4E] text-sm group-hover:text-[#5d7a5d] transition-colors truncate">
            {r.label} →
          </p>
          {r.badge && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-[#e4efe4] text-[#3d6340] px-2 py-0.5 rounded-full">
              {r.badge}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-[#6a8a72] leading-relaxed">{r.description}</p>
    </a>
  )
}

type Tab = 'escape' | 'support' | 'refresh'

export default function MyCarePage() {
  const [activeTab, setActiveTab] = useState<Tab>('escape')

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'escape',  label: 'myEscape',  emoji: '🎶' },
    { id: 'support', label: 'mySupport', emoji: '🪷' },
    { id: 'refresh', label: 'myRefresh', emoji: '✨' },
  ]

  return (
    <div
      className="min-h-screen p-6 md:p-8"
      style={{ background: 'linear-gradient(160deg, #dce8dc 0%, #e6ecee 55%, #d2dde5 100%)' }}
    >
      <div className="max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div
          className="relative overflow-hidden rounded-3xl mb-6 px-8 py-9 border border-white/70 shadow-sm"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(237,245,237,0.80) 100%)' }}
        >
          <LotusWatermark className="absolute -right-6 -top-6 w-52 h-52 text-[#7A8F79] opacity-[0.13]" />
          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">my</span>Care
            </h1>
            <p className="font-cormorant text-xl text-[#5a7a62] italic mt-2 leading-snug">
              Resources for your personal health, mental wellness,<br className="hidden sm:block" /> and longevity in the profession.
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-6 bg-white/50 rounded-2xl p-1.5 border border-white/70 shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[#2F3E4E] text-white shadow-sm'
                  : 'text-[#7A8F79] hover:text-[#2F3E4E] hover:bg-white/60'
              }`}
            >
              <span>{tab.emoji}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.replace('my', '')}</span>
            </button>
          ))}
        </div>

        {/* ── myEscape ── */}
        {activeTab === 'escape' && (
          <div>
            {/* Tagline callout */}
            <div
              className="relative overflow-hidden rounded-3xl shadow-sm p-7 mb-6 border-l-4 border-[#7A8F79]"
              style={{ background: 'linear-gradient(135deg, #f8f4ec 0%, #edf6ed 100%)' }}
            >
              <LotusWatermark className="absolute -right-4 -bottom-6 w-32 h-32 text-[#7A8F79] opacity-[0.10]" />
              <p className="font-cormorant text-3xl text-[#2F3E4E] italic leading-snug mb-2 relative z-10">
                let the music set you free
              </p>
              <p className="text-sm text-[#6a8870] leading-relaxed relative z-10">
                Press play, close your eyes for a minute, and just breathe. These stations are here whenever
                you need a moment to step away from the weight of the day.
              </p>
            </div>

            {/* Music stations */}
            <div className="flex flex-col gap-5">
              {musicStations.map((station) => (
                <section
                  key={station.videoId}
                  className="overflow-hidden rounded-3xl shadow-sm border border-white/60"
                  style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.80), rgba(240,247,240,0.90))' }}
                >
                  <div
                    className="relative px-6 py-4 flex items-center gap-3 overflow-hidden"
                    style={{ background: 'linear-gradient(130deg, #7A8F79 0%, #56775a 100%)' }}
                  >
                    <span className="text-2xl">{station.emoji}</span>
                    <div>
                      <h2 className="font-cormorant text-xl font-bold text-white">{station.label}</h2>
                      <p className="text-xs text-white/75">{station.mood}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="relative rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${station.videoId}?rel=0&modestbranding=1`}
                        title={station.label}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <div className="text-center pt-6 pb-2">
              <p className="font-cormorant text-lg italic text-[#7A8F79] opacity-90">
                Breathe in. Breathe out. You&apos;re doing better than you think. 🌸
              </p>
            </div>
          </div>
        )}

        {/* ── mySupport ── */}
        {activeTab === 'support' && (
          <div>
            {/* Callout */}
            <div
              className="relative overflow-hidden rounded-3xl shadow-sm p-7 mb-6 border-l-4 border-[#7A8F79]"
              style={{ background: 'linear-gradient(135deg, #f8f4ec 0%, #edf6ed 100%)' }}
            >
              <LotusWatermark className="absolute -right-4 -bottom-6 w-32 h-32 text-[#7A8F79] opacity-[0.10]" />
              <p className="font-cormorant text-2xl text-[#2F3E4E] italic leading-snug mb-3 relative z-10">
                &ldquo;You can&apos;t pour from an empty cup.&rdquo;
              </p>
              <p className="text-sm text-[#6a8870] leading-relaxed relative z-10">
                Caregiving is demanding work, and compassion fatigue is real. Even 10 minutes of intentional
                rest can shift your entire day. The tools below are here to help you decompress, reset, and
                protect your mental health — because taking care of yourself is part of taking care of others.
              </p>
            </div>

            {/* Self-Care apps */}
            <section
              className="overflow-hidden rounded-3xl shadow-sm mb-6 border border-white/60"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.80), rgba(240,247,240,0.90))' }}
            >
              <div
                className="relative px-6 py-6 flex items-start gap-4 overflow-hidden"
                style={{ background: 'linear-gradient(130deg, #7A8F79 0%, #56775a 100%)' }}
              >
                <LotusWatermark className="absolute -right-4 -bottom-6 w-36 h-36 text-white opacity-[0.14]" />
                <span className="text-3xl relative z-10 mt-0.5">🪷</span>
                <div className="relative z-10">
                  <h2 className="font-cormorant text-2xl font-bold text-white tracking-wide">Self-Care</h2>
                  <p className="text-sm text-white/80 mt-1 leading-relaxed">
                    Apps and tools to decompress, build mindfulness habits, and gently check in with yourself.
                  </p>
                </div>
              </div>
              <div className="px-6 py-5 grid sm:grid-cols-2 gap-4">
                {selfCare.map((r, i) => <AppCard key={i} r={r} />)}
              </div>
            </section>

            {/* Seek Assistance */}
            <section
              className="overflow-hidden rounded-3xl shadow-sm mb-6 border border-white/60"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.80), rgba(240,246,245,0.90))' }}
            >
              <div
                className="relative px-6 py-6 flex items-start gap-4 overflow-hidden"
                style={{ background: 'linear-gradient(130deg, #4d7872 0%, #3a5c58 100%)' }}
              >
                <span className="text-3xl relative z-10 mt-0.5">🤝</span>
                <div className="relative z-10">
                  <h2 className="font-cormorant text-2xl font-bold text-white tracking-wide">Seek Assistance</h2>
                  <p className="text-sm text-white/80 mt-1 leading-relaxed">
                    Professional resources and helplines when you need more than an app can offer.
                  </p>
                </div>
              </div>
              <div className="px-6 py-5 grid sm:grid-cols-2 gap-4">
                {seekAssistance.map((r, i) => <AppCard key={i} r={r} />)}
              </div>
            </section>
          </div>
        )}

        {/* ── myRefresh ── */}
        {activeTab === 'refresh' && (
          <div>
            {/* Tagline callout */}
            <div
              className="relative overflow-hidden rounded-3xl shadow-sm p-7 mb-6 border-l-4 border-[#6aacac]"
              style={{ background: 'linear-gradient(135deg, #eef7f7 0%, #f0eef8 100%)' }}
            >
              <p className="font-cormorant text-2xl text-[#2F3E4E] italic leading-snug mb-3">
                Combat fatigue at the source — not just the symptoms.
              </p>
              <p className="text-sm text-[#4e7b87] leading-relaxed">
                Oxidative stress is one of the leading contributors to chronic fatigue in caregivers. Years of
                high-demand work, disrupted sleep, and emotional labor deplete the body&apos;s antioxidant reserves faster
                than diet alone can replenish them. The resources here are about giving your body what it needs
                to keep up with the work you already do.
              </p>
            </div>

            {/* BFLO Hydration promo card */}
            <section
              className="overflow-hidden rounded-3xl shadow-sm mb-6 border border-white/60"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.90), rgba(236,246,248,0.95))' }}
            >
              <div
                className="relative px-6 py-5 flex items-center justify-between gap-4 overflow-hidden"
                style={{ background: 'linear-gradient(130deg, #3d8c8c 0%, #2a6670 100%)' }}
              >
                <p className="relative z-10 text-sm text-white/80 leading-relaxed max-w-[55%]">
                  Vitamin-infused IVs & injections to restore what your body is missing.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bflologo.png" alt="BFLO Hydration" className="relative z-10 h-16 w-auto object-contain flex-shrink-0" />
              </div>

              {/* Nurse discount highlight */}
              <div className="relative overflow-hidden px-6 py-4 border-b border-[#c2e4e8]"
                style={{ background: 'linear-gradient(135deg, #eaf8f8 0%, #e4eff8 100%)' }}
              >
                {/* Animated shimmer bar */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="absolute top-0 left-0 h-full w-1/3 opacity-25"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(180,230,230,0.8), transparent)',
                      animation: 'shimmer 2.4s ease-in-out infinite',
                    }}
                  />
                </div>
                <style>{`
                  @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    60%  { transform: translateX(350%); }
                    100% { transform: translateX(350%); }
                  }
                `}</style>
                <div className="relative z-10 flex items-center gap-3">
                  <span className="text-2xl">🏥</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#3d8c8c] mb-0.5">Nurse Perk</p>
                    <p className="text-sm font-semibold text-[#1e4a55] leading-snug">
                      As a nurse, you receive <span className="text-[#3d8c8c] font-bold text-base">10% off</span> all IV services — just mention Coming Home Care at booking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <p className="text-sm text-[#3a5a65] leading-relaxed mb-5">
                  BFLO Hydration specializes in IV vitamin therapy and injection services designed to address
                  the root causes of fatigue — nutrient depletion, immune stress, and cellular oxidation.
                  Whether you&apos;re recovering from a long stretch of shifts or just looking to feel more like
                  yourself, targeted IV therapy can deliver results that supplements alone often can&apos;t match.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={BFLO_HYDRATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#3d8c8c] hover:bg-[#2a6670] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Visit BFLO Hydration →
                  </a>
                  <a
                    href="https://bfloiv.com/the-benefits/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border-2 border-[#3d8c8c] text-[#3d8c8c] hover:bg-[#3d8c8c] hover:text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
                  >
                    💉 IV Benefits?
                  </a>
                </div>
              </div>
            </section>

            {/* Coming soon article teaser */}
            <section
              className="overflow-hidden rounded-3xl shadow-sm mb-6 border border-dashed border-[#a8d4d8]"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.65), rgba(236,246,248,0.75))' }}
            >
              <div className="px-6 py-8 text-center">
                <p className="text-3xl mb-3">🌿</p>
                <p className="font-cormorant text-xl text-[#4e7b87] italic mb-2">More coming soon</p>
                <p className="text-sm text-[#7aaab5] leading-relaxed max-w-md mx-auto">
                  An in-depth guide on oxidative stress, antioxidant nutrition, and practical recovery
                  strategies for healthcare workers is in the works. Check back soon.
                </p>
              </div>
            </section>
          </div>
        )}

      </div>
    </div>
  )
}
