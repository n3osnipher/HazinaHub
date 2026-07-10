import re
import csv
import io
from datetime import datetime
from typing import Optional, List, Dict, Any

# Regex patterns for M-Pesa SMS confirmation messages
RCV_PATTERN = re.compile(
    r"([A-Z0-9]{10})\s+Confirmed\.\s+You\s+have\s+received\s+Ksh([0-9,]+\.[0-9]{2})\s+from\s+([A-Z\s0-9_]+)\s+(\+?[0-9]{9,15})\s+on\s+(\d{1,2}/\d{1,2}/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",
    re.IGNORECASE
)

SEND_PATTERN = re.compile(
    r"([A-Z0-9]{10})\s+Confirmed\.\s+Ksh([0-9,]+\.[0-9]{2})\s+sent\s+to\s+([A-Z\s0-9_]+)\s+(\+?[0-9]{9,15})\s+on\s+(\d{1,2}/\d{1,2}/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",
    re.IGNORECASE
)

PAY_PATTERN = re.compile(
    r"([A-Z0-9]{10})\s+Confirmed\.\s+Ksh([0-9,]+\.[0-9]{2})\s+paid\s+to\s+([A-Z\s0-9_().&\'\-]+)\s+on\s+(\d{1,2}/\d{1,2}/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))",
    re.IGNORECASE
)


def parse_date_time(date_str: str, time_str: str) -> datetime:
    """Helper to convert date and time string to python datetime object."""
    try:
        # Standard format like 15/6/26 at 5:12 PM
        cleaned_time = re.sub(r"\s+", "", time_str).upper()
        # Parse year as 2 or 4 digits
        for fmt in ("%d/%m/%y %I:%M%p", "%d/%m/%Y %I:%M%p"):
            try:
                return datetime.strptime(f"{date_str} {cleaned_time}", fmt)
            except ValueError:
                continue
        return datetime.utcnow()
    except Exception:
        return datetime.utcnow()


def parse_mpesa_sms(sms_text: str) -> Optional[Dict[str, Any]]:
    """
    Parse a single M-Pesa SMS confirmation string.
    Returns a dict with cashflow properties if match is found, else None.
    """
    text = sms_text.strip().replace("\n", " ").replace("\r", " ")
    
    # 1. Received Money (Inflow)
    match = RCV_PATTERN.search(text)
    if match:
        receipt, amount_str, sender, phone, d_str, t_str = match.groups()
        amount = float(amount_str.replace(",", ""))
        dt = parse_date_time(d_str, t_str)
        return {
            "receipt_number": receipt,
            "type": "inflow",
            "amount": amount,
            "phone": phone,
            "description": f"Received from {sender.strip()}",
            "category": "income",
            "created_at": dt,
        }

    # 2. Sent Money (Outflow)
    match = SEND_PATTERN.search(text)
    if match:
        receipt, amount_str, recipient, phone, d_str, t_str = match.groups()
        amount = float(amount_str.replace(",", ""))
        dt = parse_date_time(d_str, t_str)
        return {
            "receipt_number": receipt,
            "type": "outflow",
            "amount": amount,
            "phone": phone,
            "description": f"Sent to {recipient.strip()}",
            "category": "other",
            "created_at": dt,
        }

    # 3. Paid Till / Paybill (Outflow)
    match = PAY_PATTERN.search(text)
    if match:
        receipt, amount_str, merchant, d_str, t_str = match.groups()
        amount = float(amount_str.replace(",", ""))
        dt = parse_date_time(d_str, t_str)
        
        # Categorize merchant
        desc = merchant.strip()
        category = "other"
        desc_lower = desc.lower()
        if "power" in desc_lower or "token" in desc_lower or "water" in desc_lower or "kplc" in desc_lower:
            category = "bills"
        elif "food" in desc_lower or "restaurant" in desc_lower or "supermarket" in desc_lower or "grocer" in desc_lower:
            category = "food"
        elif "safaricom" in desc_lower or "airtime" in desc_lower:
            category = "airtime"
        elif "uber" in desc_lower or "bolt" in desc_lower or "fuel" in desc_lower or "shell" in desc_lower or "matatu" in desc_lower:
            category = "transport"

        return {
            "receipt_number": receipt,
            "type": "outflow",
            "amount": amount,
            "phone": "",
            "description": f"Paid to {desc}",
            "category": category,
            "created_at": dt,
        }

    return None


def parse_mpesa_csv(csv_content: str) -> List[Dict[str, Any]]:
    """
    Parse Safaricom M-Pesa CSV Statement file content.
    Expects headers containing: Receipt No, Completion Time, Details, Paid In, Withdrawn, etc.
    """
    results: List[Dict[str, Any]] = []
    
    # Use io.StringIO to parse csv text
    f = io.StringIO(csv_content.strip())
    reader = csv.reader(f)
    
    # Read rows to locate header row
    rows = list(reader)
    if not rows:
        return []

    header_idx = -1
    for i, row in enumerate(rows):
        # M-Pesa statement header keywords
        row_joined = " ".join(row).lower()
        if "receipt no" in row_joined and ("details" in row_joined or "transaction details" in row_joined):
            header_idx = i
            break
            
    if header_idx == -1:
        # Fallback to first row if header not detected
        header_row = [col.strip().lower() for col in rows[0]]
        data_rows = rows[1:]
    else:
        header_row = [col.strip().lower() for col in rows[header_idx]]
        data_rows = rows[header_idx + 1:]

    # Map headers to indices
    receipt_idx = -1
    time_idx = -1
    details_idx = -1
    paid_in_idx = -1
    withdrawn_idx = -1
    
    for idx, col in enumerate(header_row):
        if "receipt no" in col or "receipt_no" in col or "txid" in col:
            receipt_idx = idx
        elif "completion time" in col or "time" in col or "date" in col:
            time_idx = idx
        elif "details" in col or "description" in col:
            details_idx = idx
        elif "paid in" in col or "received" in col or "credit" in col:
            paid_in_idx = idx
        elif "withdrawn" in col or "sent" in col or "debit" in col:
            withdrawn_idx = idx

    if receipt_idx == -1 or time_idx == -1 or details_idx == -1:
        return []

    for row in data_rows:
        if len(row) <= max(receipt_idx, time_idx, details_idx):
            continue
            
        receipt = row[receipt_idx].strip()
        # Skip empty receipt rows (totals, summaries)
        if not receipt or len(receipt) < 8:
            continue

        details = row[details_idx].strip()
        time_str = row[time_idx].strip()
        
        # Parse amount
        amount = 0.0
        tx_type = "outflow"
        
        # Check credit/debit columns
        paid_in = 0.0
        if paid_in_idx != -1 and len(row) > paid_in_idx:
            try:
                paid_in = float(row[paid_in_idx].strip().replace(",", "") or 0)
            except ValueError:
                pass
                
        withdrawn = 0.0
        if withdrawn_idx != -1 and len(row) > withdrawn_idx:
            try:
                withdrawn = float(row[withdrawn_idx].strip().replace(",", "") or 0)
            except ValueError:
                pass

        if paid_in > 0:
            amount = paid_in
            tx_type = "inflow"
        elif withdrawn > 0:
            amount = withdrawn
            tx_type = "outflow"
        else:
            continue

        # Parse date time
        try:
            # Multi format parser for statement dates
            dt = datetime.utcnow()
            for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S", "%d-%b-%Y %H:%M:%S"):
                try:
                    dt = datetime.strptime(time_str, fmt)
                    break
                except ValueError:
                    continue
        except Exception:
            dt = datetime.utcnow()

        # Categorize based on details description
        category = "income" if tx_type == "inflow" else "other"
        details_lower = details.lower()
        if tx_type == "outflow":
            if "bill" in details_lower or "paybill" in details_lower or "kplc" in details_lower or "tokens" in details_lower:
                category = "bills"
            elif "food" in details_lower or "kfc" in details_lower or "cafe" in details_lower or "supermarket" in details_lower:
                category = "food"
            elif "airtime" in details_lower or "data" in details_lower or "bundle" in details_lower:
                category = "airtime"
            elif "uber" in details_lower or "cab" in details_lower or "petrol" in details_lower or "fuel" in details_lower:
                category = "transport"

        results.append({
            "receipt_number": receipt,
            "type": tx_type,
            "amount": amount,
            "phone": "",
            "description": details,
            "category": category,
            "created_at": dt,
        })

    return results


def segment_text_chunks(raw_text: str) -> List[str]:
    """
    Splits a raw block of text into distinct transaction message blocks.
    Recombines wrapped lines for single transactions while separating different ones.
    """
    # Normalize line breaks
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    
    # Check if there are M-Pesa transaction codes in the text
    tx_start_pattern = re.compile(r"^[A-Z0-9]{10}\b", re.IGNORECASE)
    has_tx_codes = any(tx_start_pattern.match(line.strip()) for line in text.split("\n"))
    
    if not has_tx_codes:
        # Fallback: Split by blank lines or treat each line as a segment if no code detected
        parts = [p.strip() for p in text.split("\n") if p.strip()]
        return parts

    # Group lines by transaction code boundaries
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    segments = []
    current_segment = []

    for line in lines:
        if tx_start_pattern.match(line):
            if current_segment:
                segments.append(" ".join(current_segment))
                current_segment = []
        current_segment.append(line)

    if current_segment:
        segments.append(" ".join(current_segment))

    return segments


def is_transaction_segment(segment: str) -> bool:
    """
    Checks if a segment contains transaction indicators and filters out noise.
    """
    cleaned = segment.strip().lower()
    if len(cleaned) < 15:
        return False
        
    # Exclude typical promotional messages/summaries
    noise_keywords = [
        "lipa na m-pesa promotion",
        "dial *334#",
        "do you want a loan",
        "pay with airtel money to get",
        "dear customer",
    ]
    
    if any(k in cleaned for k in noise_keywords):
        return False
        
    # If it starts with a transaction code, it is valid!
    if re.match(r"^[a-z0-9]{10}\b", cleaned):
        return True
        
    # Check if there are cashflow indicators
    has_money = "ksh" in cleaned or "sh" in cleaned or "shs" in cleaned or "amount" in cleaned or "$" in cleaned
    has_action = any(w in cleaned for w in ["received", "sent", "paid", "withdraw", "deposit", "transfer", "credited", "debited", "paybill"])
    
    # Exclude balance-only checks
    is_balance_only = "balance" in cleaned and not has_action
    
    if is_balance_only:
        return False
        
    return has_money and has_action

