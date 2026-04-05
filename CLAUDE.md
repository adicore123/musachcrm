# CRM למוסכניקים — מסמך הקשר לסוכן

## מה הפרויקט
CRM מותאם אישית למוסכים בישראל.
מטרה: לחסוך זמן, להכניס כסף, ולשפר שירות ללקוח.
גרסה נוכחית: MVP.

## הבעיה שאנחנו פותרים
מוסכניקים מנהלים לקוחות, רכבים, תורים ועבודות בנייר, בוואטסאפ, או בזיכרון.
ה-CRM מרכז הכל במקום אחד — לידים, לקוחות, רכבים, תורים, הצעות מחיר.

## סטאק טכני
- **Backend:** Python + FastAPI
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (bucket: `crm-images`)
- **API docs:** אוטומטי בכתובת `/docs`

## חיבור Supabase
- **Project ID:** `ayiynowkmaayavopwhnb`
- **URL:** `https://ayiynowkmaayavopwhnb.supabase.co`
- **Anon Key:** בקובץ `.env` כ-`SUPABASE_KEY`
- **Region:** eu-west-3 (פריז)

קובץ `.env`:
```
SUPABASE_URL=https://ayiynowkmaayavopwhnb.supabase.co
SUPABASE_KEY=<מה שבקובץ .env>
```

## מבנה קבצים
```
/
├── main.py              # כל ה-routes של FastAPI
├── database.py          # חיבור לסופהבייס (db = create_client(...))
├── supabase/
│   └── repairs_schema.sql  # הרחבת טבלת repairs — להריץ ב-SQL Editor
├── static/index.html    # ממשק (לקוחות + תיקונים)
├── .env                 # מפתחות — לא מעלים ל-git
└── CLAUDE.md            # המסמך הזה
```

## איך עובד החיבור לדאטהבייס
```python
# database.py
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
```

בכל route משתמשים ב-`db` ישירות:
```python
from database import db
db.table("leads").select("*").execute().data
```

## Storage — העלאת תמונות
Bucket פתוח בשם `crm-images`.
העלאה דרך `/upload` (POST), מחזיר URL ציבורי.
מחיקה דרך `/upload/{filename}` (DELETE).

## ניהול סכמת הדאטהבייס
**אין Supabase CLI בפרויקט זה.**
כל שינוי בסכמה (טבלה חדשה, עמודה חדשה) מתבצע ידנית דרך Claude.ai:
- פותחים Claude.ai
- מבקשים "פתח לי טבלת X עם עמודות Y, Z"
- Claude מריץ את ה-migration על הפרויקט ישירות
- חוזרים ל-VSCode וממשיכים לכתוב קוד

**לא לכתוב CREATE TABLE ידנית ב-VSCode — תמיד דרך Claude.ai.**

## טבלאות קיימות
- `test` — טבלת בדיקה זמנית (למחיקה בהמשך)
- `leads` — לידים (full_name, email, phone, company, source, status, notes)
- `deals` — עסקאות (title, lead_id→leads, value, stage, notes)
- `customers` — לקוחות (full_name, phone, email, id_number, address, notes, license_plate)
- `repairs` — תיקונים במוסך (`customer_id`→customers, לוחית ושדות רכב מצילום משרד התחבורה, `description`, `status`, `notes`). סקריפט הרחבת סכמה: `supabase/repairs_schema.sql` (להתאים את טיפוס `customer_id` ל-`customers.id`: uuid או bigint).

## מודול תיקונים (UI)
- בממשק: תפריט **תיקונים** (במקום רכבים), טבלה + מודל תיקון חדש.
- בחירת לקוח מהרשימה; כפתור **לקוח חדש** פותח את מודל הלקוח הקיים ואחרי שמירה חוזרים לתיקון עם הלקוח שנבחר.
- אם ללקוח יש `license_plate`, פרטי הרכב נטענים אוטומטית מ-`GET /vehicle/{plate}`.

## הנחיות לסוכן
- כל הקוד בעברית בתגובות ובהערות — הפרויקט ישראלי
- MVP — לא מסרבלים, שומרים על קוד רזה ופשוט
- כל route ב-`main.py` — לא מפצלים לקבצים עד שיש צורך אמיתי
- `db` מיובא מ-`database.py` — לא יוצרים client חדש בכל קובץ
- בדיקת endpoints דרך `/docs` (Swagger אוטומטי)
