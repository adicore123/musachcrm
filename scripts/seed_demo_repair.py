"""
יוצר תיקון דוגמה ב-Supabase.
אם אין לקוחות — יוצר לקוח דוגמה עם לוחית, ואז תיקון.

הרצה מתיקיית הפרויקט:
  .\\.venv\\Scripts\\python.exe scripts\\seed_demo_repair.py
"""
from __future__ import annotations

import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from database import db  # noqa: E402

try:
    from postgrest.exceptions import APIError
except ImportError:
    APIError = Exception  # type: ignore[misc,assignment]


def main() -> None:
    customers = (
        db.table("customers").select("id, full_name, license_plate").limit(10).execute().data
    )

    if not customers:
        row = (
            db.table("customers")
            .insert(
                {
                    "full_name": "לקוח דוגמה למוסך",
                    "phone": "050-0000000",
                    "license_plate": "12-345-67",
                }
            )
            .execute()
            .data
        )
        if not row:
            print("שגיאה: לא ניתן ליצור לקוח דוגמה")
            sys.exit(1)
        c = row[0]
        print("נוצר לקוח דוגמה:", c.get("id"), c.get("full_name"))
    else:
        c = customers[0]
        print("משתמש בלקוח קיים:", c.get("id"), c.get("full_name"))

    cid = c["id"]
    plate = (c.get("license_plate") or "12-345-67").strip()

    payload = {
        "customer_id": str(cid),
        "license_plate": plate,
        "vehicle_manufacturer": "טויוטה",
        "vehicle_model": "קורולה",
        "vehicle_year": "2019",
        "vehicle_color": "כסף מתכתי",
        "test_validity": None,
        "description": "תיקון דוגמה: החלפת שמן ומסנן, בדיקת רמות נוזלים — להדגמת מערכת התיקונים",
        "status": "in_progress",
        "notes": "נוצר אוטומטית ע\"י scripts/seed_demo_repair.py",
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        rep = db.table("repairs").insert(payload).execute().data
    except APIError as e:
        msg = getattr(e, "message", str(e))
        if "customer_id" in str(msg) or "schema cache" in str(msg).lower():
            print(
                "חסרות עמודות בטבלת repairs. הרץ ב-Supabase -> SQL Editor את הקובץ:\n"
                "  supabase/repairs_schema.sql\n"
                "ואז הרץ שוב את הסקריפט."
            )
        else:
            print("שגיאת Supabase:", msg)
        sys.exit(1)

    if not rep:
        print("שגיאה: לא ניתן ליצור תיקון")
        sys.exit(1)

    r = rep[0]
    print("נוצר תיקון דוגמה מספר", r.get("id"), "| סטטוס:", r.get("status"))
    print("פתחו בממשק: תפריט תיקונים — אמור להופיע בשורה הראשונה.")


if __name__ == "__main__":
    main()
