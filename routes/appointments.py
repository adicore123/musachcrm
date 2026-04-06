from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional, Union, Any
from database import db
import greenapi

try:
    from postgrest.exceptions import APIError
except ImportError:
    APIError = Exception

router = APIRouter()

_APT_EMBED = "*, customers(full_name, phone, license_plate)"


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


@router.get("/appointments")
def list_appointments():
    return (
        db.table("appointments")
        .select(_APT_EMBED)
        .order("appointment_time")
        .execute()
        .data
    )


@router.post("/appointments", status_code=201)
def create_appointment(appointment: AppointmentCreate):
    payload = appointment.model_dump(exclude_none=True)
    try:
        res = db.table("appointments").insert(payload).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=getattr(e, "message", None) or str(e)) from e
    if not res.data:
        raise HTTPException(status_code=400, detail="שגיאה ביצירת התור")
    return res.data[0]


@router.patch("/appointments/{id}")
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


@router.delete("/appointments/{id}", status_code=204)
def delete_appointment(id: str):
    try:
        db.table("appointments").delete().eq("id", id).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=getattr(e, "message", None) or str(e)) from e


@router.post("/appointments/{id}/remind")
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
