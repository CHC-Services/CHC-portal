'use client'

import { useState, useEffect } from 'react'
import {
  type PortalSettings,
  DEFAULTS,
  GUTTER_COLORS,
  loadSettings,
  saveSettings,
  applySettings,
} from '@/lib/portalSettings'

const FONT_SIZE_OPTIONS: { value: PortalSettings['fontSize']; label: string; desc: string }[] = [
  { value: 'xs', label: 'XS', desc: '12px' },
  { value: 'sm', label: 'S',  desc: '13px' },
  { value: 'md', label: 'M',  desc: '14px — default' },
  { value: 'lg', label: 'L',  desc: '15px' },
]

const DENSITY_OPTIONS: { value: PortalSettings['density']; label: string; desc: string }[] = [
  { value: 'compact',  label: 'Compact',  desc: 'Tighter rows & blocks' },
  { value: 'default',  label: 'Default',  desc: 'Standard spacing' },
  { value: 'relaxed',  label: 'Relaxed',  desc: 'More breathing room' },
]

const RADIUS_OPTIONS: { value: PortalSettings['radius']; label: string; desc: string }[] = [
  { value: 'sharp',   label: 'Sharp',   desc: '6px — angular' },
  { value: 'default', label: 'Default', desc: '12px — current' },
  { value: 'rounded', label: 'Rounded', desc: '20px — soft' },
]

const ELEVATION_OPTIONS: { value: PortalSettings['elevation']; label: string; desc: string }[] = [
  { value: 'flat',    label: 'Flat',    desc: 'No shadow' },
  { value: 'default', label: 'Default', desc: 'Subtle lift' },
  { value: 'raised',  label: 'Raised',  desc: 'Pronounced depth' },
]

const pill = (active: boolean) =>
  `flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
    active
      ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
      : 'bg-white text-[#2F3E4E] border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]'
  }`

const sectionTitle = 'text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]'

export default function NurseAppearancePage() {
  const [settings, setSettings] = useState<PortalSettings>(DEFAULTS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  function update<K extends keyof PortalSettings>(key: K, value: PortalSettings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    applySettings(next)
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  function handleReset() {
    setSettings(DEFAULTS)
    applySettings(DEFAULTS)
    saveSettings(DEFAULTS)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Appearance
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Customize how the portal looks and feels. Changes apply instantly.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">Saved</span>}
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-[#7A8F79] border border-[#D9E1E8] bg-white px-4 py-2 rounded-lg hover:border-[#7A8F79] transition"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Text Size */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className={sectionTitle}>Text Size</p>
          <div className="flex gap-2">
            {FONT_SIZE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => update('fontSize', o.value)} className={pill(settings.fontSize === o.value)}>
                <span className="block text-base leading-none mb-0.5">{o.label}</span>
                <span className="block font-normal opacity-70">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Gutter Color */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className={sectionTitle}>Overflow / Gutter Color</p>
          <p className="text-xs text-[#7A8F79] mb-3">The background color visible outside the main content area.</p>
          <div className="flex gap-3 flex-wrap">
            {GUTTER_COLORS.map(c => (
              <button key={c.value} onClick={() => update('gutterColor', c.value)} className="flex flex-col items-center gap-1.5">
                <span
                  className={`w-10 h-10 rounded-xl border-2 transition ${
                    settings.gutterColor === c.value ? 'border-[#7A8F79] scale-110' : 'border-transparent hover:border-[#D9E1E8]'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
                <span className={`text-[10px] font-semibold ${settings.gutterColor === c.value ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'}`}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Density */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className={sectionTitle}>Content Density</p>
          <p className="text-xs text-[#7A8F79] mb-3">Controls spacing between rows, form fields, and content blocks.</p>
          <div className="flex gap-2">
            {DENSITY_OPTIONS.map(o => (
              <button key={o.value} onClick={() => update('density', o.value)} className={pill(settings.density === o.value)}>
                <span className="block mb-0.5">{o.label}</span>
                <span className="block font-normal opacity-70">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Border Radius */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className={sectionTitle}>Corner Style</p>
          <p className="text-xs text-[#7A8F79] mb-3">Controls the roundness of cards, buttons, and inputs.</p>
          <div className="flex gap-2">
            {RADIUS_OPTIONS.map(o => (
              <button key={o.value} onClick={() => update('radius', o.value)} className={pill(settings.radius === o.value)}>
                <span className="block mb-0.5">{o.label}</span>
                <span className="block font-normal opacity-70">{o.desc}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            {RADIUS_OPTIONS.map(o => (
              <div
                key={o.value}
                className={`flex-1 h-10 border-2 transition-all ${
                  settings.radius === o.value ? 'border-[#7A8F79] bg-[#F4F6F5]' : 'border-[#D9E1E8]'
                }`}
                style={{ borderRadius: o.value === 'sharp' ? '6px' : o.value === 'default' ? '12px' : '20px' }}
              />
            ))}
          </div>
        </div>

        {/* Card Elevation */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className={sectionTitle}>Card Elevation</p>
          <p className="text-xs text-[#7A8F79] mb-3">Shadow depth on panels and cards.</p>
          <div className="flex gap-2">
            {ELEVATION_OPTIONS.map(o => (
              <button key={o.value} onClick={() => update('elevation', o.value)} className={pill(settings.elevation === o.value)}>
                <span className="block mb-0.5">{o.label}</span>
                <span className="block font-normal opacity-70">{o.desc}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            {ELEVATION_OPTIONS.map((o, i) => (
              <div
                key={o.value}
                className={`flex-1 h-10 bg-white rounded-xl border border-[#D9E1E8] transition-all ${
                  settings.elevation === o.value ? 'border-[#7A8F79]' : ''
                }`}
                style={{
                  boxShadow: i === 0 ? 'none' : i === 1
                    ? '0 2px 14px rgba(47,62,78,0.07), 0 1px 4px rgba(47,62,78,0.04)'
                    : '0 8px 30px rgba(47,62,78,0.14), 0 2px 8px rgba(47,62,78,0.08)',
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
