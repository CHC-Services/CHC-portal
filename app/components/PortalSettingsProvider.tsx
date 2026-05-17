'use client'

import { useEffect } from 'react'
import { loadSettings, applySettings } from '@/lib/portalSettings'

export default function PortalSettingsProvider() {
  useEffect(() => {
    applySettings(loadSettings())
  }, [])
  return null
}
