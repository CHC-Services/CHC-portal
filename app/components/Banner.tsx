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

    const pathname = usePathname();

    const authButton = role ? (
        <button
            onClick={async () => {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' })
                window.location.href = '/login'
            }}
            className="bg-[#7A8F79] text-white px-3 py-1 rounded hover:bg-[#2F3E4E] transition"
        >
            Logout
        </button>
    ) : (
        <button
            onClick={() => { window.location.href = '/login' }}
            className="bg-[#2F3E4E] text-white px-3 py-1 rounded hover:bg-[#1f2a33] transition"
        >
            Login
        </button>
    )

    const navLinks = (
        <>
            <Link href="/" className={`transition ${pathname === "/" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                Home
            </Link>
            <Link href="/resources" className={`transition ${pathname === "/resources" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Resources
            </Link>
            {role === "nurse" && (
                <>
                    <Link href="/nurse" className={`transition ${pathname === "/nurse" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Dashboard
                    </Link>
                    <Link href="/nurse/claims" className={`transition ${pathname === "/nurse/claims" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Claims
                    </Link>
                    <Link href="/nurse/profile" className={`transition ${pathname === "/nurse/profile" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                        <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Profile
                    </Link>
                </>
            )}
            {role === "admin" && (
                <Link href="/admin" className={`transition ${pathname === "/admin" ? "underline underline-offset-4" : "hover:text-[#7A8F79]"}`}>
                    Admin
                </Link>
            )}
        </>
    )

    return (
        <div className="fixed top-0 left-0 w-full bg-[#F4F6F5] text-[#2f3e4e] z-50">

            {/* ── MOBILE layout (hidden on md+) ── */}
            <div className="md:hidden px-4 py-3">
                {/* Row 1: Logo + Auth button */}
                <div className="flex items-center justify-between">
                    <Link href="/">
                        <Image
                            src="/chc_logo.png"
                            alt="Coming Homecare Logo"
                            width={220}
                            height={75}
                            priority
                            className="h-auto cursor-pointer"
                        />
                    </Link>
                    {authButton}
                </div>

                {/* Row 2: Welcome text */}
                {displayName && (
                    <div className="mt-2 text-base font-bold">
                        <span style={{ fontFamily: "'Lato', sans-serif", fontStyle: 'italic' }}>Welcome home,</span>
                        <span style={{ fontFamily: "'Playfair Display', serif" }}>&nbsp;{displayName}</span>
                    </div>
                )}

                {/* Row 3: Nav links */}
                <nav className="flex gap-4 text-sm font-semibold mt-2 overflow-x-auto pb-1">
                    {navLinks}
                </nav>
            </div>

            {/* ── DESKTOP layout (hidden below md) ── */}
            <div className="hidden md:flex items-center justify-between px-6 h-[200px]">

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

        </div>
    )
}
