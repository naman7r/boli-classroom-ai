"""POST /correct, GET /corrections/count — teacher corrections."""

from contextlib import closing

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import db
from app.api.languages import NAMES

router = APIRouter()


class CorrectionRequest(BaseModel):
    lesson_id: int
    original: str
    corrected: str
    lang: str


@router.post("/correct")
def correct(req: CorrectionRequest):
    if req.lang not in NAMES:
        raise HTTPException(
            400, f"Unknown language '{req.lang}'. See GET /languages."
        )
    if not req.corrected.strip():
        raise HTTPException(400, "The corrected text is empty.")
    if len(req.corrected) > 5000 or len(req.original) > 5000:
        raise HTTPException(400, "Correction text exceeds limit of 5,000 characters.")

    with closing(db.connect()) as conn:
        if req.lesson_id:
            lesson_exists = conn.execute(
                "SELECT 1 FROM lessons WHERE id = ?", (req.lesson_id,)
            ).fetchone()
            if not lesson_exists:
                raise HTTPException(404, f"Lesson ID {req.lesson_id} not found.")

        cur = conn.execute(
            "INSERT INTO corrections (lesson_id, lang_code, original_text, "
            "corrected_text) VALUES (?, ?, ?, ?)",
            (req.lesson_id, req.lang, req.original, req.corrected.strip()),
        )
        conn.commit()
        return {"id": cur.lastrowid, "logged": True}


@router.get("/corrections/count")
def corrections_count():
    with closing(db.connect()) as conn:
        (count,) = conn.execute("SELECT COUNT(*) FROM corrections").fetchone()
    return {"count": count}
