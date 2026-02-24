'use client'

type BannerProps = {
  user: { id: string; role: string } | null;
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

    const [role, setRole] = useState<string | null>(null)

    useEffect(() => {
        const storedRole = localStorage.getItem("role")
        setRole(storedRole)
    }, [])

    const pathname = usePathname();

    return (
        <div className="relative w-full bg-[#F4F6F5] text-[#2f3e4e] flex flex-col md:flex-row md:items-center md:justify-between px-6 h-auto md:h-[200px] py-6 md:py-0">

            {/* Top Right Clock */}
            <div className="absolute top-4 right-6 text-sm">
                {time}
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

            {/* Right Side - Navigation */}
            <div className="flex items-center pr-20 mt-4 md:mt-0">
                <nav className="flex gap-8 text-sm font-semibold">
                    {!role && (
                        <Link
                            href="/login"
                            className={`transition ${pathname === "/login"
                                    ? "underline underline-offset-4"
                                    : "hover:opacity-70"
                                }`}
                        >
                            Login
                        </Link>
                    )}
                    <Link
                        href="/"
                        className={`transition ${pathname === "/" ? "underline underline-offset-4" : "hover:text-[#7A8F79] scale-[1.02]"
                            }`}
                    >
                        Home
                    </Link>
                    {role === "nurse" && (
                        <Link
                            href="/nurse"
                            className={`transition ${pathname === "/nurse" ? "underline underline-offset-4" : "hover:text-[#7A8F79] scale-[1.02]"
                                }`}
                        >
                            Nurse
                        </Link>
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

                </nav>
            </div>

        </div>
    )
}