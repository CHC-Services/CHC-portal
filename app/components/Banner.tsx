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

    // role (and display name) come from the server via the layout prop
    const role = user?.role || null
    const displayName = user?.displayName || null

    const pathname = usePathname();

    return (
        <div className="fixed top-0 left-0 w-full bg-[#F4F6F5] text-[#2f3e4e] flex flex-col md:flex-row md:items-center md:justify-between px-4 sm:px-6 h-auto md:h-[200px] py-4 md:py-0 z-50">

            {/* Top right clock only */}
            <div className="absolute top-4 right-10 text-sm text-right">
                <span style={{color:'#7A8F79'}}>{time}</span>
            </div>

            {/* Left Side - Logo */}
            <div className="flex items-center">
                <Link href="/">
                    <Image
                        src="/chc_logo.png"
                        alt="Coming Homecare Logo"
                        width={350}
                        height={120}
                        priority
                        className="w-[220px] md:w-[350px] h-auto cursor-pointer transition duration-300 hover:opacity-80 hover:scale-[1.02]"
                    />
                </Link>
            </div>

            {/* Right Side - Navigation + welcome text aligned bottom of column */}
            <div className="h-full flex flex-col justify-center items-end pr-10 mt-4 md:mt-6">
                {displayName && (
                  <div className="mt-1 text-lg font-bold">
                    <span style={{ fontFamily: "'Lato', sans-serif", fontStyle: 'italic' }}>
                      Welcome home,
                    </span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem' }}>
                      &nbsp;{displayName}
                    </span>
                  </div>
                )}
                <nav className="flex flex-wrap gap-4 sm:gap-8 text-med font-semibold justify-center mt-4 md:justify-start items-center">
                    <Link
                        href="/"
                        className={`transition ${pathname === "/" ? "underline underline-offset-4" : "hover:text-[#7A8F79] scale-[1.02]"
                            }`}
                    >
                        Home
                    </Link>
                    {role === "nurse" && (
                        <>
                        <Link
                            href="/nurse"
                            className={`transition ${pathname === "/nurse" ? "underline underline-offset-4" : "hover:text-[#7A8F79] scale-[1.02]"
                                }`}
                        >
                            <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Dashboard
                        </Link>
                        <Link
                            href="/nurse/profile"
                            className="transition hover:text-[#7A8F79] scale-[1.02]"
                        >
                            <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Profile
                        </Link>
                        </>
                    )}
                    {role === "admin" && (
                        <Link
                            href="/admin"
                            className={`transition ${pathname === "/admin" ? "underline underline-offset-4" : "hover:text-[#7A8F79] scale-[1.02]"
                                }`}
                        >
                            Admin
                        </Link>
                    )}

                    
                    {/* spacer then auth button on right */}
                    <div className="ml-auto">
                      {role ? (
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
                      )}
                    </div>
                </nav>
            </div>
        </div>
    )
}
