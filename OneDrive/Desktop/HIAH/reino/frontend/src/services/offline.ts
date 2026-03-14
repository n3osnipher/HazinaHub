/**
 * Reino - Offline Storage (IndexedDB via idb)
 * Stores pending contacts, calls, messages while offline.
 * Synced to backend when connection is restored.
 */
import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'reino-offline'
const DB_VERSION = 1

interface ReinoDB {
  contacts: { key: string; value: Record<string, unknown> }
  calls:    { key: string; value: Record<string, unknown> }
  messages: { key: string; value: Record<string, unknown> }
  queue:    { key: string; value: { id: string; type: string; payload: unknown; createdAt: string } }
}

let _db: IDBPDatabase<ReinoDB> | null = null

async function getDB(): Promise<IDBPDatabase<ReinoDB>> {
  if (_db) return _db
  _db = await openDB<ReinoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('calls'))    db.createObjectStore('calls',    { keyPath: 'id' })
      if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('queue'))    db.createObjectStore('queue',    { keyPath: 'id' })
    }
  })
  return _db
}

// ── Generic store ops ─────────────────────────────────────────
export async function offlineGet<T>(store: keyof ReinoDB, key: string): Promise<T | undefined> {
  const db = await getDB()
  return db.get(store, key) as Promise<T | undefined>
}

export async function offlineGetAll<T>(store: keyof ReinoDB): Promise<T[]> {
  const db = await getDB()
  return db.getAll(store) as Promise<T[]>
}

export async function offlinePut(store: keyof ReinoDB, value: Record<string, unknown> | { id: string; type: string; payload: unknown; createdAt: string }): Promise<void> {
  const db = await getDB()
  await db.put(store, value as never)
}

export async function offlineDelete(store: keyof ReinoDB, key: string): Promise<void> {
  const db = await getDB()
  await db.delete(store, key)
}

export async function offlineClear(store: keyof ReinoDB): Promise<void> {
  const db = await getDB()
  await db.clear(store)
}

// ── Sync queue ────────────────────────────────────────────────
export async function queueSync(type: 'contact' | 'call' | 'message', payload: unknown): Promise<void> {
  const db = await getDB()
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await db.put('queue', { id, type, payload, createdAt: new Date().toISOString() })
}

export async function getQueue(): Promise<Array<{ id: string; type: string; payload: unknown; createdAt: string }>> {
  const db = await getDB()
  return db.getAll('queue')
}

export async function clearQueueItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('queue', id)
}

export async function clearAllQueue(): Promise<void> {
  const db = await getDB()
  await db.clear('queue')
}
