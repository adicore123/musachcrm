from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from database import db
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union, Any
import uuid
import requests as req
import greenapi

try:
    from postgrest.exceptions import APIError
except ImportError:
    APIError = Exception  # type: ignore[misc,assignment]

app = FastAPI(title="CRM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BUCKET = "crm-images"
templates = Jinja2Templates(directory="templates")


# ---------- FRONTEND ----------

@app.get("/")
def serve_frontend(request: Request):
    return templates.TemplateResponse(request, "index.html")


# ---------- IMAGES ----------

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    contents = await file.read()
    db.storage.from_(BUCKET).upload(
        path=filename,
        file=contents,
        file_options={"content-type": file.content_type}
    )
    url = db.storage.from_(BUCKET).get_public_url(filename)
    return {"url": url, "filename": filename}

@app.delete("/upload/{filename}")
def delete_image(filename: str):
    db.storage.from_(BUCKET).remove([filename])
    return {"deleted": filename}


# ---------- VEHICLE LOOKUP (ממשרד התחבורה) ----------

@app.get("/vehicle/{plate}")
def get_vehicle_data(plate: str):
    # הסרת מקפים ורווחים מהלוחית
    clean_plate = plate.replace("-", "").replace(" ", "")
    try:
        resp = req.get(
            "https://data.gov.il/api/3/action/datastore_search",
            params={
                "resource_id": "053cea08-09bc-40ec-8f7a-156f0677aff3",
                "filters": f'{{"mispar_rechev":"{clean_plate}"}}',
            },
            timeout=10,
        )
        records = resp.json().get("result", {}).get("records", [])
    except Exception:
        raise HTTPException(status_code=503, detail="שגיאה בחיבור לממשרד התחבורה")

    if not records:
        raise HTTPException(status_code=404, detail="לוחית לא נמצאה")

    r = records[0]
    return {
        "manufacturer": r.get("tozeret_nm", ""),
        "model": r.get("kinuy_mishari", "") or r.get("degem_nm", ""),
        "year": r.get("shnat_yitzur", ""),
        "color": r.get("tzeva_rechev", ""),
        "test_validity": r.get("tokef_dt", ""),
        "raw": r,
    }


# ---------- MODELS ----------

class Customer(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    id_number: Optional[str] = None   # תעודת זהות
    address: Optional[str] = None
    notes: Optional[str] = None
    license_plate: Optional[str] = None


class RepairCreate(BaseModel):
    customer_id: Union[str, int]
    description: str = Field(..., min_length=1)
    license_plate: Optional[str] = None
    vehicle_manufacturer: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[str] = None
    vehicle_color: Optional[str] = None
    test_validity: Optional[str] = None
    status: Optional[str] = "open"
    notes: Optional[str] = None

    @field_validator("customer_id", mode="before")
    @classmethod
    def customer_id_as_str(cls, v: Any) -> str:
        if v is None or v == "":
            raise ValueError("חובה לבחור לקוח")
        return str(v).strip()


class RepairUpdate(BaseModel):
    customer_id: Optional[Union[str, int]] = None
    description: Optional[str] = None
    license_plate: Optional[str] = None
    vehicle_manufacturer: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[str] = None
    vehicle_color: Optional[str] = None
    test_validity: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("customer_id", mode="before")
    @classmethod
    def customer_id_optional_str(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        return str(v).strip()


# ---------- CUSTOMERS ----------

@app.get("/customers")
def list_customers():
    return db.table("customers").select("*").order("created_at", desc=True).execute().data

@app.post("/customers", status_code=201)
def create_customer(customer: Customer):
    return db.table("customers").insert(customer.model_dump(exclude_none=True)).execute().data[0]

@app.get("/customers/{id}")
def get_customer(id: str):
    result = db.table("customers").select("*").eq("id", id).execute().data
    if not result:
        raise HTTPException(status_code=404, detail="לקוח לא נמצא")
    return result[0]

@app.patch("/customers/{id}")
def update_customer(id: str, customer: Customer):
    return db.table("customers").update(customer.model_dump(exclude_none=True)).eq("id", id).execute().data[0]

@app.delete("/customers/{id}", status_code=204)
def delete_customer(id: str):
    db.table("customers").delete().eq("id", id).execute()


# ---------- REPAIRS (תיקונים) ----------
# נתיבים: /repairs וגם /api/repairs (אותו לוגיקה — לפרוקסי / קליינטים שמצפים ל-prefix)

_EMBED = "*, customers(full_name, phone, license_plate)"


def _repairs_list_rows():
    try:
        return (
            db.table("repairs")
            .select(_EMBED)
            .order("created_at", desc=True)
            .execute()
            .data
        )
    except APIError:
        return (
            db.table("repairs")
            .select("*")
            .order("created_at", desc=True)
            .execute()
            .data
        )


def _repair_get_row(id: str):
    try:
        return (
            db.table("repairs")
            .select(_EMBED)
            .eq("id", id)
            .execute()
            .data
        )
    except APIError:
        return db.table("repairs").select("*").eq("id", id).execute().data


def _repair_insert_payload(repair: RepairCreate) -> dict:
    d = repair.model_dump(exclude_none=True)
    d["customer_id"] = str(d["customer_id"]).strip()
    return d


def _repair_update_payload(repair: RepairUpdate) -> dict:
    patch = repair.model_dump(exclude_unset=True)
    if "customer_id" in patch and patch["customer_id"] is not None:
        patch["customer_id"] = str(patch["customer_id"]).strip()
    return patch


@app.get("/repairs")
@app.get("/api/repairs")
def list_repairs():
    return _repairs_list_rows()


@app.get("/repairs/{id}")
@app.get("/api/repairs/{id}")
def get_repair(id: str):
    result = _repair_get_row(id)
    if not result:
        raise HTTPException(status_code=404, detail="תיקון לא נמצא")
    return result[0]


@app.post("/repairs", status_code=201)
@app.post("/api/repairs", status_code=201)
def create_repair(repair: RepairCreate):
    payload = _repair_insert_payload(repair)
    try:
        res = db.table("repairs").insert(payload).execute()
    except APIError as e:
        raise HTTPException(
            status_code=400,
            detail=e.message or str(e) or "שגיאת סופהבייס ביצירת תיקון",
        ) from e
    row = res.data
    if not row:
        raise HTTPException(
            status_code=400,
            detail="סופהבייס לא החזיר רשומה — בדוק RLS, FK ל-customers וסכמת טבלת repairs",
        )
    return row[0]


@app.patch("/repairs/{id}")
@app.patch("/api/repairs/{id}")
def update_repair(id: str, repair: RepairUpdate):
    patch = _repair_update_payload(repair)
    if not patch:
        raise HTTPException(status_code=400, detail="אין שדות לעדכון")
    try:
        result = db.table("repairs").update(patch).eq("id", id).execute().data
    except APIError as e:
        raise HTTPException(
            status_code=400,
            detail=e.message or str(e) or "שגיאת סופהבייס בעדכון תיקון",
        ) from e
    if not result:
        raise HTTPException(status_code=404, detail="תיקון לא נמצא")
    return result[0]


@app.delete("/repairs/{id}", status_code=204)
@app.delete("/api/repairs/{id}", status_code=204)
def delete_repair(id: str):
    try:
        db.table("repairs").delete().eq("id", id).execute()
    except APIError as e:
        raise HTTPException(
            status_code=400,
            detail=e.message or str(e) or "שגיאת סופהבייס במחיקת תיקון",
        ) from e


# ---------- APPOINTMENTS (תורים) ----------

class AppointmentCreate(BaseModel):
    customer_id: Union[str, int]
    appointment_time: str
    service_type: Optional[str] = None
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None

    @field_validator("customer_id", mode="before")
    @classmethod
    def customer_id_as_str(cls, v: Any) -> str:
        if v is None or v == "":
            raise ValueError("חובה לבחור לקוח")
        return str(v).strip()


class AppointmentUpdate(BaseModel):
    customer_id: Optional[Union[str, int]] = None
    appointment_time: Optional[str] = None
    service_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("customer_id", mode="before")
    @classmethod
    def customer_id_optional_str(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        return str(v).strip()


_APT_EMBED = "*, customers(full_name, phone, license_plate)"


@app.get("/appointments")
def list_appointments():
    return (
        db.table("appointments")
        .select(_APT_EMBED)
        .order("appointment_time")
        .execute()
        .data
    )


@app.post("/appointments", status_code=201)
def create_appointment(appointment: AppointmentCreate):
    payload = appointment.model_dump(exclude_none=True)
    try:
        res = db.table("appointments").insert(payload).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=getattr(e, "message", None) or str(e)) from e
    if not res.data:
        raise HTTPException(status_code=400, detail="שגיאה ביצירת התור")
    return res.data[0]


@app.patch("/appointments/{id}")
def update_appointment(id: str, appointment: AppointmentUpdate):
    patch = appointment.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="אין שדות לעדכון")
    try:
        result = db.table("appointments").update(patch).eq("id", id).execute().data
    except APIError as e:
        raise HTTPException(status_code=400, detail=getattr(e, "message", None) or str(e)) from e
    if not result:
        raise HTTPException(status_code=404, detail="תור לא נמצא")
    return result[0]


@app.delete("/appointments/{id}", status_code=204)
def delete_appointment(id: str):
    try:
        db.table("appointments").delete().eq("id", id).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=getattr(e, "message", None) or str(e)) from e


# ---------- WHATSAPP REMINDER ----------

@app.post("/appointments/{id}/remind")
def remind_appointment(id: str):
    rows = (
        db.table("appointments")
        .select("*, customers(full_name, phone)")
        .eq("id", id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="תור לא נמצא")
    result = greenapi.send_appointment_reminder(rows[0])
    return {"sent": True, "green_api": result}
