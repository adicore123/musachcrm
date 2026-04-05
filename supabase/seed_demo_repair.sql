-- תיקון דוגמה אחד — להריץ ב-Supabase SQL Editor אחרי repairs_schema.sql
-- דורש לפחות לקוח אחד ב-customers. אם אין — צור לקוח ב-Table Editor או הרץ scripts/seed_demo_repair.py

INSERT INTO public.repairs (
  customer_id,
  license_plate,
  vehicle_manufacturer,
  vehicle_model,
  vehicle_year,
  vehicle_color,
  description,
  status,
  notes
)
SELECT
  c.id,
  COALESCE(NULLIF(TRIM(c.license_plate), ''), '12-345-67'),
  'טויוטה',
  'קורולה',
  '2019',
  'כסף מתכתי',
  'תיקון דוגמה: החלפת שמן ומסנן — להדגמת מערכת התיקונים',
  'in_progress',
  'נוצר מ-seed_demo_repair.sql'
FROM public.customers c
ORDER BY c.created_at ASC NULLS LAST
LIMIT 1;
