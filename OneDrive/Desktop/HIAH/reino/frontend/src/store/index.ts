import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Contact, CallRecord, Message, AppNotification, HiahChatMessage, SyncStatus } from '@/types'

interface Store {
  // Auth
  token: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (token: string, user: User) => void
  updateUser: (u: Partial<User>) => void
  logout: () => void

  // Data
  contacts: Contact[]
  calls: CallRecord[]
  messages: Message[]
  notifications: AppNotification[]
  hiahChat: HiahChatMessage[]
  unreadCount: number

  // UI
  sidebarOpen: boolean
  hiahMode: 'idle' | 'listening' | 'thinking' | 'speaking'
  syncStatus: SyncStatus
  isOnline: boolean

  // Data setters
  setContacts: (c: Contact[]) => void
  addContact: (c: Contact) => void
  updateContact: (id: string, patch: Partial<Contact>) => void
  removeContact: (id: string) => void

  setCalls: (c: CallRecord[]) => void
  addCall: (c: CallRecord) => void
  updateCall: (id: string, patch: Partial<CallRecord>) => void

  setMessages: (m: Message[]) => void
  addMessage: (m: Message) => void
  markMessageRead: (id: string) => void

  setNotifications: (n: AppNotification[]) => void
  addNotification: (n: AppNotification) => void
  markNotifRead: (id: string) => void
  markAllNotifRead: () => void

  addHiahMessage: (m: HiahChatMessage) => void
  clearHiahChat: () => void

  setSidebarOpen: (v: boolean) => void
  setHiahMode: (m: 'idle' | 'listening' | 'thinking' | 'speaking') => void
  setSyncStatus: (s: SyncStatus) => void
  setOnline: (v: boolean) => void
  setUnreadCount: (n: number) => void
}

const HIAH_WELCOME: HiahChatMessage = {
  id: 'welcome',
  role: 'hiah',
  type: 'text',
  content: "Hi! I'm Hiah, your Reino communications agent. I can make calls, send SMS, and help you manage all your messages. What would you like me to do?",
  timestamp: new Date().toISOString(),
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        localStorage.setItem('reino_token', token)
        set({ token, user, isAuthenticated: true })
      },
      updateUser: (u) => set(s => ({ user: s.user ? { ...s.user, ...u } : null })),
      logout: () => {
        localStorage.removeItem('reino_token')
        set({ token: null, user: null, isAuthenticated: false, contacts: [], calls: [], messages: [], notifications: [], hiahChat: [HIAH_WELCOME] })
      },

      contacts: [],
      calls: [],
      messages: [],
      notifications: [],
      hiahChat: [HIAH_WELCOME],
      unreadCount: 0,

      sidebarOpen: false,
      hiahMode: 'idle',
      syncStatus: 'idle',
      isOnline: navigator.onLine,

      setContacts: (contacts) => set({ contacts }),
      addContact: (c) => set(s => ({ contacts: [c, ...s.contacts.filter(x => x.id !== c.id)] })),
      updateContact: (id, patch) => set(s => ({ contacts: s.contacts.map(c => c.id === id ? { ...c, ...patch } : c) })),
      removeContact: (id) => set(s => ({ contacts: s.contacts.filter(c => c.id !== id) })),

      setCalls: (calls) => set({ calls }),
      addCall: (c) => set(s => ({ calls: [c, ...s.calls.filter(x => x.id !== c.id)] })),
      updateCall: (id, patch) => set(s => ({ calls: s.calls.map(c => c.id === id ? { ...c, ...patch } : c) })),

      setMessages: (messages) => set({ messages }),
      addMessage: (m) => set(s => ({ messages: [m, ...s.messages.filter(x => x.id !== m.id)] })),
      markMessageRead: (id) => set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, is_read: true } : m) })),

      setNotifications: (notifications) => set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length }),
      addNotification: (n) => set(s => ({ notifications: [n, ...s.notifications], unreadCount: s.unreadCount + 1 })),
      markNotifRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n), unreadCount: Math.max(0, s.unreadCount - 1) })),
      markAllNotifRead: () => set(s => ({ notifications: s.notifications.map(n => ({ ...n, is_read: true })), unreadCount: 0 })),

      addHiahMessage: (m) => set(s => ({ hiahChat: [...s.hiahChat, m] })),
      clearHiahChat: () => set({ hiahChat: [HIAH_WELCOME] }),

      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setHiahMode: (m) => set({ hiahMode: m }),
      setSyncStatus: (s) => set({ syncStatus: s }),
      setOnline: (v) => set({ isOnline: v }),
      setUnreadCount: (n) => set({ unreadCount: n }),
    }),
    {
      name: 'reino-store',
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated, hiahChat: s.hiahChat.slice(-30) }),
    }
  )
)
