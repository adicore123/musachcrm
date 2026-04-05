"""
greenapi.py — כל הלוגיקה של Green API (WhatsApp)
"""
import os
import requests
from datetime import datetime
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

INSTANCE = os.getenv("GREEN_API_INSTANCE", "")
TOKEN    = os.getenv("GREEN_API_TOKEN", "")


def _normalize_phone(phone: str) -> str:
    """ממיר מספר ישראלי לפורמט בינלאומי ל-WhatsApp"""
    clean = phone.replace("-", "").replace(" ", "").replace("+", "")
    if clean.startswith("0"):
        clean = "972" + clean[1:]
    return clean


def send_message(phone: str, message: str) -> dict:
    """שולח הודעת טקסט דרך Green API"""
    if not INSTANCE or not TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Green API לא מוגדר — הוסיפו GREEN_API_INSTANCE ו-GREEN_API_TOKEN ל-.env",
        )
    chat_id = f"{_normalize_phone(phone)}@c.us"
    url = f"https://api.green-api.com/waInstance{INSTANCE}/sendMessage/{TOKEN}"
    try:
        resp = requests.post(url, json={"chatId": chat_id, "message": message}, timeout=15)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"שגיאת חיבור ל-Green API: {e}")
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"Green API שגיאה: {resp.text[:300]}")
    return resp.json()


def build_reminder_message(name: str, appointment_time: str, service: str) -> str:
    """בונה הודעת תזכורת לתור בעברית"""
    try:
        dt = datetime.fromisoformat(appointment_time.replace("Z", "+00:00"))
        date_str = dt.strftime("%d/%m/%Y")
        time_str = dt.strftime("%H:%M")
    except Exception:
        date_str = appointment_time
        time_str = ""

    return (
        f"שלום {name}! 👋\n"
        f"תזכורת לתור שלך במוסך:\n"
        f"📅 {date_str} בשעה {time_str}\n"
        f"🔧 {service}\n"
        f"נשמח לראותך! לביטול או שינוי — פנה אלינו."
    )


def send_appointment_reminder(apt: dict) -> dict:
    """מקבל רשומת תור (עם customers embed) ושולח תזכורת וואטסאפ"""
    customer = apt.get("customers") or {}
    phone = customer.get("phone", "")
    if not phone:
        raise HTTPException(status_code=400, detail="ללקוח אין מספר טלפון")
    name    = customer.get("full_name", "לקוח יקר")
    service = apt.get("service_type") or "טיפול ברכב"
    message = build_reminder_message(name, apt.get("appointment_time", ""), service)
    return send_message(phone, message)
