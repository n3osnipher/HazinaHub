import os
import asyncio
import hashlib
import time
import re
import socket
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load env variables
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "hazinahub")

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

# Mapping of providers to representative domains for Hunter.io logo API
PROVIDER_DOMAINS = {
    "Sanlam Investments": "sanlam.com",
    "CIC Asset Management": "cic.co.ke",
    "Zimele Asset Management": "zimele.co.ke", # Special cased below
    "GenAfrica Asset Management": "genafrica.com",
    "NCBA Investment Bank": "ncbagroup.com",
    "ICEA Lion Asset Management": "icealion.com",
    "Co-op Trust Investment Services": "co-opbank.co.ke",
    "Stima SACCO": "stima-sacco.com",
    "Kenya Police SACCO": "policesacco.com",
    "Harambee SACCO": "harambeesacco.com",
    "Safaricom Co-op": "sic.co.ke",
    "CBK DhowCSD Portal": "centralbank.go.ke",
    "Safaricom PLC": "safaricom.co.ke",
    "Equity Bank Group": "equitygroupholdings.com",
    "KCB Group": "kcbgroup.com",
    "Co-op Bank Group": "co-opbank.co.ke",
    "East African Breweries": "eabl.com"
}

def resolve_dns(hostname, dns_server="8.8.8.8"):
    """Queries public DNS (8.8.8.8) directly over UDP port 53 to bypass local DNS resolution failures."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(5.0)
    
    packet = bytearray()
    packet.extend(b"\xaa\xbb") # Transaction ID
    packet.extend(b"\x01\x00") # Flags (Standard Query, Recursion Desired)
    packet.extend(b"\x00\x01") # Questions = 1
    packet.extend(b"\x00\x00") # Answer RRs = 0
    packet.extend(b"\x00\x00") # Authority RRs = 0
    packet.extend(b"\x00\x00") # Additional RRs = 0
    
    for part in hostname.split('.'):
        packet.append(len(part))
        packet.extend(part.encode('utf-8'))
    packet.append(0) # Null terminator
    
    packet.extend(b"\x00\x01") # Type = A
    packet.extend(b"\x00\x01") # Class = IN
    
    try:
        sock.sendto(packet, (dns_server, 53))
        data, _ = sock.recvfrom(1024)
        
        num_answers = int.from_bytes(data[6:8], byteorder='big')
        if num_answers == 0:
            return None
            
        name_len = len(packet) - 12
        curr = 12 + name_len
        
        for _ in range(num_answers):
            if curr >= len(data):
                break
            if data[curr] & 0xc0 == 0xc0:
                curr += 2
            else:
                while data[curr] != 0:
                    curr += 1
                curr += 1
            
            type_val = int.from_bytes(data[curr:curr+2], byteorder='big')
            class_val = int.from_bytes(data[curr+2:curr+4], byteorder='big')
            ttl = int.from_bytes(data[curr+4:curr+8], byteorder='big')
            rdlength = int.from_bytes(data[curr+8:curr+10], byteorder='big')
            
            curr += 10
            if type_val == 1 and class_val == 1 and rdlength == 4:
                return ".".join(str(b) for b in data[curr:curr+4])
            curr += rdlength
    except Exception as e:
        print(f"[DNS Helper] DNS query error for {hostname}: {e}")
    finally:
        sock.close()
    return None

original_getaddrinfo = socket.getaddrinfo

def custom_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    """Intercepts and resolves target domains using public DNS directly."""
    host_str = host.decode("utf-8") if isinstance(host, bytes) else host
    
    if host_str:
        intercept_hosts = [
            "logos.hunter.io",
            "api.cloudinary.com",
            "upload.wikimedia.org"
        ]
        should_intercept = host_str in intercept_hosts or \
                           host_str.endswith(".hunter.io") or \
                           host_str.endswith(".cloudinary.com") or \
                           host_str.endswith(".wikimedia.org")
                           
        if should_intercept:
            ip = resolve_dns(host_str, "8.8.8.8")
            if ip:
                print(f"[DNS Patch] Intercepted and resolved {host_str} -> {ip}")
                return original_getaddrinfo(ip, port, family, type, proto, flags)
                
    return original_getaddrinfo(host, port, family, type, proto, flags)

# Apply Socket DNS patch
socket.getaddrinfo = custom_getaddrinfo

def sanitize_slug(text: str) -> str:
    """Creates a clean filename/public_id from provider name."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')

def generate_signature(params: dict, api_secret: str) -> str:
    """Generates Cloudinary signature."""
    sorted_params = sorted(params.items())
    param_str = "&".join(f"{k}={v}" for k, v in sorted_params)
    to_hash = param_str + api_secret
    return hashlib.sha1(to_hash.encode('utf-8')).hexdigest()

async def upload_logo_to_cloudinary(provider: str, logo_bytes: bytes) -> str:
    """Uploads logo bytes to Cloudinary and returns the secure URL."""
    if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
        print("[ERROR] Cloudinary credentials not fully configured.")
        return ""
        
    timestamp = str(int(time.time()))
    slug = sanitize_slug(provider)
    public_id = f"logo_{slug}"
    folder = "hazinahub/logos"
    
    # Parameters to sign
    params = {
        "folder": folder,
        "public_id": public_id,
        "timestamp": timestamp
    }
    
    signature = generate_signature(params, CLOUDINARY_API_SECRET)
    
    url = f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/image/upload"
    data = {
        "api_key": CLOUDINARY_API_KEY,
        "timestamp": timestamp,
        "folder": folder,
        "public_id": public_id,
        "signature": signature
    }
    files = {
        "file": (f"{public_id}.png", logo_bytes, "image/png")
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, data=data, files=files, timeout=30.0)
            if response.status_code == 200:
                result = response.json()
                secure_url = result.get("secure_url")
                print(f"[OK] Uploaded {provider} logo to Cloudinary: {secure_url}")
                return secure_url
            else:
                print(f"[ERROR] Cloudinary upload failed for {provider}: status={response.status_code}, response={response.text}")
                return ""
        except Exception as e:
            print(f"[ERROR] Cloudinary upload request failed for {provider}: {e}")
            return ""

async def migrate_logos():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    collection = db["mmf_funds"]
    
    # Get all funds
    funds = await collection.find({}).to_list(length=100)
    print(f"Found {len(funds)} funds in database.")
    
    async with httpx.AsyncClient() as client_http:
        uploaded_logos = {} # cache by provider
        
        for fund in funds:
            fund_id = fund["_id"]
            provider = fund.get("provider")
            name = fund.get("name")
            current_logo = fund.get("logo_url", "")
            
            if not provider:
                continue
                
            # Force re-download and re-upload to Cloudinary to ensure they exist and have valid URLs
            if False:
                print(f"[CACHE] Fund '{name}' already has Cloudinary logo: {current_logo}")
                uploaded_logos[provider] = current_logo
                continue
                
            # Check cache first
            if provider in uploaded_logos:
                cloudinary_url = uploaded_logos[provider]
                if cloudinary_url:
                    await collection.update_one({"_id": fund_id}, {"$set": {"logo_url": cloudinary_url}})
                    print(f"[DB] Updated fund '{name}' with cached logo: {cloudinary_url}")
                continue
                
            # Custom download logic for Zimele (special case)
            if provider == "Zimele Asset Management":
                download_url = "https://upload.wikimedia.org/wikipedia/commons/a/a7/Zimele_logo.jpg"
                headers = {"User-Agent": "HazinaHubLogoMigration/1.0 (contact: servicesreino@gmail.com) httpx/0.27.0"}
            else:
                domain = PROVIDER_DOMAINS.get(provider)
                if not domain:
                    print(f"[WARN] No domain mapping found for provider: {provider}")
                    continue
                download_url = f"https://logos.hunter.io/{domain}"
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                
            print(f"Downloading logo for '{provider}' from {download_url}...")
            
            try:
                resp = await client_http.get(download_url, headers=headers, timeout=15.0)
                
                if resp.status_code == 200 and len(resp.content) > 100:
                    cloudinary_url = await upload_logo_to_cloudinary(provider, resp.content)
                    uploaded_logos[provider] = cloudinary_url
                    
                    if cloudinary_url:
                        await collection.update_one({"_id": fund_id}, {"$set": {"logo_url": cloudinary_url}})
                        print(f"[DB] Updated fund '{name}' with logo: {cloudinary_url}")
                    else:
                        print(f"[ERROR] Could not upload logo for {provider} to Cloudinary.")
                else:
                    print(f"[ERROR] Failed to download logo for {provider} from {download_url} (status={resp.status_code})")
                    uploaded_logos[provider] = ""
            except Exception as e:
                print(f"[ERROR] Exception downloading logo for {provider}: {e}")
                uploaded_logos[provider] = ""
                
    print("Migration finished!")

if __name__ == "__main__":
    asyncio.run(migrate_logos())
