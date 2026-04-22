'use client'

type BannerProps = {
  user: { id: string; role: string; displayName?: string; isDemo?: boolean } | null;
};

import { usePathname } from "next/navigation";
import Image from 'next/image'
import Link from "next/link";
import { useEffect, useState } from 'react'

export default function Banner({ user }: BannerProps) {
    const [time, setTime] = useState('')
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        const updateClock = () => {
            const now = new Date()
            setTime(now.toLocaleTimeString())
        }
        updateClock()
        const interval = setInterval(updateClock, 1000)
        return () => clearInterval(interval)
    }, [])

    const role = user?.role || null
    const displayName = user?.displayName || null
    const pathname = usePathname()

    // Mobile auth button — pill style
    const authButtonMobile = role ? (
        <button
            onClick={async () => {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' })
                window.location.href = '/login'
            }}
            className="flex items-center gap-2 bg-[#7A8F79] text-white px-5 py-2 rounded-full hover:bg-[#657a64] transition text-sm font-semibold"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
        </button>
    ) : (
        <Link
            href="/login"
            className="flex items-center gap-2 bg-[#7A8F79] text-white px-5 py-2 rounded-full hover:bg-[#657a64] transition text-sm font-semibold shrink-0"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
            </svg>
            <span><span className="italic text-[#D9E1E8]">my</span>Portal</span>
        </Link>
    )

    // Desktop top-right area: clock + sign out (logged out shows nothing here)
    const desktopTopRight = role ? (
        <button
            onClick={async () => {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' })
                window.location.href = '/login'
            }}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
        </button>
    ) : null

    // Row 1: personal "my" portal links
    const myRow = role === 'nurse' ? (
        <>
            <Link href="/nurse" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Dashboard
            </Link>
            <Link href="/calendar" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/calendar" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Calendar
            </Link>
            <Link href="/nurse/claims" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/claims" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Claims
            </Link>
            <Link href="/nurse/invoices" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/invoices" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Invoices
            </Link>
            <Link href="/nurse/documents" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/documents" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Documents
            </Link>
            <Link href="/nurse/profile" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/profile" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Profile
            </Link>
        </>
    ) : role === 'admin' ? (
        <>
            <Link href="/admin" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/admin" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                Admin
            </Link>
            <Link href="/admin/calendar" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/admin/calendar" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>ad</span>Calendar
            </Link>
            <Link href="/admin/faq" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/admin/faq" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>ad</span>FAQ
            </Link>
            <Link href="/admin/messages" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/admin/messages" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>ad</span>Alerts
            </Link>
            <Link href="/admin/email" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/admin/email" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>ad</span>Email
            </Link>
            <Link href="/admin/ideas" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/admin/ideas" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Ideas
            </Link>
        </>
    ) : role === 'provider' ? (
        <>
            <Link href="/portal" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/portal" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Portal
            </Link>
            <Link href="/nurse/profile" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/profile" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Profile
            </Link>
            <Link href="/nurse/onboarding" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/onboarding" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Billing
            </Link>
        </>
    ) : null

    // Row 2: general site links (always visible)
    const generalRow = (
        <>
            <Link href="/" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                Home
            </Link>
            <Link href="/services" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/services" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                Services
            </Link>
            <Link href="/faq" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/faq" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                FAQ
            </Link>
            {!role && (
                <>
                    <Link href="/login" onClick={() => setMenuOpen(false)} className={`transition font-bold ${pathname === "/login" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Portal Login
                    </Link>
                    <Link href="/signup" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/signup" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        New User? Sign Up
                    </Link>
                </>
            )}
            {role && (
                <>
                    <Link href="/resources" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/resources" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        Resources
                    </Link>
                    <Link href="/care" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/care" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Care
                    </Link>
                </>
            )}
        </>
    )

    const bottomNavItems = [
        { href: '/', label: 'Home', icon: '🏠' },
        { href: '/faq', label: 'FAQ', icon: '❓' },
        ...(role ? [
            { href: '/resources', label: 'Resources', icon: '📋' },
            { href: '/care', label: 'myCare', icon: '🌿' },
        ] : []),
        ...(role === 'nurse' ? [
            { href: '/nurse', label: 'Dashboard', icon: '📊' },
            { href: '/nurse/documents', label: 'Documents', icon: '📁' },
            { href: '/nurse/profile', label: 'Profile', icon: '👤' },
        ] : []),
        ...(role === 'provider' ? [
            { href: '/portal', label: 'Portal', icon: '🏠' },
            { href: '/nurse/profile', label: 'Profile', icon: '👤' },
            { href: '/nurse/onboarding', label: 'Billing', icon: '💳' },
        ] : []),
        ...(role === 'admin' ? [
            { href: '/admin', label: 'Admin', icon: '⚙️' },
        ] : []),
    ]

    return (
        <>
            {/* ── Demo mode bar ── */}
            {user?.isDemo && (
                <div className="fixed top-0 left-0 w-full z-[60] bg-amber-400 text-amber-900 text-xs font-bold text-center py-1.5 tracking-wide">
                    👁 Demo Mode — Read Only · Changes are blocked
                </div>
            )}

            {/* ── MOBILE header (hidden on md+) ── */}
            <div className={`md:hidden fixed left-0 w-full bg-[#F4F6F5] text-[#2f3e4e] z-50 shadow-sm ${user?.isDemo ? 'top-[30px]' : 'top-0'}`}>

                {/* Row 1: Logo | Auth button(s) */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                    <Link href="/">
                        <Image
                            src="/chc_logo.png"
                            alt="Coming Homecare Logo"
                            width={200}
                            height={70}
                            priority
                            className="h-auto cursor-pointer"
                        />
                    </Link>
                    {authButtonMobile}
                </div>

                {/* Row 2: Welcome text (left) | Hamburger (right) */}
                <div className="flex items-center justify-between px-3 pb-2">
                    <div className="flex-1 min-w-0">
                        {displayName && (
                            <span className="truncate">
                                <span style={{ fontFamily: "'Lato', sans-serif", fontStyle: 'italic', fontSize: '0.9rem' }}>Welcome home, </span>
                                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '0.95rem' }}>{displayName}</span>
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setMenuOpen(o => !o)}
                        className="p-2 rounded hover:bg-[#D9E1E8] transition shrink-0"
                        aria-label="Toggle menu"
                    >
                        {menuOpen ? (
                            <svg className="w-6 h-6 text-[#2F3E4E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6 text-[#2F3E4E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Hamburger dropdown */}
                {menuOpen && (
                    <div className="border-t border-[#D9E1E8] bg-[#F4F6F5] px-6 py-4 flex flex-col gap-4 text-sm font-semibold shadow-md">
                        {myRow}
                        <div className="border-t border-[#D9E1E8] pt-4 flex flex-col gap-4 text-[#2F3E4E]">
                            {generalRow}
                        </div>
                    </div>
                )}
            </div>

            {/* ── DESKTOP header (hidden below md) ── */}
            <div className={`hidden md:block fixed left-0 w-full bg-[#F4F6F5] text-[#2f3e4e] h-[200px] z-50 ${user?.isDemo ? 'top-[30px]' : 'top-0'}`}>
                <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between px-6 relative">

                    {/* Top-right: clock + sign out / New User? */}
                    <div className="absolute top-4 right-6 flex flex-col items-end gap-2">
                        <span className="text-sm" style={{color:'#7A8F79'}}>{time}</span>
                        {desktopTopRight}
                    </div>

                    {/* Logo */}
                    <div className="flex items-center">
                        <Link href="/">
                            <Image
                                src="/chc_logo.png"
                                alt="Coming Homecare Logo"
                                width={350}
                                height={120}
                                priority
                                className="w-[350px] h-auto cursor-pointer transition duration-300 hover:opacity-80 hover:scale-[1.02]"
                            />
                        </Link>
                    </div>

                    {/* Right: welcome + nav */}
                    <div className="h-full flex flex-col justify-center items-end mt-6">
                        {displayName && (
                            <div className="mt-1 text-lg font-bold">
                                <span style={{ fontFamily: "'Lato', sans-serif", fontStyle: 'italic' }}>Welcome home,</span>
                                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem' }}>&nbsp;{displayName}</span>
                            </div>
                        )}
                        {/* Row 1: role-specific links (hidden when logged out — myPortal Login moves to row 2) */}
                        {myRow && (
                            <nav className="flex flex-wrap gap-6 text-sm font-semibold mt-3 items-center">
                                {myRow}
                            </nav>
                        )}
                        {/* Row 2: general links (+ myPortal Login when logged out) */}
                        <nav className={`flex flex-wrap gap-6 text-sm font-semibold items-center text-[#2F3E4E] ${myRow ? 'mt-2' : 'mt-3'}`}>
                            {generalRow}
                        </nav>
                        {!role && (
                            <Link
                                href="/signup"
                                className="mt-2 text-sm font-semibold text-[#7A8F79] border border-[#7A8F79] px-3 py-1 rounded-full hover:bg-[#7A8F79] hover:text-white transition"
                            >
                                New User?
                            </Link>
                        )}
                    </div>

                </div>
            </div>

            {/* ── MOBILE bottom nav bar (hidden on md+) ── */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#F4F6F5] border-t border-[#D9E1E8] z-50 flex justify-around items-center py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                {bottomNavItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold px-2 transition ${
                            pathname === item.href ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'
                        }`}
                    >
                        <span className="text-lg leading-none">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
        </>
    )
}
