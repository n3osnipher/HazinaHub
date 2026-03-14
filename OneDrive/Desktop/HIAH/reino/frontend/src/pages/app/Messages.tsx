import { useState, useMemo, useRef } from 'react'
import { useStore } from '@/store'
import { messagesAPI, contactsAPI } from '@/services/api'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import type { Contact } from '@/types'

// Highlight matching text in search
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-r-accent/30 text-white rounded px-0.5">{p}</mark>
          : p
      )}
    </>
  )
}

export default function Messages() {
  const { messages, markMessageRead, addMessage, removeContact, user, contacts } = useStore()
  const navigate = useNavigate()
  const sims = user?.sim_cards ?? []

  const [activeSim, setActiveSim]     = useState(sims.find(s => s.is_default)?.slot ?? 0)
  const [tab, setTab]                 = useState<'inbox' | 'archived' | 'spam'>('inbox')
  const [search, setSearch]           = useState('')
  const [composeTo, setComposeTo]     = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [sending, setSending]         = useState(false)
  const [openThread, setOpenThread]   = useState<string | null>(null)
  const [replyBody, setReplyBody]     = useState('')
  const composeRef = useRef<HTMLInputElement>(null)

  // Filter messages by tab
  const filtered = useMemo(() => {
    let list = messages.filter(m => !m.is_deleted)
    if (tab === 'inbox')    list = list.filter(m => !m.is_archived && !m.is_spam)
    if (tab === 'archived') list = list.filter(m => m.is_archived)
    if (tab === 'spam')     list = list.filter(m => m.is_spam)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.contact_name.toLowerCase().includes(q) || m.body.toLowerCase().includes(q))
    }
    return list
  }, [messages, tab, search])

  // Thread grouping
  const threads = useMemo(() => {
    const map: Record<string, typeof filtered> = {}
    for (const m of filtered) {
      if (!map[m.contact_name]) map[m.contact_name] = []
      map[m.contact_name].push(m)
    }
    return Object.entries(map).map(([name, msgs]) => ({
      name, latest: msgs[0], unread: msgs.filter(m => !m.is_read).length,
      msgs: msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      isSpam: msgs[0].is_spam,
      isUnknown: msgs[0].is_unknown,
    })).sort((a, b) => new Date(b.latest.timestamp).getTime() - new Date(a.latest.timestamp).getTime())
  }, [filtered])

  // Contact autosuggestion as user types
  const handleComposeToChange = (val: string) => {
    setComposeTo(val)
    setSelectedContact(null)
    if (!val.trim()) { setSuggestions([]); return }
    const q = val.toLowerCase()
    const matches = contacts.filter(c =>
      !c.is_blocked &&
      (c.name.toLowerCase().includes(q) || c.phone.includes(q))
    ).slice(0, 6)
    setSuggestions(matches)
  }

  const pickSuggestion = (c: Contact) => {
    setComposeTo(c.name)
    setSelectedContact(c)
    setSuggestions([])
    composeRef.current?.blur()
  }

  const handleSend = async (to?: string, body?: string) => {
    const targetName = to ?? composeTo
    const msgBody    = body ?? composeBody
    if (!targetName.trim() || !msgBody.trim()) { toast.error('Fill in recipient and message'); return }

    // Must be a saved contact
    const contact = selectedContact ?? contacts.find(c =>
      c.name.toLowerCase() === targetName.toLowerCase() || c.phone === targetName
    )
    if (!contact) {
      toast.error(`"${targetName}" is not in your contacts. Add them first.`)
      return
    }
    if (contact.is_blocked) {
      toast.error(`${contact.name} is blocked. Unblock them in Contacts first.`)
      return
    }

    setSending(true)
    const sim = sims.find(s => s.slot === activeSim)
    try {
      const { data } = await messagesAPI.send({
        to: contact.phone,
        body: msgBody,
        contact_id: contact.id,
        contact_name: contact.name,
        sim_slot: activeSim,
        isp: sim?.isp ?? 'safaricom',
      })
      addMessage(data.data)
      toast.success('SMS sent!')
      setComposeTo(''); setComposeBody(''); setSelectedContact(null); setSuggestions([])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to send'
      toast.error(msg)
    } finally { setSending(false) }
  }

  const handleArchive = async (threadName: string) => {
    try {
      await messagesAPI.archiveThread(threadName)
      toast('Thread archived')
    } catch { toast.error('Failed') }
  }

  const handleDelete = async (threadName: string) => {
    if (!confirm(`Delete all messages with ${threadName}?`)) return
    try {
      await messagesAPI.deleteThread(threadName)
      toast('Thread deleted')
    } catch { toast.error('Failed') }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Compose */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-r-border/40 space-y-2.5 bg-r-surface/40">
        {sims.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {sims.map(s => (
              <button key={s.slot} onClick={() => setActiveSim(s.slot)}
                className={clsx('text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
                  activeSim === s.slot ? 'bg-r-accent/20 text-r-accent border-r-accent/40' : 'bg-r-surface text-r-muted border-r-border')}>
                SIM{s.slot + 1} · {s.isp ?? '?'}
              </button>
            ))}
          </div>
        )}

        {/* Recipient with autosuggestion */}
        <div className="relative">
          <input
            ref={composeRef}
            value={composeTo}
            onChange={e => handleComposeToChange(e.target.value)}
            placeholder="To: type name or number…"
            className={clsx('input-field text-sm py-2.5',
              selectedContact ? 'border-r-teal/50 bg-r-teal/5' : '')}
          />
          {selectedContact && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-r-teal font-medium">
              {selectedContact.phone}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-r-card border border-r-border rounded-xl shadow-lg overflow-hidden">
              {suggestions.map(c => (
                <button key={c.id} onClick={() => pickSuggestion(c)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-r-surface transition-colors text-left">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: c.color }}>{c.initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      <Highlight text={c.name} query={composeTo} />
                    </p>
                    <p className="text-xs text-r-muted">{c.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend() }}
            placeholder="Message… (Ctrl+Enter to send)"
            className="input-field resize-none h-16 text-sm flex-1 py-2.5" />
          <button onClick={() => handleSend()} disabled={sending || !composeTo.trim() || !composeBody.trim()}
            className="btn-primary px-4 self-stretch rounded-xl text-sm">
            {sending ? '…' : '→'}
          </button>
        </div>
        <p className="text-xs text-r-muted">
          ⚠️ You can only send to saved contacts. <button onClick={() => navigate('/app/contacts')} className="text-r-accent hover:underline">Add contacts →</button>
        </p>
      </div>

      {/* Tabs + search */}
      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 space-y-2.5">
        <div className="flex gap-2">
          {(['inbox','archived','spam'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all',
                tab === t ? 'bg-r-accent/20 text-r-accent border border-r-accent/30' : 'bg-r-card text-r-muted hover:text-r-text border border-r-border')}>
              {t}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search messages…"
          className="input-field text-sm py-2.5" />
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 space-y-1.5">
        {threads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-r-muted">
            <p className="text-3xl mb-2">{tab === 'inbox' ? '💬' : tab === 'archived' ? '📦' : '🚫'}</p>
            <p className="text-sm">{tab === 'inbox' ? 'No messages yet' : tab === 'archived' ? 'No archived messages' : 'No spam messages'}</p>
          </div>
        )}

        {threads.map(thread => (
          <div key={thread.name}>
            {/* Thread row */}
            <div className={clsx('card p-3 cursor-pointer hover:border-r-border transition-colors',
              thread.unread > 0 && 'border-blue-500/20',
              thread.isSpam && 'border-red-500/20 bg-red-500/5',
              thread.isUnknown && !thread.isSpam && 'border-r-amber/20')}>
              <div className="flex items-center gap-3"
                onClick={() => {
                  setOpenThread(openThread === thread.name ? null : thread.name)
                  thread.msgs.filter(m => !m.is_read).forEach(m => markMessageRead(m.id))
                }}>
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {thread.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={clsx('font-semibold truncate text-sm', thread.unread > 0 ? 'text-white' : 'text-r-text')}>
                      <Highlight text={thread.name} query={search} />
                    </p>
                    {thread.isSpam && <span className="badge bg-red-500/15 text-red-400 text-xs">Spam</span>}
                    {thread.isUnknown && !thread.isSpam && <span className="badge bg-r-amber/15 text-r-amber text-xs">Unknown</span>}
                  </div>
                  <p className="text-xs text-r-muted truncate">
                    <Highlight text={thread.latest.body} query={search} />
                  </p>
                </div>
                <div className="flex-shrink-0 text-right space-y-0.5">
                  <p className="text-xs text-r-muted">{format(new Date(thread.latest.timestamp), 'HH:mm')}</p>
                  {thread.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold ml-auto">{thread.unread}</span>
                  )}
                </div>
              </div>

              {/* Thread actions */}
              <div className="flex gap-2 mt-2 pt-2 border-t border-r-border/20">
                <button onClick={() => setOpenThread(t => t === thread.name ? null : thread.name)}
                  className="text-xs text-r-accent hover:text-r-accent/80 px-2 py-1">Reply</button>
                <button onClick={() => handleArchive(thread.name)}
                  className="text-xs text-r-muted hover:text-r-text px-2 py-1">
                  {tab === 'archived' ? 'Unarchive' : 'Archive'}
                </button>
                {thread.isSpam && (
                  <button onClick={async () => {
                    const c = contacts.find(c => c.name === thread.name)
                    if (c) { await contactsAPI.block(c.id, 'spam'); toast('Contact blocked') }
                  }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Block</button>
                )}
                <button onClick={() => handleDelete(thread.name)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 ml-auto">Delete</button>
              </div>
            </div>

            {/* Open thread messages */}
            {openThread === thread.name && (
              <div className="bg-r-surface rounded-xl border border-r-border/40 p-3 mt-1 space-y-2">
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {thread.msgs.map(m => (
                    <div key={m.id} className={clsx('max-w-[85%] px-3 py-2 rounded-xl text-sm',
                      m.direction === 'outbound' ? 'bg-r-accent text-white ml-auto' : 'bg-r-card text-r-text')}>
                      <p><Highlight text={m.body} query={search} /></p>
                      <p className={clsx('text-xs mt-0.5', m.direction === 'outbound' ? 'text-white/60' : 'text-r-muted')}>
                        {format(new Date(m.timestamp), 'HH:mm')}
                        {m.by_hiah ? ' · Hiah' : ''}
                        {m.status === 'pending' ? ' · pending' : ''}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-r-border/20">
                  <input value={replyBody} onChange={e => setReplyBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { handleSend(thread.name, replyBody); setReplyBody('') } }}
                    placeholder="Reply…" className="input-field flex-1 text-sm py-2" />
                  <button onClick={() => { handleSend(thread.name, replyBody); setReplyBody('') }}
                    disabled={!replyBody.trim()} className="btn-primary px-4 text-sm">→</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
