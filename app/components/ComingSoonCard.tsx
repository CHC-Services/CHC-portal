export default function ComingSoonCard({ title }: { title: string }) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow-sm p-8 text-center">
      <p className="text-lg font-bold text-[#2F3E4E] mb-1">{title}</p>
      <p className="text-sm text-[#7A8F79]">This section is coming soon.</p>
    </div>
  )
}
