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
- **Frontend:** Jinja2 templates + TailwindCSS + Vanilla JS
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
GREEN_API_INSTANCE=<אם יש>
GREEN_API_TOKEN=<אם יש>
```

## מבנה קבצים
```
/
├── main.py                    # FastAPI app + routers (entry point)
├── database.py                # חיבור לסופהבייס (db = create_client(...))
├── greenapi.py               # שליחת WhatsApp דרך Green API
├── routes/                    # כל ה-routes מחולקים לפי מודול
│   ├── __init__.py           # איחוד כל ה-routers
│   ├── customers.py           # CRUD לקוחות
│   ├── repairs.py            # CRUD תיקונים
│   ├── appointments.py        # CRUD תורים + תזכורות WhatsApp
│   ├── vehicles.py            # שליפת נתוני רכב ממשרד התחבורה
│   └── uploads.py            # העלאת/מחיקת תמונות
├── templates/                 # Jinja2 templates
│   ├── base.html              # שלד: head, sidebar, מודלים, JS
│   ├── customers.html          # view לקוחות
│   ├── repairs.html           # view תיקונים
│   ├── appointments.html       # view תורים
│   └── vehicle_check.html     # view בדיקת רכב
├── static/                    # קבצים סטטיים
│   ├── css/
│   │   └── styles.css        # כל ה-CSS המותאם
│   └── js/                   # JavaScript מחולק לפי מודול
│       ├── main.js           # פונקציות משותפות + navigation
│       ├── customers.js       # לוגיקת לקוחות
│       ├── repairs.js         # לוגיקת תיקונים
│       ├── appointments.js     # לוגיקת תורים
│       └── vehicle_check.js   # לוגיקת בדיקת רכב
├── supabase/
│   └── repairs_schema.sql     # הרחבת טבלת repairs
├── .env                      # מפתחות — לא מעלים ל-git
├── requirements.txt           # dependencies
├── render.yaml               # הגדרות deploy ל-Render
└── CLAUDE.md                # המסמך הזה
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
db.table("customers").select("*").execute().data
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
- `customers` — לקוחות (full_name, phone, email, id_number, address, notes, license_plate)
- `repairs` — תיקונים במוסך (`customer_id`→customers, לוחית ושדות רכב מצילום משרד התחבורה, `description`, `status`, `notes`)
- `appointments` — תורים (`customer_id`→customers, `appointment_time`, `service_type`, `status`, `notes`)
- `leads` — לידים (full_name, email, phone, company, source, status, notes)
- `deals` — עסקאות (title, lead_id→leads, value, stage, notes)
- `test` — טבלת בדיקה זמנית (למחיקה בהמשך)

## API Endpoints

### לקוחות (`/customers`)
- `GET /customers` — רשימת כל הלקוחות
- `POST /customers` — יצירת לקוח חדש
- `GET /customers/{id}` — קבלת לקוח ספציפי
- `PATCH /customers/{id}` — עדכון לקוח
- `DELETE /customers/{id}` — מחיקת לקוח

### תיקונים (`/repairs`)
- `GET /repairs` / `GET /api/repairs` — רשימת תיקונים
- `POST /repairs` / `POST /api/repairs` — יצירת תיקון
- `GET /repairs/{id}` / `GET /api/repairs/{id}` — קבלת תיקון
- `PATCH /repairs/{id}` / `PATCH /api/repairs/{id}` — עדכון תיקון
- `DELETE /repairs/{id}` / `DELETE /api/repairs/{id}` — מחיקת תיקון

### תורים (`/appointments`)
- `GET /appointments` — רשימת תורים
- `POST /appointments` — יצירת תור
- `PATCH /appointments/{id}` — עדכון תור
- `DELETE /appointments/{id}` — מחיקת תור
- `POST /appointments/{id}/remind` — שליחת תזכורת WhatsApp

### רכב (`/vehicle`)
- `GET /vehicle/{plate}` — שליפת נתוני רכב ממשרד התחבורה

### תמונות (`/upload`)
- `POST /upload` — העלאת תמונה
- `DELETE /upload/{filename}` — מחיקת תמונה

## הרצת הפרויקט
```bash
# התקנת dependencies
pip install -r requirements.txt

# הרצת שרת
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Deploy
הפרויקט מוכן ל-deploy ב-Render. ודא שכל משתני הסביבה מוגדרים:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GREEN_API_INSTANCE` (אופציונלי)
- `GREEN_API_TOKEN` (אופציונלי)

## הנחיות לסוכן
- כל הקוד בעברית בתגובות ובהערות — הפרויקט ישראלי
- MVP — לא מסרבלים, שומרים על קוד רזה ופשוט
- Routes מחולקים לפי מודול ב-`routes/`
- Templates מחולקים לפי view + base.html משותף
- JS מחולק לפי מודול + main.js לפונקציות משותפות
- `db` מיובא מ-`database.py` — לא יוצרים client חדש בכל קובץ
- בדיקת endpoints דרך `/docs` (Swagger אוטומטי)
