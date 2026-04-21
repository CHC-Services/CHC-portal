type ResourceLink = {
  label: string
  description: string
  href: string
  badge?: string
  iconDomain: string   // domain used to pull the app logo automatically
}

// ─────────────────────────────────────────────────────────────────────────────
// SELF-CARE apps & tools
// To add a new app: copy any object below, fill in the fields, and set
// iconDomain to the app's website domain (e.g. "newapp.com"). That's it.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// SEEK ASSISTANCE — professional resources & helplines
// To add a new resource: copy any object below and fill in the fields.
// ─────────────────────────────────────────────────────────────────────────────
const seekAssistance: ResourceLink[] = [
  {
    label: 'SAMHSA National Helpline',
    description: 'Free, confidential 24/7 treatment referral service for mental health and substance use. Call or text 1-800-662-4357.',
    href: 'https://www.samhsa.gov/find-help/national-helpline',
    badge: 'Free · 24/7',
    iconDomain: 'samhsa.gov',
  },
]

// ── Decorative SVG lotus — used as a watermark ───────────────────────────────
function LotusWatermark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="currentColor" aria-hidden="true">
      {/* outer petals */}
      {[0,1,2,3,4,5,6,7].map(i => (
        <g key={i} transform={`rotate(${i * 45} 100 100)`}>
          <path d="M100,100 C91,78 89,54 100,40 C111,54 109,78 100,100" />
        </g>
      ))}
      {/* inner petals offset 22.5° — slightly smaller */}
      {[0,1,2,3,4,5,6,7].map(i => (
        <g key={`b${i}`} transform={`rotate(${i * 45 + 22.5} 100 100)`}>
          <path d="M100,100 C93,82 91,64 100,54 C109,64 107,82 100,100" opacity="0.55" />
        </g>
      ))}
      <circle cx="100" cy="100" r="8" />
    </svg>
  )
}

// ── App card ─────────────────────────────────────────────────────────────────
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MyCarePage() {
  return (
    <div
      className="min-h-screen p-6 md:p-8"
      style={{ background: 'linear-gradient(160deg, #dce8dc 0%, #e6ecee 55%, #d2dde5 100%)' }}
    >
      <div className="max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-3xl mb-8 px-8 py-9 border border-white/70 shadow-sm"
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

        {/* ── Callout ── */}
        <div
          className="relative overflow-hidden rounded-3xl shadow-sm p-7 mb-8 border-l-4 border-[#7A8F79]"
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

        {/* ── Self-Care ── */}
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

        {/* ── Seek Assistance ── */}
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

        {/* ── Footer breath ── */}
        <div className="text-center pb-4">
          <p className="font-cormorant text-lg italic text-[#7A8F79] opacity-70">
            Breathe in. Breathe out. You&apos;re doing better than you think. 🌸
          </p>
        </div>

      </div>
    </div>
  )
}
