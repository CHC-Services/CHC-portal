'use client'

type BannerProps = {
  user: { id: string; role: string; displayName?: string } | null;
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

    const authButton = role ? (
        <button
            onClick={async () => {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' })
                window.location.href = '/login'
            }}
            className="bg-[#7A8F79] text-white px-3 py-1 rounded hover:bg-[#2F3E4E] transition text-sm"
        >
            Logout
        </button>
    ) : (
        <button
            onClick={() => { window.location.href = '/login' }}
            className="bg-[#2F3E4E] text-white px-3 py-1 rounded hover:bg-[#1f2a33] transition text-sm"
        >
            Login
        </button>
    )

    const navLinks = (
        <>
            <Link href="/" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                Home
            </Link>
            <Link href="/resources" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/resources" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Resources
            </Link>
            {!role && (
                <Link href="/billing" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/billing" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                    Billing Services
                </Link>
            )}
            {role === "nurse" && (
                <>
                    <Link href="/nurse" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Dashboard
                    </Link>
                    <Link href="/nurse/claims" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/claims" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Claims
                    </Link>
                    <Link href="/nurse/profile" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/nurse/profile" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Profile
                    </Link>
                </>
            )}
            {role === "admin" && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className={`transition ${pathname === "/admin" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                    Admin
                </Link>
            )}
        </>
    )

    const bottomNavItems = [
        { href: '/', label: 'Home', icon: '🏠' },
        { href: '/resources', label: 'Resources', icon: '📋' },
        ...(!role ? [
            { href: '/billing', label: 'Billing', icon: '💼' },
        ] : []),
        ...(role === 'nurse' ? [
            { href: '/nurse', label: 'Dashboard', icon: '📊' },
            { href: '/nurse/claims', label: 'Claims', icon: '📄' },
            { href: '/nurse/profile', label: 'Profile', icon: '👤' },
        ] : []),
        ...(role === 'admin' ? [
            { href: '/admin', label: 'Admin', icon: '⚙️' },
        ] : []),
    ]

    return (
        <>
            {/* ── MOBILE header (hidden on md+) ── */}
            <div className="md:hidden fixed top-0 left-0 w-full bg-[#F4F6F5] text-[#2f3e4e] z-50 shadow-sm">

                {/* Row 1: Logo | Hamburger + Logout */}
                <div className="flex items-center justify-between px-4 py-3">
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setMenuOpen(o => !o)}
                            className="p-2 rounded hover:bg-[#D9E1E8] transition"
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
                        {authButton}
                    </div>
                </div>

                {/* Row 2: Welcome text — right aligned */}
                {displayName && (
                    <div className="px-4 pb-2 text-right">
                        <span style={{ fontFamily: "'Lato', sans-serif", fontStyle: 'italic', fontSize: '0.95rem' }}>Welcome home, </span>
                        <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1rem' }}>{displayName}</span>
                    </div>
                )}

                {/* Hamburger dropdown */}
                {menuOpen && (
                    <div className="border-t border-[#D9E1E8] bg-[#F4F6F5] px-6 py-4 flex flex-col gap-5 text-sm font-semibold shadow-md">
                        {navLinks}
                    </div>
                )}
            </div>

            {/* ── DESKTOP header (hidden below md) ── */}
            <div className="hidden md:flex fixed top-0 left-0 w-full bg-[#F4F6F5] text-[#2f3e4e] items-center justify-between px-6 h-[200px] z-50">

                {/* Clock */}
                <div className="absolute top-4 right-10 text-sm text-right">
                    <span style={{color:'#7A8F79'}}>{time}</span>
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
                <div className="h-full flex flex-col justify-center items-end pr-10 mt-6">
                    {displayName && (
                        <div className="mt-1 text-lg font-bold">
                            <span style={{ fontFamily: "'Lato', sans-serif", fontStyle: 'italic' }}>Welcome home,</span>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem' }}>&nbsp;{displayName}</span>
                        </div>
                    )}
                    <nav className="flex flex-wrap gap-8 text-med font-semibold mt-4 items-center">
                        {navLinks}
                        <div className="ml-auto">{authButton}</div>
                    </nav>
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
