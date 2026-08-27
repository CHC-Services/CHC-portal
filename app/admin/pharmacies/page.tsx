'use client'

import { useState, useEffect, Fragment } from 'react'

type PharmacyPatient = {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  guardians: { id: string; name: string; email: string }[]
}

type Pharmacy = {
  id: string
  name: string
  address: string | null
  phone: string | null
  patients: PharmacyPatient[]
}

const emptyNew = { name: '', address: '', phone: '' }

export default function AdminPharmaciesPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', address: '', phone: '' })
  const [adding, setAdding] = useState(false)
  const [newData, setNewData] = useState(emptyNew)
  const [msg, setMsg] = useState('')

  function load() {
    fetch('/api/admin/pharmacies', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPharmacies(data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = pharmacies.filter(p => {
    const q = search.toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q) || (p.phone || '').includes(q)
  })

  function startEdit(p: Pharmacy) {
    setEditingId(p.id)
    setEditData({ name: p.name, address: p.address || '', phone: p.phone || '' })
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/pharmacies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editData),
    })
    if (res.ok) { setEditingId(null); load() } else { setMsg('Failed to save changes.') }
  }

  async function deletePharmacy(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Medications that reference it will no longer show a pharmacy.`)) return
    const res = await fetch(`/api/admin/pharmacies/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { load() } else { setMsg('Failed to delete.') }
  }

  async function createPharmacy(e: React.FormEvent) {
    e.preventDefault()
    if (!newData.name.trim()) return
    const res = await fetch('/api/admin/pharmacies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newData),
    })
    if (res.ok) { setAdding(false); setNewData(emptyNew); load() } else { setMsg('Failed to create pharmacy.') }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">

      <div className="mb-5">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">ad</span>Pharmacies
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Shared pharmacy directory, built up as medications are entered. {pharmacies.length} total.</p>
      </div>

      {msg && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2.5">{msg}</div>}

      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name, address, or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-[#D9E1E8] bg-white rounded-xl px-4 py-2.5 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />
        <button
          onClick={() => setAdding(a => !a)}
          className="bg-[#2F3E4E] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition whitespace-nowrap"
        >
          + New Pharmacy
        </button>
      </div>

      {adding && (
        <form onSubmit={createPharmacy} className="bg-white rounded-xl shadow-sm p-4 mb-5 grid grid-cols-1 md:grid-cols-4 gap-2">
          <input placeholder="Name" value={newData.name} onChange={e => setNewData(d => ({ ...d, name: e.target.value }))} required className="border border-[#D9E1E8] rounded-lg p-2 text-sm" />
          <input placeholder="Address" value={newData.address} onChange={e => setNewData(d => ({ ...d, address: e.target.value }))} className="border border-[#D9E1E8] rounded-lg p-2 text-sm" />
          <input placeholder="Phone" value={newData.phone} onChange={e => setNewData(d => ({ ...d, phone: e.target.value }))} className="border border-[#D9E1E8] rounded-lg p-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="flex-1 border border-[#D9E1E8] rounded-lg text-sm font-semibold text-[#7A8F79]">Cancel</button>
            <button type="submit" className="flex-1 bg-[#2F3E4E] text-white rounded-lg text-sm font-semibold py-2">Add</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[#7A8F79] italic">No pharmacies yet — they'll appear here as medications are entered.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-left">Address</th>
                <th className="py-3 px-4 text-left">Phone</th>
                <th className="py-3 px-4 text-right">Patients</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <Fragment key={p.id}>
                  <tr
                    key={p.id}
                    className={`border-b border-[#D9E1E8] last:border-0 cursor-pointer hover:bg-[#F4F6F5] transition ${i % 2 === 1 ? 'bg-[#FAFBFA]' : ''}`}
                    onClick={() => editingId !== p.id && setExpandedId(id => id === p.id ? null : p.id)}
                  >
                    {editingId === p.id ? (
                      <>
                        <td className="py-2 px-4" onClick={e => e.stopPropagation()}>
                          <input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="border border-[#D9E1E8] rounded-lg p-1.5 text-sm w-full" />
                        </td>
                        <td className="py-2 px-4" onClick={e => e.stopPropagation()}>
                          <input value={editData.address} onChange={e => setEditData(d => ({ ...d, address: e.target.value }))} className="border border-[#D9E1E8] rounded-lg p-1.5 text-sm w-full" />
                        </td>
                        <td className="py-2 px-4" onClick={e => e.stopPropagation()}>
                          <input value={editData.phone} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} className="border border-[#D9E1E8] rounded-lg p-1.5 text-sm w-full" />
                        </td>
                        <td className="py-2 px-4 text-right text-[#7A8F79]">{p.patients.length}</td>
                        <td className="py-2 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button onClick={() => saveEdit(p.id)} className="text-xs font-semibold text-[#2F3E4E] mr-2">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs font-semibold text-[#7A8F79]">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 font-semibold text-[#2F3E4E]">{p.name}</td>
                        <td className="py-3 px-4 text-[#7A8F79]">{p.address || '—'}</td>
                        <td className="py-3 px-4 text-[#7A8F79]">{p.phone || '—'}</td>
                        <td className="py-3 px-4 text-right text-[#2F3E4E] font-semibold">{p.patients.length}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button onClick={e => { e.stopPropagation(); startEdit(p) }} className="text-xs font-semibold text-[#7A8F79] mr-3">Edit</button>
                          <button onClick={e => { e.stopPropagation(); deletePharmacy(p.id, p.name) }} className="text-xs font-semibold text-red-500">Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                  {expandedId === p.id && (
                    <tr className="bg-[#F4F6F5]">
                      <td colSpan={5} className="px-6 py-3">
                        {p.patients.length === 0 ? (
                          <p className="text-xs italic text-[#7A8F79]">No patients linked yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {p.patients.map(pt => (
                              <div key={pt.id} className="text-xs">
                                <span className="font-semibold text-[#2F3E4E]">{pt.lastName}, {pt.firstName}</span>
                                <span className="ml-2 font-mono text-[#7A8F79]">{pt.accountNumber}</span>
                                {pt.guardians.length > 0 && (
                                  <span className="ml-2 text-[#7A8F79]">
                                    · Guardian{pt.guardians.length > 1 ? 's' : ''}: {pt.guardians.map(g => g.name).join(', ')}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
