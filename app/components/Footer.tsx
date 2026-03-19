import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-[#2F3E4E] text-[#D9E1E8] mt-16">
      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">

        {/* Brand */}
        <div>
          <p className="text-white font-bold text-lg">
            Coming Home<span className="text-[#7A8F79] italic">care</span>
          </p>
          <p className="text-xs text-[#7A8F79] mt-2 leading-relaxed">
            Streamlining provider enrollment, billing, and compliance for NY home care professionals.
          </p>
          <p className="text-xs text-[#7A8F79] mt-4">&copy; {year} Coming Home Care. All rights reserved.</p>
        </div>

        {/* Portal Links */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Portal</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/login"      className="hover:text-white transition">Sign In</Link></li>
            <li><Link href="/resources"  className="hover:text-white transition">Provider Resources</Link></li>
            <li><Link href="/nurse"      className="hover:text-white transition">Time Submission</Link></li>
            <li><Link href="/nurse/profile" className="hover:text-white transition">My Profile & Renewals</Link></li>
          </ul>
        </div>

        {/* Company / Legal */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Company</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about"          className="hover:text-white transition">About Us</Link></li>
            <li><Link href="/privacy"        className="hover:text-white transition">Privacy Policy</Link></li>
            <li><Link href="/hipaa"          className="hover:text-white transition">HIPAA Notice</Link></li>
            <li>
              <a href="mailto:support@cominghomecare.com" className="hover:text-white transition">
                support@cominghomecare.com
              </a>
            </li>
          </ul>
        </div>

      </div>

      <div className="border-t border-[#3d5166] text-center py-4 px-6">
        <p className="text-xs text-[#7A8F79] italic">
          &ldquo;Every hour you log is a step toward the care that matters most.&rdquo;
        </p>
      </div>
    </footer>
  )
}
