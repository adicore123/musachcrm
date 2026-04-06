from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union, Any, List
from database import db

try:
    from postgrest.exceptions import APIError
except ImportError:
    APIError = Exception

router = APIRouter()

_EMBED = "*, customers(full_name, phone, license_plate)"


class RepairItem(BaseModel):
    category: str = "other"
    name: str
    part_cost: Optional[float] = 0
    sale_price: Optional[float] = 0
    labor_cost: Optional[float] = 0


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
    items: Optional[List[RepairItem]] = []
    vat_enabled: Optional[bool] = True
    final_price: Optional[float] = None

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
    items: Optional[List[RepairItem]] = None
    vat_enabled: Optional[bool] = None
    final_price: Optional[float] = None

    @field_validator("customer_id", mode="before")
    @classmethod
    def customer_id_optional_str(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        return str(v).strip()


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


@router.get("/repairs")
@router.get("/api/repairs")
def list_repairs():
    return _repairs_list_rows()


@router.get("/repairs/{id}")
@router.get("/api/repairs/{id}")
def get_repair(id: str):
    result = _repair_get_row(id)
    if not result:
        raise HTTPException(status_code=404, detail="תיקון לא נמצא")
    return result[0]


@router.post("/repairs", status_code=201)
@router.post("/api/repairs", status_code=201)
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


@router.patch("/repairs/{id}")
@router.patch("/api/repairs/{id}")
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


@router.delete("/repairs/{id}", status_code=204)
@router.delete("/api/repairs/{id}", status_code=204)
def delete_repair(id: str):
    try:
        db.table("repairs").delete().eq("id", id).execute()
    except APIError as e:
        raise HTTPException(
            status_code=400,
            detail=e.message or str(e) or "שגיאת סופהבייס במחיקת תיקון",
        ) from e
