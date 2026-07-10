import os
import urllib.parse
import base64
import httpx
import asyncio
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from fastapi.responses import HTMLResponse
from beanie import PydanticObjectId

from app.models.user import User
from app.models.cashflow import Cashflow
from app.middleware.auth import get_current_user
from app.services.mpesa_parser import parse_mpesa_sms
from app.services.websocket import broadcast_cashflow_update
from app.services.ai import parse_unstructured_transaction_ai

router = APIRouter(prefix="/api/gmail", tags=["gmail"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
# Redirect URL from front-end to trigger backend callback
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/gmail/callback")

GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def decode_gmail_body(payload: dict) -> str:
    """Recursively traverse email mime parts and decode base64 bodies."""
    body = ""
    if "parts" in payload:
        for part in payload["parts"]:
            body += decode_gmail_body(part)
    elif "body" in payload and payload["body"].get("data"):
        data = payload["body"]["data"]
        # base64url decode
        padding = "=" * (4 - len(data) % 4)
        try:
            decoded = base64.urlsafe_b64decode(data + padding).decode("utf-8", errors="ignore")
            body += decoded
        except Exception:
            pass
    return body


async def refresh_gmail_token(user: User) -> str:
    """Refresh Google access token using the stored refresh token."""
    if not user.gmail_refresh_token:
        raise HTTPException(status_code=400, detail="Gmail Sync is not connected.")

    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": user.gmail_refresh_token,
        "grant_type": "refresh_token",
    }
    
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://oauth2.googleapis.com/token", data=payload)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Google authentication expired. Please reconnect.")
        
        data = response.json()
        access_token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        
        user.gmail_access_token = access_token
        user.gmail_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        await user.save()
        return access_token


@router.get("/auth-url")
async def get_auth_url(current_user: dict = Depends(get_current_user)):
    """Generate the Google OAuth authorization URL for the client."""
    if not GOOGLE_CLIENT_ID:
        return {
            "success": False,
            "error": "Google integration is not configured on this server.",
        }

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GMAIL_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": current_user["userId"], # Pass user ID in state parameter
    }
    encoded = urllib.parse.urlencode(params)
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{encoded}"
    return {"success": True, "authUrl": url}


@router.get("/callback")
async def oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    """Google OAuth redirect endpoint. Exchanges authorization code for tokens."""
    if error:
        return HTMLResponse(
            f"<html><body><h3>Authentication error: {error}</h3><script>setTimeout(window.close, 3000)</script></body></html>"
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Invalid callback request parameters")

    # Exchange code for tokens
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post("https://oauth2.googleapis.com/token", data=payload)
        if token_resp.status_code != 200:
            return HTMLResponse(
                "<html><body><h3>Failed to retrieve tokens from Google</h3><script>setTimeout(window.close, 3000)</script></body></html>"
            )
        
        token_data = token_resp.json()
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        # Retrieve Google profile email
        headers = {"Authorization": f"Bearer {access_token}"}
        profile_resp = await client.get("https://gmail.googleapis.com/gmail/v1/users/me/profile", headers=headers)
        if profile_resp.status_code != 200:
            return HTMLResponse(
                "<html><body><h3>Failed to load Google profile</h3><script>setTimeout(window.close, 3000)</script></body></html>"
            )
        
        profile_data = profile_resp.json()
        gmail_email = profile_data.get("emailAddress")

        # Save credentials to User
        user_id = PydanticObjectId(state)
        user = await User.get(user_id)
        if not user:
            return HTMLResponse(
                "<html><body><h3>User account not found</h3><script>setTimeout(window.close, 3000)</script></body></html>"
            )
        
        user.gmail_access_token = access_token
        if refresh_token:
            user.gmail_refresh_token = refresh_token
        user.gmail_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        user.gmail_email = gmail_email
        await user.save()

    # Success landing script to notify opener window and close popup
    return HTMLResponse(
        """
        <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
            <h2>Google Account Connected!</h2>
            <p>Your Gmail integration has been linked to Hazina Hub successfully.</p>
            <p>This window will close automatically...</p>
            <script>
                if (window.opener) {
                    window.opener.postMessage({ type: 'GMAIL_CONNECTED', email: '""" + gmail_email + """' }, '*');
                }
                setTimeout(window.close, 2000);
            </script>
        </body>
        </html>
        """
    )


@router.get("/status")
async def get_connection_status(current_user: dict = Depends(get_current_user)):
    """Get the current Gmail OAuth connection status for the user."""
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "success": True,
        "connected": user.gmail_refresh_token is not None,
        "email": user.gmail_email,
    }


@router.post("/sync")
async def sync_emails(current_user: dict = Depends(get_current_user)):
    """Trigger background check of user's Gmail box, parsing new M-Pesa receipts."""
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    if not user or not user.gmail_refresh_token:
        raise HTTPException(status_code=400, detail="Gmail Sync is not connected.")

    # Check and refresh tokens
    access_token = user.gmail_access_token
    if not user.gmail_token_expires_at or user.gmail_token_expires_at <= datetime.utcnow() + timedelta(minutes=5):
        access_token = await refresh_gmail_token(user)

    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=15) as client:
        # Search messages in Gmail containing "M-PESA Confirmed" or "M-PESA"
        # Search query: "M-PESA" subject
        q = 'subject:("M-PESA Confirmed" OR "M-PESA")'
        url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages?q={urllib.parse.quote(q)}&maxResults=20"
        
        msg_list_resp = await client.get(url, headers=headers)
        if msg_list_resp.status_code != 200:
            # If invalid credentials, prompt reconnection
            if msg_list_resp.status_code in (401, 403):
                # Try refreshing once more or raise disconnect
                try:
                    access_token = await refresh_gmail_token(user)
                    headers = {"Authorization": f"Bearer {access_token}"}
                    msg_list_resp = await client.get(url, headers=headers)
                except Exception:
                    pass
            if msg_list_resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to query Gmail messages.")

        messages_data = msg_list_resp.json()
        messages = messages_data.get("messages", [])

        if not messages:
            return {"success": True, "syncedCount": 0, "message": "No M-Pesa emails found."}

        synced_count = 0
        new_cashflows = []
        ai_calls_count = 0

        for msg in messages:
            msg_id = msg["id"]
            
            # Retrieve message details
            detail_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full"
            detail_resp = await client.get(detail_url, headers=headers)
            if detail_resp.status_code != 200:
                continue

            detail_data = detail_resp.json()
            snippet = detail_data.get("snippet", "")
            payload = detail_data.get("payload", {})
            
            # Parse from snippet first or traverse HTML body
            parsed = parse_mpesa_sms(snippet)
            if not parsed:
                # Retrieve email HTML/text body and parse
                email_body = decode_gmail_body(payload)
                if email_body:
                    parsed = parse_mpesa_sms(email_body)
                else:
                    email_body = ""

                # If still not parsed, run the AI fallback parser on the snippet or email body
                if not parsed and ai_calls_count < 5:
                    ai_calls_count += 1
                    try:
                        ai_parsed = await parse_unstructured_transaction_ai(email_body or snippet)
                        if ai_parsed:
                            parsed = ai_parsed
                    except Exception as e:
                        print(f"[Gmail Sync] AI fallback error: {e}")

            if parsed:
                # Check if this receipt already exists
                existing = await Cashflow.find_one(
                    Cashflow.receipt_number == parsed["receipt_number"],
                    Cashflow.user_id == user_id,
                )
                if not existing:
                    # Create cashflow log
                    tx = Cashflow(
                        user_id=user_id,
                        type=parsed["type"],
                        amount=parsed["amount"],
                        phone=parsed["phone"] or user.phone,
                        status="completed",
                        description=parsed["description"],
                        category=parsed["category"],
                        receipt_number=parsed["receipt_number"],
                        reference=f"GML-{parsed['receipt_number']}",
                        created_at=parsed["created_at"],
                    )
                    await tx.insert()
                    new_cashflows.append(tx)
                    synced_count += 1

        if synced_count > 0:
            # Broadcast updates via socket
            asyncio.create_task(broadcast_cashflow_update(str(user_id), {
                "sync": True, "count": synced_count
            }))

        return {
            "success": True,
            "syncedCount": synced_count,
            "message": f"Successfully synced {synced_count} cashflow logs from Gmail.",
        }


@router.delete("/disconnect")
async def disconnect_gmail(current_user: dict = Depends(get_current_user)):
    """Disconnect Google OAuth integration by clearing User fields."""
    user_id = PydanticObjectId(current_user["userId"])
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.gmail_access_token = None
    user.gmail_refresh_token = None
    user.gmail_token_expires_at = None
    user.gmail_email = None
    await user.save()

    return {"success": True, "message": "Gmail integration disconnected successfully."}
