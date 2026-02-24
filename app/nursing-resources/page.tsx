export default function NursingResourcesPage() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-12 text-[#2F3E4E]">
      
      <h1 className="text-4xl mb-8">
        Nursing Resources
      </h1>

      <p className="mb-12 text-lg text-[#7A8F79] max-w-3xl">
        A centralized hub designed to simplify the independent nursing journey.
        This page consolidates enrollment guidance, compliance documentation,
        renewal processes, business setup resources, and clinical updates in one place.
      </p>

      <div className="space-y-12">

        {/* Medicaid & Insurance Enrollment */}
        <section>
          <h2 className="text-2xl mb-4 border-b-2 border-[#D9E1E8] pb-2">
            Medicaid & Insurance Enrollment
          </h2>
          <ul className="space-y-2 list-disc pl-6">
            <li>Steps to enroll in state Medicaid programs</li>
            <li>Commercial insurance credentialing process</li>
            <li>Common enrollment mistakes to avoid</li>
          </ul>
        </section>

        {/* Renewal & Compliance */}
        <section>
          <h2 className="text-2xl mb-4 border-b-2 border-[#D9E1E8] pb-2">
            Renewal & Compliance Forms
          </h2>
          <ul className="space-y-2 list-disc pl-6">
            <li>Annual Medicaid revalidation forms</li>
            <li>Billable status renewal checklist</li>
            <li>Required documentation calendar</li>
          </ul>
        </section>

        {/* Business Setup */}
        <section>
          <h2 className="text-2xl mb-4 border-b-2 border-[#D9E1E8] pb-2">
            Business Setup & Tax Guidance
          </h2>
          <ul className="space-y-2 list-disc pl-6">
            <li>LLC vs Corporation considerations</li>
            <li>IRS forms for incorporated nurses</li>
            <li>Quarterly tax planning resources</li>
          </ul>
        </section>

        {/* Clinical & Professional Updates */}
        <section>
          <h2 className="text-2xl mb-4 border-b-2 border-[#D9E1E8] pb-2">
            Clinical Guidelines & Updates
          </h2>
          <ul className="space-y-2 list-disc pl-6">
            <li>Latest AHA CPR process updates</li>
            <li>Continuing education references</li>
            <li>Scholarly journal links</li>
          </ul>
        </section>

        {/* Operational FAQs */}
        <section>
          <h2 className="text-2xl mb-4 border-b-2 border-[#D9E1E8] pb-2">
            Operational FAQs
          </h2>
          <ul className="space-y-2 list-disc pl-6">
            <li>How long does Medicaid approval typically take?</li>
            <li>What documents delay enrollment most often?</li>
            <li>How to maintain active billing status?</li>
          </ul>
        </section>

      </div>
    </main>
  )
}