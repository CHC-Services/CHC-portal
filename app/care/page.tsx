type ResourceLink = {
  label: string
  description: string
  href: string
  badge?: string
}

const mentalWellness: ResourceLink[] = [
  {
    label: 'Insight Timer',
    description: 'Free app with thousands of guided meditations, sleep music, and breathing exercises. No subscription required.',
    href: 'https://insighttimer.com',
    badge: 'Free',
  },
  {
    label: 'Calm',
    description: 'Guided meditations, sleep stories, and stress-reduction programs. Includes a dedicated section for healthcare workers.',
    href: 'https://www.calm.com',
    badge: 'Subscription',
  },
  {
    label: 'Headspace',
    description: 'Structured mindfulness courses with sessions as short as 3 minutes. Great for building a daily habit around a busy schedule.',
    href: 'https://www.headspace.com',
    badge: 'Subscription',
  },
  {
    label: 'Ten Percent Happier',
    description: 'Meditation for skeptics — practical, no-fluff approach built around real science. Popular with healthcare professionals.',
    href: 'https://www.tenpercent.com',
    badge: 'Subscription',
  },
  {
    label: 'SAMHSA National Helpline',
    description: 'Free, confidential 24/7 treatment referral service for mental health and substance use. Call or text 1-800-662-4357.',
    href: 'https://www.samhsa.gov/find-help/national-helpline',
    badge: 'Free · 24/7',
  },
]

export default function MyCarePage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Care
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">
            Resources for your personal health, mental wellness, and longevity in the profession.
          </p>
        </div>

        {/* Compassion fatigue callout */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border-l-4 border-[#7A8F79]">
          <p className="text-sm font-semibold text-[#2F3E4E] mb-1">You can&apos;t pour from an empty cup.</p>
          <p className="text-sm text-[#7A8F79] leading-relaxed">
            Caregiving is demanding work, and compassion fatigue is real. Even 10 minutes of intentional
            rest can shift your entire day. The tools below are here to help you decompress, reset, and
            protect your mental health — because taking care of yourself is part of taking care of others.
          </p>
        </div>

        {/* Mental Wellness & Decompression */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="bg-[#2F3E4E] px-6 py-5 flex items-start gap-3">
            <span className="text-3xl">🧘</span>
            <div>
              <h2 className="text-xl font-bold text-white">Mental Wellness & Decompression</h2>
              <p className="text-sm text-[#D9E1E8] mt-1">
                Guided meditation, breathing exercises, and mental health support tools — many free or low-cost.
              </p>
            </div>
          </div>
          <div className="px-6 py-5 grid sm:grid-cols-2 gap-4">
            {mentalWellness.map((r, i) => (
              <a
                key={i}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-1.5 border border-[#D9E1E8] rounded-xl p-4 hover:border-[#7A8F79] hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#2F3E4E] text-sm group-hover:text-[#7A8F79] transition">{r.label} →</p>
                  {r.badge && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-[#D9E1E8] text-[#2F3E4E] px-2 py-0.5 rounded-full">
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#7A8F79] leading-relaxed">{r.description}</p>
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-3xl">💬</div>
          <div className="flex-1">
            <p className="font-semibold text-[#2F3E4E]">Need to talk to someone?</p>
            <p className="text-sm text-[#7A8F79] mt-0.5">
              If you&apos;re going through a difficult time, the Coming Home Care team is here to listen and help connect you with the right resources.
            </p>
          </div>
          <a
            href="mailto:support@cominghomecare.com?subject=SUPPORT%3A%20Personal%20Wellness&body=Hi%20CHC%20Team%2C%0A%0AI%20wanted%20to%20reach%20out%20about%20something%20personal.%0A%0A"
            className="shrink-0 bg-[#2F3E4E] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#7A8F79] transition"
          >
            Reach Out →
          </a>
        </div>

      </div>
    </div>
  )
}
