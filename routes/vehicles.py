from fastapi import APIRouter, HTTPException
import requests as req

router = APIRouter()


@router.get("/vehicle/{plate}")
def get_vehicle_data(plate: str):
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
