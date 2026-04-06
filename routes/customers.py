from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import db

router = APIRouter()


class Customer(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    id_number: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    license_plate: Optional[str] = None


@router.get("/customers")
def list_customers():
    return db.table("customers").select("*").order("created_at", desc=True).execute().data


@router.post("/customers", status_code=201)
def create_customer(customer: Customer):
    return db.table("customers").insert(customer.model_dump(exclude_none=True)).execute().data[0]


@router.get("/customers/{id}")
def get_customer(id: str):
    result = db.table("customers").select("*").eq("id", id).execute().data
    if not result:
        raise HTTPException(status_code=404, detail="לקוח לא נמצא")
    return result[0]


@router.patch("/customers/{id}")
def update_customer(id: str, customer: Customer):
    return db.table("customers").update(customer.model_dump(exclude_none=True)).eq("id", id).execute().data[0]


@router.delete("/customers/{id}", status_code=204)
def delete_customer(id: str):
    db.table("customers").delete().eq("id", id).execute()
