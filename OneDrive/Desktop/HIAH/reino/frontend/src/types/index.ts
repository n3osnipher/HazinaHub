// ─── Auth ──────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  avatar?: string
  is_verified: boolean
  sim_cards: SimCard[]
  settings: UserSettings
  created_at: string
}

export interface SimCard {
  slot: number
  phone_number?: string
  isp?: string
  is_default: boolean
  is_active: boolean
}

export interface HiahPermissions {
  can_make_calls: boolean
  can_send_sms: boolean
  can_read_messages: boolean
  can_manage_contacts: boolean
  auto_reply: boolean
  notify_on_action: boolean
  detect_spam: boolean          // NEW
  identify_unknown: boolean     // NEW
}

export interface AppSecurity {                  // NEW
  lock_enabled: boolean
  lock_type: 'none' | 'pin' | 'biometric' | 'passkey'
  has_pin: boolean
  auto_lock_minutes: number
  lock_on_background: boolean
  use_phone_biometric: boolean
}

export interface ApiKeys {
  gemini_api_key?: string
  elevenlabs_api_key?: string
  elevenlabs_voice_id: string
}

export interface UserSettings {
  hiah_voice: string
  hiah_language: string
  default_isp: string
  default_sim_slot: number
  notifications_enabled: boolean
  call_recording_enabled: boolean
  stt_provider: string
  tts_provider: string
  theme: string
  stay_logged_in: boolean                       // NEW
  hiah_permissions: HiahPermissions
  api_keys: ApiKeys
  security: AppSecurity                         // NEW
}

// ─── Contacts ──────────────────────────────────────────────────
export interface Contact {
  id: string
  name: string
  phone: string
  phone2?: string
  email?: string
  initials: string
  color: string
  is_favorite: boolean
  is_blocked: boolean                           // NEW
  blocked_at?: string                           // NEW
  block_reason?: string                         // NEW
  is_spam: boolean                              // NEW
  spam_score: number                            // NEW
  is_unknown: boolean                           // NEW
  tags: string[]
  notes?: string
  local_id?: string
  sync_status: 'synced' | 'pending' | 'conflict'
  updated_at: string
}

// ─── Calls ─────────────────────────────────────────────────────
export type CallStatus =
  | 'ringing'
  | 'incoming'
  | 'outgoing'
  | 'ongoing'
  | 'called'
  | 'ended'
  | 'missed'
  | 'rejected'
  | 'failed'
  | 'voicemail'
  | 'connected'  // keep for backward compat

export interface CallRecord {
  id: string
  contact_id?: string
  contact_name: string
  phone: string
  direction: 'inbound' | 'outbound'
  status: CallStatus                            // EXPANDED
  started_at: string
  answered_at?: string                          // NEW
  ended_at?: string
  duration?: number
  isp: string
  sim_slot: number
  by_hiah: boolean
  hiah_notes?: string
  is_unknown: boolean                           // NEW
  is_spam: boolean                              // NEW
  spam_reason?: string                          // NEW
  local_id?: string
  sync_status: string
}

// ─── Messages ──────────────────────────────────────────────────
export interface Message {
  id: string
  contact_id?: string
  contact_name: string
  channel: 'sms'
  direction: 'inbound' | 'outbound'
  body: string
  timestamp: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  is_read: boolean
  is_archived: boolean                          // NEW
  is_deleted: boolean                           // NEW
  deleted_at?: string                           // NEW
  thread_id?: string
  by_hiah: boolean
  isp: string
  sim_slot: number
  is_unknown: boolean                           // NEW
  is_spam: boolean                              // NEW
  spam_reason?: string                          // NEW
  local_id?: string
  sync_status: string
}

// ─── Hiah ──────────────────────────────────────────────────────
export interface HiahChatMessage {
  id: string
  role: 'user' | 'hiah'
  type: 'text' | 'action' | 'result'
  content: string
  timestamp: string
  action?: HiahActionRef
}

export interface HiahActionRef {
  id?: string
  type: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'executing' | 'done' | 'failed' | 'rejected'
  requires_approval: boolean
}

// ─── Notifications ─────────────────────────────────────────────
export interface AppNotification {
  id: string
  type: 'message' | 'call' | 'system' | 'hiah' | 'spam' | 'unknown'  // EXPANDED
  channel?: string
  title: string
  body: string
  is_read: boolean
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
}

// ─── Offline sync ──────────────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface PendingSync {
  contacts: Contact[]
  calls: CallRecord[]
  messages: Message[]
}
