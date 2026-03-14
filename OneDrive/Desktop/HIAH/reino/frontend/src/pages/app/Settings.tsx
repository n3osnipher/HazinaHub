import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { settingsAPI } from '@/services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import type { HiahPermissions, AppSecurity } from '@/types'

function Toggle({ value, onChange, label, desc }: {
  value: boolean; onChange: (v: boolean) => void; label: string; desc?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-r-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-r-text">{label}</p>
        {desc && <p className="text-xs text-r-muted mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={clsx('toggle flex-shrink-0', value ? 'bg-r-accent' : 'bg-r-border')}
      >
        <span className={clsx('toggle-thumb', value ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="font-display font-semibold text-white text-base border-b border-r-border/30 pb-3 mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

// Typed security response from backend
interface SecurityData {
  lock_enabled: boolean
  lock_type: 'none' | 'pin' | 'biometric' | 'passkey'
  has_pin: boolean
  auto_lock_minutes: number
  lock_on_background: boolean
  use_phone_biometric: boolean
}

export default function Settings() {
  const { user, updateUser, logout } = useStore()
  const s     = user?.settings
  const perms = s?.hiah_permissions

  const [lang, setLang]     = useState(s?.hiah_language ?? 'en-KE')
  const [gemKey, setGemKey] = useState('')
  const [elKey, setElKey]   = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  // Security state — properly typed
  const [secData, setSecData]   = useState<SecurityData | null>(null)
  const [newPin, setNewPin]     = useState('')
  const [curPin, setCurPin]     = useState('')
  const [lockType, setLockType] = useState<'none' | 'pin' | 'biometric' | 'passkey'>(
    s?.security?.lock_type ?? 'none'
  )

  useEffect(() => {
    settingsAPI.getSecurity()
      .then(({ data }) => {
        const sec = data.security as SecurityData
        setSecData(sec)
        setLockType(sec.lock_type)
      })
      .catch(() => {})
  }, [])

  const save = async (section: string, data: Record<string, unknown>) => {
    setSaving(section)
    try {
      if (section === 'general')  await settingsAPI.updateGeneral(data)
      if (section === 'api-keys') await settingsAPI.updateApiKeys(data)
      if (section === 'perms')    await settingsAPI.updatePermissions(data)
      if (section === 'security') {
        const { data: res } = await settingsAPI.updateSecurity(data)
        const updated = res.security as SecurityData
        setSecData(updated)
        // Update user store with new security settings
        if (s) {
          const newSec: AppSecurity = {
            lock_enabled:        updated.lock_enabled,
            lock_type:           updated.lock_type,
            has_pin:             updated.has_pin,
            auto_lock_minutes:   updated.auto_lock_minutes,
            lock_on_background:  updated.lock_on_background,
            use_phone_biometric: updated.use_phone_biometric,
          }
          updateUser({ settings: { ...s, security: newSec } })
        }
      }
      toast.success('Saved!')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save'
      toast.error(msg)
    } finally {
      setSaving(null)
    }
  }

  const togglePerm = async (key: keyof HiahPermissions, val: boolean) => {
    if (!perms || !s) return
    const updated: HiahPermissions = { ...perms, [key]: val }
    updateUser({ settings: { ...s, hiah_permissions: updated } })
    await save('perms', { [key]: val })
  }

  const handleSetPin = async () => {
    if (newPin.length < 4) { toast.error('PIN must be at least 4 digits'); return }
    await save('security', {
      lock_enabled: true,
      lock_type: 'pin',
      pin: newPin,
      current_pin: curPin || undefined,
    })
    setNewPin('')
    setCurPin('')
  }

  const handleEnableBiometric = async () => {
    await save('security', { lock_enabled: true, lock_type: 'biometric', use_phone_biometric: true })
  }

  const handleDisableLock = async () => {
    await save('security', { lock_enabled: false, lock_type: 'none' })
    setLockType('none')
  }

  const updateStayLoggedIn = async (v: boolean) => {
    if (!s) return
    updateUser({ settings: { ...s, stay_logged_in: v } })
    await save('general', { stay_logged_in: v })
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-2xl mx-auto space-y-4 animate-fade-up pb-20 lg:pb-4">

      {/* SIM Cards */}
      {(user?.sim_cards.length ?? 0) > 0 && (
        <Card title="📡 SIM Cards">
          <div className="space-y-2">
            {user!.sim_cards.map(sim => (
              <div key={sim.slot} className="flex items-center gap-3 py-2">
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                  sim.is_default ? 'bg-r-accent/20 text-r-accent' : 'bg-r-card text-r-muted'
                )}>
                  {sim.slot + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-r-text">SIM {sim.slot + 1} · {sim.isp ?? 'Unknown'}</p>
                  <p className="text-xs text-r-muted">{sim.phone_number ?? 'Number not available'}</p>
                </div>
                {sim.is_default && <span className="badge badge-hiah">Default</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-r-muted mt-2 pt-2 border-t border-r-border/20">
            Auto-detected when Reino is installed on your Android phone.
          </p>
        </Card>
      )}

      {/* 🔒 App Security */}
      <Card title="🔒 App Security">
        <p className="text-xs text-r-muted mb-4">
          Lock the app with a PIN or biometric. You stay logged in — just need to re-authenticate to open.
        </p>

        {/* Lock type selector */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {([
            { type: 'none'      as const, icon: '🔓', label: 'None' },
            { type: 'pin'       as const, icon: '🔢', label: 'PIN' },
            { type: 'biometric' as const, icon: '👆', label: 'Biometric' },
          ]).map(opt => (
            <button
              key={opt.type}
              onClick={() => setLockType(opt.type)}
              className={clsx(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all',
                lockType === opt.type
                  ? 'bg-r-accent/20 text-r-accent border-r-accent/40'
                  : 'bg-r-card text-r-muted border-r-border hover:text-r-text'
              )}
            >
              <span className="text-xl">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* PIN setup */}
        {lockType === 'pin' && (
          <div className="space-y-3">
            {secData?.has_pin && (
              <div>
                <label className="text-xs text-r-muted mb-1 block">Current PIN</label>
                <input
                  type="password"
                  value={curPin}
                  onChange={e => setCurPin(e.target.value)}
                  className="input-field text-sm py-2.5"
                  placeholder="Enter current PIN to change"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-r-muted mb-1 block">
                {secData?.has_pin ? 'New PIN' : 'Set PIN'} (4-6 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="input-field text-sm py-2.5 font-mono tracking-widest"
                placeholder="••••••"
              />
            </div>
            <div>
              <label className="text-xs text-r-muted mb-1 block">Auto-lock after</label>
              <select
                className="input-field text-sm py-2.5"
                value={secData?.auto_lock_minutes ?? 5}
                onChange={e => save('security', { auto_lock_minutes: parseInt(e.target.value) })}
              >
                <option value="0">Never</option>
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </div>
            <button
              onClick={handleSetPin}
              disabled={!newPin || saving === 'security'}
              className="btn-primary w-full py-2.5 text-sm"
            >
              {saving === 'security' ? 'Setting PIN…' : secData?.has_pin ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>
        )}

        {/* Biometric setup */}
        {lockType === 'biometric' && (
          <div className="space-y-3">
            <p className="text-sm text-r-muted">Uses your device fingerprint or face recognition.</p>
            <button
              onClick={handleEnableBiometric}
              disabled={saving === 'security'}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Enable Biometric Lock
            </button>
          </div>
        )}

        {/* Disable lock */}
        {lockType === 'none' && secData?.lock_enabled && (
          <button onClick={handleDisableLock} className="btn-secondary w-full py-2.5 text-sm">
            Disable App Lock
          </button>
        )}

        {secData?.lock_enabled && (
          <div className="mt-3 pt-3 border-t border-r-border/20">
            <Toggle
              value={secData.lock_on_background}
              onChange={v => save('security', { lock_on_background: v })}
              label="Lock when app backgrounds"
              desc="Re-authenticate when switching back to the app"
            />
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-r-border/20">
          <Toggle
            value={s?.stay_logged_in ?? true}
            onChange={updateStayLoggedIn}
            label="Stay logged in"
            desc="Keep you signed in when the app restarts. Disable for shared devices."
          />
        </div>
      </Card>

      {/* Hiah Permissions */}
      <Card title="🤖 Hiah Permissions">
        <p className="text-xs text-r-muted mb-3">Control exactly what Hiah can do on your behalf.</p>
        {perms && (
          <>
            <Toggle value={perms.can_make_calls}      onChange={v => togglePerm('can_make_calls', v)}      label="Make Calls"            desc="Hiah can dial calls using your SIM" />
            <Toggle value={perms.can_send_sms}        onChange={v => togglePerm('can_send_sms', v)}        label="Send SMS"              desc="Hiah can send text messages" />
            <Toggle value={perms.can_read_messages}   onChange={v => togglePerm('can_read_messages', v)}   label="Read Messages"         desc="Hiah can read and summarise your messages" />
            <Toggle value={perms.can_manage_contacts} onChange={v => togglePerm('can_manage_contacts', v)} label="Manage Contacts"       desc="Hiah can look up and update contacts" />
            <Toggle value={perms.detect_spam}         onChange={v => togglePerm('detect_spam', v)}         label="Detect Spam"           desc="Hiah flags suspicious calls and messages" />
            <Toggle value={perms.identify_unknown}    onChange={v => togglePerm('identify_unknown', v)}    label="Identify Unknown"      desc="Hiah labels unsaved number callers/senders" />
            <Toggle value={perms.auto_reply}          onChange={v => togglePerm('auto_reply', v)}          label="Auto-Reply"            desc="Hiah automatically replies to simple messages" />
            <Toggle value={perms.notify_on_action}    onChange={v => togglePerm('notify_on_action', v)}    label="Require Confirmation"  desc="Hiah asks before executing calls and SMS" />
          </>
        )}
      </Card>

      {/* Voice & Language */}
      <Card title="🎙 Voice & Language">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-r-muted mb-1.5 block">Language</label>
            <select value={lang} onChange={e => setLang(e.target.value)} className="input-field text-sm py-2.5">
              <option value="en-KE">English (Kenya)</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="sw-KE">Swahili (Kenya)</option>
            </select>
          </div>
          <button
            onClick={() => save('general', { hiah_language: lang })}
            disabled={saving === 'general'}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {saving === 'general' ? 'Saving…' : 'Save Language'}
          </button>
        </div>
      </Card>

      {/* AI Integration — no key values shown */}
      <Card title="🔗 AI Integration">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-r-text">Hiah Brain (AI)</p>
              <p className="text-xs text-r-muted mt-0.5">AI-powered responses and decisions</p>
            </div>
            <span className={clsx('badge', s?.api_keys.gemini_api_key ? 'badge-hiah' : 'bg-r-muted/10 text-r-muted')}>
              {s?.api_keys.gemini_api_key ? '✓ Active' : '○ Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-r-border/20">
            <div>
              <p className="text-sm font-medium text-r-text">Hiah Voice (TTS)</p>
              <p className="text-xs text-r-muted mt-0.5">Natural female voice synthesis</p>
            </div>
            <span className={clsx('badge', s?.api_keys.elevenlabs_api_key ? 'badge-hiah' : 'bg-r-muted/10 text-r-muted')}>
              {s?.api_keys.elevenlabs_api_key ? '✓ Active' : '○ Not set'}
            </span>
          </div>
          <div className="border-t border-r-border/20 pt-4 space-y-3">
            <p className="text-xs text-r-muted">Update keys (leave blank to keep current):</p>
            <div>
              <label className="text-xs text-r-muted mb-1 block">AI Key</label>
              <input
                type="password"
                value={gemKey}
                onChange={e => setGemKey(e.target.value)}
                className="input-field text-sm py-2.5"
                placeholder="Paste new key to update…"
              />
            </div>
            <div>
              <label className="text-xs text-r-muted mb-1 block">Voice Key</label>
              <input
                type="password"
                value={elKey}
                onChange={e => setElKey(e.target.value)}
                className="input-field text-sm py-2.5"
                placeholder="Paste new key to update…"
              />
            </div>
            <button
              onClick={() => {
                const payload: Record<string, unknown> = {}
                if (gemKey.trim()) payload.gemini_api_key = gemKey.trim()
                if (elKey.trim())  payload.elevenlabs_api_key = elKey.trim()
                if (!Object.keys(payload).length) { toast('No keys entered'); return }
                save('api-keys', payload).then(() => { setGemKey(''); setElKey('') })
              }}
              disabled={saving === 'api-keys'}
              className="btn-primary w-full py-2.5 text-sm"
            >
              {saving === 'api-keys' ? 'Saving…' : 'Update Keys'}
            </button>
          </div>
        </div>
      </Card>

      {/* Install PWA */}
      <Card title="📲 Install on Phone">
        <p className="text-sm text-r-muted leading-relaxed mb-3">
          Open in <strong className="text-r-text">Chrome (Android)</strong> or{' '}
          <strong className="text-r-text">Safari (iPhone)</strong>, tap{' '}
          <strong className="text-r-text">Add to Home Screen</strong>.
          Auto-detects SIM cards and syncs with the web dashboard.
        </p>
        <div className="bg-r-surface rounded-xl p-3 text-xs text-r-muted space-y-1">
          <p>✓ Offline-first — syncs when online</p>
          <p>✓ Auto-detects Safaricom / Airtel SIMs</p>
          <p>✓ Native calls &amp; SMS via your SIM</p>
          <p>✓ App lock with PIN / biometric</p>
        </div>
      </Card>

      <button onClick={() => logout()} className="btn-danger w-full py-3">
        Sign Out
      </button>
    </div>
  )
}
