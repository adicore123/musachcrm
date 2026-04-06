from fastapi import APIRouter, UploadFile, File
from database import db
import uuid

router = APIRouter()

BUCKET = "crm-images"


@router.post("/upload")
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


@router.delete("/upload/{filename}")
def delete_image(filename: str):
    db.storage.from_(BUCKET).remove([filename])
    return {"deleted": filename}
