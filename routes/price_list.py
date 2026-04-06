from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import db

try:
    from postgrest.exceptions import APIError
except ImportError:
    APIError = Exception

router = APIRouter()


class PriceListItemCreate(BaseModel):
    category: str
    name: str
    part_cost: Optional[float] = 0
    sale_price: float
    labor_cost: Optional[float] = 0


class PriceListItemUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    part_cost: Optional[float] = None
    sale_price: Optional[float] = None
    labor_cost: Optional[float] = None


CATEGORIES = {
    'oils': 'שמנים',
    'filters': 'מסננים',
    'brakes': 'בלמים',
    'engine': 'חלקי מנוע',
    'labor': 'עבודה',
    'other': 'אחר'
}


@router.get("/price-list")
@router.get("/api/price-list")
def list_price_list():
    try:
        return db.table("price_list").select("*").order("category").order("name").execute().data
    except APIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/price-list", status_code=201)
@router.post("/api/price-list", status_code=201)
def create_price_list_item(item: PriceListItemCreate):
    payload = item.model_dump()
    try:
        res = db.table("price_list").insert(payload).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not res.data:
        raise HTTPException(status_code=400, detail="שגיאה ביצירת פריט")
    return res.data[0]


@router.patch("/price-list/{id}")
@router.patch("/api/price-list/{id}")
def update_price_list_item(id: int, item: PriceListItemUpdate):
    patch = item.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="אין שדות לעדכון")
    try:
        result = db.table("price_list").update(patch).eq("id", id).execute().data
    except APIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="פריט לא נמצא")
    return result[0]


@router.delete("/price-list/{id}", status_code=204)
@router.delete("/api/price-list/{id}", status_code=204)
def delete_price_list_item(id: int):
    try:
        db.table("price_list").delete().eq("id", id).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=str(e))
