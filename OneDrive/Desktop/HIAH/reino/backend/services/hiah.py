"""
Reino - Hiah AI Service v2.2
Added: spam_phones context, identify_unknown tool,
       spam detection in responses, chat history support
"""
import re
import logging
import asyncio
from typing import Optional, Any
from datetime import datetime

from config import settings
from models import User

logger = logging.getLogger(__name__)


def _build_system(user: "User", contacts: list, messages_data: list,
                  calls_data: list, notifications_data: list,
                  spam_phones: set) -> str:
    perms  = user.settings.hiah_permissions
    sims   = user.sim_cards
    default_sim = next((s for s in sims if s.is_default), sims[0] if sims else None)

    sim_lines = "\n".join(
        f"  SIM{s.slot+1}: {s.isp or 'Unknown'}"
        + (f" ({s.phone_number})" if s.phone_number else "")
        + (" [DEFAULT]" if s.is_default else "")
        for s in sims
    ) if sims else "  No SIM cards detected (web mode)"

    perm_lines = (
        f"  make_calls      : {'YES' if perms.can_make_calls else 'NO'}\n"
        f"  send_sms        : {'YES' if perms.can_send_sms else 'NO'}\n"
        f"  read_messages   : {'YES' if perms.can_read_messages else 'NO'}\n"
        f"  manage_contacts : {'YES' if perms.can_manage_contacts else 'NO'}\n"
        f"  auto_reply      : {'YES' if perms.auto_reply else 'NO'}\n"
        f"  detect_spam     : {'YES' if perms.detect_spam else 'NO'}\n"
        f"  identify_unknown: {'YES' if perms.identify_unknown else 'NO'}\n"
        f"  confirm_actions : {'YES — ask before acting' if perms.notify_on_action else 'NO — act immediately'}"
    )

    contact_lines = "\n".join(
        f"  {i+1}. {c.get('name','?')} — {c.get('phone','?')}"
        + (f" / {c.get('phone2')}" if c.get('phone2') else "")
        + (" [BLOCKED]" if c.get('is_blocked') else "")
        + (" [SPAM]" if c.get('is_spam') else "")
        for i, c in enumerate(contacts[:50])
    ) if contacts else "  (empty)"

    unread = [m for m in messages_data if not m.get("is_read", True)][:8]
    msg_lines = "\n".join(
        f"  [{i+1}] {'⚠️SPAM ' if m.get('is_spam') else '❓UNKNOWN ' if m.get('is_unknown') else ''}"
        f"From {m.get('contact_name','?')}: \"{m.get('body','')[:100]}\""
        for i, m in enumerate(unread)
    ) if unread else "  (none)"

    missed = [c for c in calls_data if c.get("status") == "missed"][:5]
    call_lines = "\n".join(
        f"  {'⚠️SPAM ' if c.get('is_spam') else '❓UNKNOWN ' if c.get('is_unknown') else ''}"
        f"{c.get('contact_name','?')} ({c.get('phone','?')}) — {str(c.get('started_at',''))[:16]}"
        for c in missed
    ) if missed else "  (none)"

    unread_n = [n for n in notifications_data if not n.get("is_read", True)][:5]
    notif_lines = "\n".join(
        f"  [{n.get('type','?')}] {n.get('title','?')}: {n.get('body','')[:80]}"
        for n in unread_n
    ) if unread_n else "  (none)"

    spam_lines = ", ".join(list(spam_phones)[:10]) if spam_phones else "none"
    default_slot = default_sim.slot if default_sim else 0

    lines = [
        "You are Hiah, a warm, intelligent AI communications agent for Reino Daily Task Assistant.",
        "You are female. Speak naturally, warmly, and in first person. Be concise.",
        "",
        "=== USER CONTEXT ===",
        f"Name:        {user.name}",
        f"Time:        {datetime.now().strftime('%A %d %B %Y, %H:%M')}",
        f"Default ISP: {user.settings.default_isp}",
        f"Default SIM: SIM{default_slot + 1}",
        "",
        "SIM Cards:",
        sim_lines,
        "",
        "Permissions:",
        perm_lines,
        "",
        "Contacts:",
        contact_lines,
        "",
        "Unread messages:",
        msg_lines,
        "",
        "Missed calls:",
        call_lines,
        "",
        "Unread notifications:",
        notif_lines,
        "",
        "Known spam numbers:",
        f"  {spam_lines}",
        "",
        "=== CAPABILITIES ===",
        "- MAKE_CALL      : dial a phone number",
        "- SEND_SMS       : send an SMS",
        "- READ_MESSAGES  : read unread SMS aloud",
        "- READ_CALLS     : report missed/recent calls",
        "- READ_NOTIFICATIONS: read notifications aloud",
        "- SEARCH_CONTACT : look up a contact",
        "- DETECT_SPAM    : flag a number as potential spam",
        "- IDENTIFY_UNKNOWN: try to identify an unsaved number",
        "",
        "=== RULES ===",
        "1. PERMISSIONS: Check before acting. If denied → direct to Settings > Hiah Permissions.",
        "2. DISAMBIGUATION: Multiple contacts with same name → list them numbered, ask which one.",
        "3. VALIDATION: Never make a call/SMS to a name or phone not in the contacts list.",
        "   If the number isn't in contacts, say so and ask user to add it first or confirm the number.",
        "4. BLOCKED: If a contact is [BLOCKED], warn user and do not proceed unless they unblock first.",
        "5. SPAM WARNING: If a number is marked [SPAM] or in known spam numbers, warn the user.",
        "6. UNKNOWN: If caller/sender has ❓UNKNOWN tag, tell user it's from an unsaved number.",
        "7. CONFIRM: For calls and SMS, confirm name, number, and SIM before acting.",
        "8. READ ALOUD: List messages/notifications/calls clearly, numbered.",
        "9. IMPOSSIBLE: WhatsApp/Facebook/email → explain not supported, offer SMS instead.",
        "10. SIM: Tell user which SIM will be used. Ask if they want a different one.",
        "",
        "=== ACTION TAGS ===",
        "Append ONE at END when ready to execute:",
        "  [ACTION:MAKE_CALL:PHONE:SLOT]          e.g. [ACTION:MAKE_CALL:+254712345678:0]",
        "  [ACTION:SEND_SMS:PHONE:BODY:SLOT]      e.g. [ACTION:SEND_SMS:+254712345678:Hello!:0]",
        "  [ACTION:READ_MESSAGES]",
        "  [ACTION:READ_CALLS]",
        "  [ACTION:READ_NOTIFICATIONS]",
        "  [ACTION:SEARCH_CONTACT:John]",
        "  [ACTION:FLAG_SPAM:+254700000000]",
        "",
        "NEVER add an action tag if you are not 100% certain of the phone number.",
        "NEVER guess or fabricate a phone number.",
    ]
    return "\n".join(lines)


class HiahService:
    def __init__(self):
        self._models: dict[str, Any] = {}

    def _get_model(self, api_key: Optional[str] = None):
        key = api_key or settings.gemini_api_key
        if not key:
            return None
        if key in self._models:
            return self._models[key]
        try:
            import google.generativeai as genai
            genai.configure(api_key=key)
            model = genai.GenerativeModel(
                model_name="gemini-2.0-flash-exp",
                generation_config={"temperature": 0.7, "max_output_tokens": 1200},
            )
            self._models[key] = model
            return model
        except Exception as e:
            logger.error(f"Gemini init error: {e}")
            return None

    async def chat(
        self,
        message: str,
        history: list[dict],
        user: User,
        contacts: list | None = None,
        messages_data: list | None = None,
        calls_data: list | None = None,
        notifications_data: list | None = None,
        spam_phones: set | None = None,
    ) -> dict:
        perms = user.settings.hiah_permissions
        sims  = user.sim_cards

        system = _build_system(
            user,
            contacts or [],
            messages_data or [],
            calls_data or [],
            notifications_data or [],
            spam_phones or set(),
        )

        api_key = user.settings.api_keys.gemini_api_key or settings.gemini_api_key
        model   = self._get_model(api_key)
        content = ""

        if model:
            try:
                gemini_history = []
                for m in history[-16:]:
                    role = "model" if m.get("role") == "hiah" else "user"
                    text = m.get("content", "")
                    if text:
                        gemini_history.append({"role": role, "parts": [text]})

                session = model.start_chat(history=gemini_history)
                resp = await asyncio.to_thread(
                    session.send_message,
                    f"{system}\n\n---\nUser: {message}"
                )
                content = resp.text
            except Exception as e:
                logger.error(f"Gemini error: {e}")
                content = self._smart_fallback(
                    message, perms, contacts or [], messages_data or [],
                    calls_data or [], notifications_data or [], sims, user.name,
                    spam_phones or set()
                )
        else:
            content = self._smart_fallback(
                message, perms, contacts or [], messages_data or [],
                calls_data or [], notifications_data or [], sims, user.name,
                spam_phones or set()
            )

        action = _parse_action(content, perms)
        if action:
            content = re.sub(r'\[ACTION:[^\]]+\]', '', content).strip()

        return {"content": content, "action": action}

    def _smart_fallback(self, message: str, perms, contacts: list,
                        messages: list, calls: list, notifications: list,
                        sims: list, user_name: str, spam_phones: set) -> str:
        lower = message.lower().strip()

        if any(w in lower for w in ["hello", "hi", "hey", "help", "what can"]):
            p = []
            if perms.can_make_calls:    p.append("📞 Make phone calls")
            if perms.can_send_sms:      p.append("💬 Send SMS messages")
            if perms.can_read_messages: p.append("📨 Read your messages & calls")
            p.append("🔔 Report notifications")
            if perms.detect_spam:       p.append("🚫 Detect spam calls & messages")
            sim_str = ", ".join(f"SIM{s.slot+1} ({s.isp or '?'})" for s in sims) if sims else "no SIM"
            return (
                f"Hi {user_name}! I'm Hiah 💜\n\n"
                f"I can:\n" + "\n".join(f"• {x}" for x in p) +
                f"\n\nYour SIMs: {sim_str}\n\n"
                "Try: \"Call Mama\", \"Text John: I'm on my way\", \"Read my messages\", or \"Any spam calls?\""
            )

        if any(w in lower for w in ["spam", "scam", "suspicious", "unknown caller", "strange number"]):
            spam_msgs = [m for m in messages if m.get("is_spam")]
            unknown_msgs = [m for m in messages if m.get("is_unknown") and not m.get("is_spam")]
            spam_calls = [c for c in calls if c.get("is_spam")]
            unknown_calls = [c for c in calls if c.get("is_unknown") and not c.get("is_spam")]
            parts = []
            if spam_calls:
                parts.append(f"⚠️ **{len(spam_calls)} spam call(s)**: " + ", ".join(c.get('phone','?') for c in spam_calls[:3]))
            if unknown_calls:
                parts.append(f"❓ **{len(unknown_calls)} call(s) from unknown numbers**: " + ", ".join(c.get('phone','?') for c in unknown_calls[:3]))
            if spam_msgs:
                parts.append(f"⚠️ **{len(spam_msgs)} spam message(s)**")
            if unknown_msgs:
                parts.append(f"❓ **{len(unknown_msgs)} message(s) from unknown numbers**")
            if not parts:
                return "No spam or unknown contacts detected recently. ✅"
            return "Here's what I found:\n\n" + "\n".join(parts) + "\n\nWould you like me to block any of these numbers?"

        if any(w in lower for w in ["read", "unread", "inbox", "my message"]):
            unread = [m for m in messages if not m.get("is_read", True)]
            if not unread:
                return "No unread messages ✅"
            lines = [f"You have {len(unread)} unread message(s):\n"]
            for i, m in enumerate(unread[:5], 1):
                spam_tag = " ⚠️SPAM" if m.get("is_spam") else (" ❓Unknown" if m.get("is_unknown") else "")
                lines.append(f"{i}. From **{m.get('contact_name','?')}**{spam_tag}: \"{m.get('body','')[:100]}\"")
            if len(unread) > 5:
                lines.append(f"\n…and {len(unread)-5} more.")
            return "\n".join(lines) + "\n\n[ACTION:READ_MESSAGES]"

        if any(w in lower for w in ["notification", "alert", "update"]):
            unread_n = [n for n in notifications if not n.get("is_read", True)]
            if not unread_n:
                return "No new notifications ✅"
            lines = [f"You have {len(unread_n)} notification(s):\n"]
            for i, n in enumerate(unread_n[:5], 1):
                lines.append(f"{i}. **{n.get('title','?')}** — {n.get('body','')[:100]}")
            return "\n".join(lines) + "\n\n[ACTION:READ_NOTIFICATIONS]"

        if any(w in lower for w in ["missed", "who called", "missed call"]):
            missed = [c for c in calls if c.get("status") == "missed"]
            if not missed:
                return "No missed calls! 📞"
            lines = [f"You have {len(missed)} missed call(s):\n"]
            for i, c in enumerate(missed[:5], 1):
                t = str(c.get("started_at",""))[:16].replace("T"," ")
                spam_tag = " ⚠️SPAM" if c.get("is_spam") else (" ❓Unknown" if c.get("is_unknown") else "")
                lines.append(f"{i}. **{c.get('contact_name','?')}**{spam_tag} at {t}")
            return "\n".join(lines) + "\n\n[ACTION:READ_CALLS]"

        if re.search(r'\b(call|ring|phone|dial)\b', lower):
            if not perms.can_make_calls:
                return "I can't make calls yet — enable \"Make Calls\" in **Settings → Hiah Permissions**."
            name_m = re.search(r'(?:call|ring|phone|dial)\s+(.+?)(?:\s+(?:for me|please|now|on).*)?$', message, re.I)
            name = name_m.group(1).strip().title() if name_m else None
            if not name:
                return "Who should I call?"
            hits = [c for c in contacts if name.lower() in c.get("name","").lower() and not c.get("is_blocked")]
            if not hits:
                # Check if it's a raw number
                if re.match(r'^\+?[\d\s]{7,}$', name):
                    if name in spam_phones:
                        return f"⚠️ Warning: **{name}** is flagged as spam. Are you sure you want to call it?"
                    return f"**{name}** isn't in your contacts. Would you like to save it first, or call it directly?"
                return f"I couldn't find **{name}** in your contacts. Please add them first or give me their number."
            # Check spam
            for c in hits:
                if c.get("is_spam"):
                    return f"⚠️ **{c['name']}** ({c['phone']}) is flagged as spam. Call anyway?"
            if len(hits) == 1:
                c = hits[0]
                sim_lbl = f"SIM{sims[0].slot+1} ({sims[0].isp})" if sims else "your SIM"
                return f"I'll call **{c['name']}** ({c['phone']}) on {sim_lbl}. Shall I proceed?\n[ACTION:MAKE_CALL:{c['phone']}:0]"
            opts = "\n".join(f"{i+1}. {c['name']} — {c['phone']}" for i, c in enumerate(hits[:5]))
            return f"I found {len(hits)} contacts matching **{name}**:\n\n{opts}\n\nWhich one should I call?"

        if re.search(r'\b(send|text|sms|message)\b', lower):
            if not perms.can_send_sms:
                return "I need permission to send SMS — enable \"Send SMS\" in **Settings → Hiah Permissions**."
            m = re.search(r'(?:send\s+(?:sms|text|message)\s+to|text|message)\s+(.+?):\s*(.+)', message, re.I)
            if m:
                name, body = m.group(1).strip(), m.group(2).strip()
                hits = [c for c in contacts if name.lower() in c.get("name","").lower() and not c.get("is_blocked")]
                if not hits:
                    return f"Can't find **{name}** in your saved contacts. Please add them first."
                if len(hits) == 1:
                    c = hits[0]
                    if c.get("is_spam"):
                        return f"⚠️ **{c['name']}** is flagged as spam. Send anyway? [ACTION:SEND_SMS:{c['phone']}:{body}:0]"
                    return f"Send \"{body}\" to **{c['name']}** ({c['phone']})?\n[ACTION:SEND_SMS:{c['phone']}:{body}:0]"
                opts = "\n".join(f"{i+1}. {c['name']} — {c['phone']}" for i, c in enumerate(hits[:5]))
                return f"Multiple contacts match **{name}**:\n\n{opts}\n\nWhich one?"
            return "Who should I text, and what's the message? (e.g. \"Text John: I'm on my way\")"

        if any(w in lower for w in ["sim", "sim card", "my sims"]):
            if not sims:
                return "No SIM cards detected. Install Reino on Android to auto-detect SIMs."
            info = "\n".join(
                f"• SIM{s.slot+1}: {s.isp or 'Unknown'}"
                + (f" — {s.phone_number}" if s.phone_number else "")
                + (" *(default)*" if s.is_default else "")
                for s in sims
            )
            return f"Your SIM cards:\n\n{info}"

        return (
            f"I'm here, {user_name}! 💜 Try:\n"
            "• \"Call [name]\"\n"
            "• \"Send SMS to [name]: [message]\"\n"
            "• \"Read my messages\"\n"
            "• \"Any missed calls?\"\n"
            "• \"Any spam calls?\"\n"
            "• \"My notifications\"\n"
            "• \"My SIMs\""
        )

    async def speech_to_text(self, audio_bytes: bytes) -> str:
        try:
            import speech_recognition as sr
            import io
            r = sr.Recognizer()
            with sr.AudioFile(io.BytesIO(audio_bytes)) as src:
                audio = r.record(src)
            return r.recognize_google(audio, language="en-KE")
        except Exception as e:
            logger.error(f"STT error: {e}")
            return ""

    async def text_to_speech(self, text: str, api_key: Optional[str] = None,
                              voice_id: Optional[str] = None) -> Optional[bytes]:
        key = api_key or settings.elevenlabs_api_key
        if not key:
            return None
        try:
            from elevenlabs.client import ElevenLabs
            vid = voice_id or settings.elevenlabs_voice_id
            el  = ElevenLabs(api_key=key)
            audio = await asyncio.to_thread(
                el.generate, text=text, voice=vid, model="eleven_multilingual_v2"
            )
            return b"".join(audio)
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None


def _parse_action(content: str, perms) -> Optional[dict]:
    m = re.search(r'\[ACTION:MAKE_CALL:([+\d\s\-]+):(\d+)\]', content)
    if m:
        if not perms.can_make_calls: return None
        return {"type": "make_call", "payload": {"phone": m.group(1).strip(), "sim_slot": int(m.group(2))},
                "requires_approval": perms.notify_on_action,
                "status": "pending" if perms.notify_on_action else "approved"}

    m = re.search(r'\[ACTION:SEND_SMS:([+\d\s\-]+):(.+?):(\d+)\]', content, re.DOTALL)
    if m:
        if not perms.can_send_sms: return None
        return {"type": "send_sms", "payload": {"phone": m.group(1).strip(), "body": m.group(2).strip(), "sim_slot": int(m.group(3))},
                "requires_approval": perms.notify_on_action,
                "status": "pending" if perms.notify_on_action else "approved"}

    if "[ACTION:READ_MESSAGES]" in content:
        return {"type": "read_messages", "payload": {}, "requires_approval": False, "status": "approved"}
    if "[ACTION:READ_CALLS]" in content:
        return {"type": "read_calls", "payload": {}, "requires_approval": False, "status": "approved"}
    if "[ACTION:READ_NOTIFICATIONS]" in content:
        return {"type": "read_notifications", "payload": {}, "requires_approval": False, "status": "approved"}

    m = re.search(r'\[ACTION:SEARCH_CONTACT:([^\]]+)\]', content)
    if m:
        return {"type": "search_contact", "payload": {"name": m.group(1).strip()}, "requires_approval": False, "status": "approved"}

    m = re.search(r'\[ACTION:FLAG_SPAM:([+\d\s\-]+)\]', content)
    if m:
        return {"type": "flag_spam", "payload": {"phone": m.group(1).strip()}, "requires_approval": False, "status": "approved"}

    return None


hiah_service = HiahService()
