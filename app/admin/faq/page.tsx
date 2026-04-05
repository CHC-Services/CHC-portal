'use client'

import AdminNav from '../../components/AdminNav'
import FaqEditorSection from '../../components/FaqEditorSection'

export default function AdminFaqPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <AdminNav />

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">ad</span>FAQ
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Add, edit, reorder, and publish FAQ items visible on the public FAQ page.</p>
        </div>

        <FaqEditorSection />
      </div>
    </div>
  )
}
