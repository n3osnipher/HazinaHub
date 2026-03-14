import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { contactsAPI, callsAPI, messagesAPI, notifAPI, getWSUrl } from '@/services/api'
import { getQueue, clearAllQueue } from '@/services/offline'

export function useSync() {
  const {
    token, isAuthenticated, isOnline,
    setOnline, setSyncStatus,
    setContacts, setCalls, setMessages, setNotifications, setUnreadCount,
    addMessage, addNotification, updateCall,
  } = useStore()

  const wsRef    = useRef<WebSocket | null>(null)
  const syncLock = useRef(false)
  const pingRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch all data from backend ──────────────────────────
  const fetchAll = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const [cRes, callsRes, msgsRes, notifsRes] = await Promise.allSettled([
        contactsAPI.list(),
        callsAPI.list(),
        messagesAPI.list(),
        notifAPI.list(),
      ])
      if (cRes.status === 'fulfilled')      setContacts(cRes.value.data.data ?? [])
      if (callsRes.status === 'fulfilled')  setCalls(callsRes.value.data.data ?? [])
      if (msgsRes.status === 'fulfilled') {
        setMessages(msgsRes.value.data.data ?? [])
        setUnreadCount(msgsRes.value.data.unread ?? 0)
      }
      if (notifsRes.status === 'fulfilled') setNotifications(notifsRes.value.data.data ?? [])
    } catch (e) {
      console.error('[Sync] fetchAll error:', e)
    }
  }, [isAuthenticated, setContacts, setCalls, setMessages, setNotifications, setUnreadCount])

  // ── Flush offline queue ───────────────────────────────────
  const flushQueue = useCallback(async () => {
    if (syncLock.current || !isOnline || !isAuthenticated) return
    syncLock.current = true
    setSyncStatus('syncing')
    try {
      const queue = await getQueue()
      if (!queue.length) { setSyncStatus('idle'); syncLock.current = false; return }

      const pending = { contacts: [] as unknown[], calls: [] as unknown[], messages: [] as unknown[] }
      for (const item of queue) {
        if (item.type === 'contact') pending.contacts.push(item.payload)
        if (item.type === 'call')    pending.calls.push(item.payload)
        if (item.type === 'message') pending.messages.push(item.payload)
      }
      await Promise.allSettled([
        pending.contacts.length ? contactsAPI.sync(pending.contacts) : Promise.resolve(),
        pending.calls.length    ? callsAPI.sync(pending.calls)       : Promise.resolve(),
        pending.messages.length ? messagesAPI.sync(pending.messages) : Promise.resolve(),
      ])
      await clearAllQueue()
      await fetchAll()
      setSyncStatus('idle')
    } catch (e) {
      console.error('[Sync] flush error:', e)
      setSyncStatus('error')
    } finally {
      syncLock.current = false
    }
  }, [isOnline, isAuthenticated, fetchAll, setSyncStatus])

  // ── WebSocket ─────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!token || !isAuthenticated) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const url = getWSUrl(token)
      const ws  = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected')
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
          else if (pingRef.current) clearInterval(pingRef.current)
        }, 25000)
      }

      ws.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data as string)
          switch (event.type) {
            case 'new_message':   addMessage(event.payload);                      break
            case 'call_update':   updateCall(event.payload.id, event.payload);    break
            case 'notification':  addNotification(event.payload);                 break
            case 'hiah_action':   window.dispatchEvent(new CustomEvent('hiah:action', { detail: event.payload })); break
            case 'sync_complete': fetchAll();                                      break
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current)
        console.log('[WS] Disconnected, retry in 4s…')
        setTimeout(() => { if (isAuthenticated) connectWS() }, 4000)
      }

      ws.onerror = () => ws.close()
    } catch (e) {
      console.log('[WS] Could not connect:', e)
    }
  }, [token, isAuthenticated, addMessage, updateCall, addNotification, fetchAll])

  // ── Online/offline events ─────────────────────────────────
  useEffect(() => {
    const onOnline  = () => { setOnline(true);  flushQueue(); connectWS() }
    const onOffline = () => { setOnline(false); setSyncStatus('offline') }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushQueue, connectWS, setOnline, setSyncStatus])

  // ── Bootstrap ─────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      fetchAll()
      connectWS()
    }
    return () => {
      if (pingRef.current) clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [isAuthenticated]) // eslint-disable-line

  return { fetchAll, flushQueue }
}
