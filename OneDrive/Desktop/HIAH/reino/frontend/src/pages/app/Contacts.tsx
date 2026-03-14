import { useState } from 'react'
import { useStore } from '@/store'
import { contactsAPI } from '@/services/api'
import { callsAPI, messagesAPI } from '@/services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import type { Contact } from '@/types'

function ContactSheet({ contact, onClose, onUpdated }: {
  contact: Contact
  onClose: () => void
  onUpdated: (c: Contact) => void
}) {
  const { user, updateContact } = useStore()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: contact.name, phone: contact.phone, phone2: contact.phone2 ?? '',
    email: contact.email ?? '', notes: contact.notes ?? '',
    tags: contact.tags.join(', '), is_favorite: contact.is_favorite,
  })
  const [saving, setSaving] = useState(false)

  const sims   = user?.sim_cards ?? []
  const defSim = sims.find(s => s.is_default) ?? sims[0]

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await contactsAPI.update(contact.id, {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
      updateContact(contact.id, data.data)
      onUpdated(data.data)
      setEditing(false)
      toast.success('Contact updated')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleBlock = async () => {
    if (!confirm(`Block ${contact.name}? You won't receive messages or calls from them.`)) return
    await contactsAPI.block(contact.id, 'user blocked')
    updateContact(contact.id, { is_blocked: true })
    toast(`${contact.name} blocked`)
    onClose()
  }

  const handleUnblock = async () => {
    await contactsAPI.unblock(contact.id)
    updateContact(contact.id, { is_blocked: false, blocked_at: undefined, block_reason: undefined })
    toast(`${contact.name} unblocked`)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return
    await contactsAPI.remove(contact.id)
    toast(`${contact.name} deleted`)
    onClose()
  }

  const handleSpam = async () => {
    await contactsAPI.reportSpam(contact.id)
    updateContact(contact.id, { is_spam: true })
    toast(`${contact.name} reported as spam`)
  }

  const handleCall = async () => {
    const { data } = await callsAPI.initiate({ phone: contact.phone, contact_name: contact.name, sim_slot: defSim?.slot ?? 0, isp: defSim?.isp ?? 'safaricom' })
    window.location.href = `tel:${contact.phone}`
    onClose()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-r-surface sm:rounded-2xl border border-r-border/50 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Avatar + name */}
        <div className="flex items-center gap-4 p-5 border-b border-r-border/40">
          <div className="w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-xl text-white flex-shrink-0"
            style={{ background: `${contact.color}33`, border: `2px solid ${contact.color}55`, color: contact.color }}>
            {contact.initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-white text-lg truncate">{contact.name}</h3>
            <p className="text-r-muted text-sm">{contact.phone}</p>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {contact.is_favorite  && <span className="badge bg-yellow-500/15 text-yellow-400 text-xs">★ Favourite</span>}
              {contact.is_blocked   && <span className="badge bg-red-500/15 text-red-400 text-xs">Blocked</span>}
              {contact.is_spam      && <span className="badge bg-red-500/15 text-red-400 text-xs">Spam</span>}
              {contact.is_unknown   && <span className="badge bg-r-amber/15 text-r-amber text-xs">Unknown</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-r-muted hover:text-white text-2xl flex-shrink-0">×</button>
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-r-muted mb-1 block">Name</label>
                <input value={form.name} onChange={f('name')} className="input-field text-sm py-2" /></div>
              <div><label className="text-xs text-r-muted mb-1 block">Phone</label>
                <input value={form.phone} onChange={f('phone')} className="input-field text-sm py-2" /></div>
              <div><label className="text-xs text-r-muted mb-1 block">Phone 2</label>
                <input value={form.phone2} onChange={f('phone2')} className="input-field text-sm py-2" /></div>
              <div><label className="text-xs text-r-muted mb-1 block">Email</label>
                <input value={form.email} onChange={f('email')} className="input-field text-sm py-2" /></div>
            </div>
            <div><label className="text-xs text-r-muted mb-1 block">Tags (comma separated)</label>
              <input value={form.tags} onChange={f('tags')} className="input-field text-sm py-2" /></div>
            <div><label className="text-xs text-r-muted mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={f('notes')} className="input-field text-sm resize-none h-16 py-2" /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_favorite}
                onChange={e => setForm(p => ({ ...p, is_favorite: e.target.checked }))} className="accent-r-accent" />
              <span className="text-sm text-r-text">Favourite</span>
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 text-sm">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setEditing(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          /* Actions */
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleCall}
                className="flex items-center justify-center gap-2 bg-r-teal/10 hover:bg-r-teal/20 text-r-teal border border-r-teal/20 rounded-xl py-3 text-sm font-medium transition-colors">
                📞 Call
              </button>
              <button onClick={() => {/* open compose in messages */}}
                className="flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl py-3 text-sm font-medium transition-colors">
                💬 SMS
              </button>
            </div>
            <button onClick={() => setEditing(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-r-card hover:bg-r-border transition-colors text-sm font-medium text-r-text">
              ✎ Edit contact
            </button>
            {contact.is_blocked ? (
              <button onClick={handleUnblock}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-r-teal/10 hover:bg-r-teal/20 transition-colors text-sm font-medium text-r-teal">
                🔓 Unblock contact
              </button>
            ) : (
              <button onClick={handleBlock}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors text-sm font-medium text-red-400">
                🚫 Block contact
              </button>
            )}
            {!contact.is_spam && (
              <button onClick={handleSpam}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-r-card hover:bg-r-border transition-colors text-sm font-medium text-r-muted">
                ⚠️ Report as spam
              </button>
            )}
            <button onClick={handleDelete}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors text-sm font-medium text-red-400">
              🗑️ Delete contact
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Contacts() {
  const { contacts, addContact, isOnline } = useStore()
  const [search, setSearch]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [selected, setSelected]     = useState<Contact | null>(null)
  const [form, setForm]             = useState({ name: '', phone: '', tags: '', is_favorite: false })
  const [saving, setSaving]         = useState(false)
  const [filter, setFilter]         = useState<'all' | 'blocked' | 'spam'>('all')

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
    const matchFilter = filter === 'all' ? !c.is_blocked : filter === 'blocked' ? c.is_blocked : c.is_spam
    return matchSearch && matchFilter
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.phone) { toast.error('Name and phone required'); return }
    setSaving(true)
    try {
      const { data } = await contactsAPI.create({
        name: form.name, phone: form.phone, is_favorite: form.is_favorite,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
      addContact(data.data)
      toast.success('Contact added!')
      setForm({ name: '', phone: '', tags: '', is_favorite: false })
      setShowAdd(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to add'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Search + add */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-r-border/40 space-y-2.5">
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…" className="input-field flex-1 text-sm py-2.5" />
          <button onClick={() => setShowAdd(v => !v)} className="btn-primary px-4 text-sm whitespace-nowrap">
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        </div>
        <div className="flex gap-2">
          {(['all','blocked','spam'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('text-xs px-3 py-1.5 rounded-lg border font-medium capitalize transition-all',
                filter === f ? 'bg-r-accent/20 text-r-accent border-r-accent/40' : 'bg-r-card text-r-muted border-r-border')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="flex-shrink-0 p-3 sm:p-4 border-b border-r-border/30 bg-r-surface/50">
          <form onSubmit={handleAdd} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-r-muted mb-1 block">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input-field text-sm py-2" required /></div>
              <div><label className="text-xs text-r-muted mb-1 block">Phone *</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input-field text-sm py-2" placeholder="+254…" required /></div>
            </div>
            <div><label className="text-xs text-r-muted mb-1 block">Tags</label>
              <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="input-field text-sm py-2" placeholder="family, work…" /></div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_favorite} onChange={e => setForm(p => ({ ...p, is_favorite: e.target.checked }))} className="accent-r-accent" />
                <span className="text-sm text-r-text">Favourite</span>
              </label>
              {!isOnline && <span className="text-xs text-r-amber">📴 Offline — will sync later</span>}
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full text-sm">
              {saving ? 'Adding…' : 'Add Contact'}
            </button>
          </form>
        </div>
      )}

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-r-muted">
            <p className="text-3xl mb-2">◈</p>
            <p className="text-sm">{search ? 'No contacts found' : filter === 'all' ? 'No contacts yet' : `No ${filter} contacts`}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c)}
                className={clsx('card p-3 flex items-center gap-3 hover:border-r-border transition-colors text-left',
                  c.is_blocked && 'opacity-60',
                  c.is_spam && 'border-red-500/20')}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: `${c.color}33`, border: `2px solid ${c.color}55`, color: c.color }}>
                  {c.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-white text-sm truncate">{c.name}</p>
                    {c.is_favorite  && <span className="text-yellow-400 text-xs">★</span>}
                    {c.is_blocked   && <span className="text-red-400 text-xs">🚫</span>}
                    {c.is_spam      && <span className="text-red-400 text-xs">⚠️</span>}
                    {c.sync_status === 'pending' && <span className="text-r-amber text-xs">●</span>}
                  </div>
                  <p className="text-xs text-r-muted">{c.phone}</p>
                </div>
                <span className="text-r-muted text-sm flex-shrink-0">›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contact sheet */}
      {selected && (
        <ContactSheet
          contact={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => setSelected(updated)}
        />
      )}
    </div>
  )
}
