"""POST /chapter/extract — Extract sentences from a textbook chapter PDF."""

import io
import logging
import re
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.api.ocr import _binary

router = APIRouter()
log = logging.getLogger(__name__)

SENTENCE_PATTERN = re.compile(r"([^।॥\?!.\n]+[।॥\?!.]?)")


def is_usable_text(text: Optional[str]) -> bool:
    """Check if digitally extracted text is genuinely readable Hindi/text,
    or corrupted by embedded CID font indices like (cid:52), unmapped glyphs,
    or InDesign font ligature corruption (e.g. separated dependent matras,
    halants with trailing whitespace, stacked matras, or publisher metadata).
    """
    if not text or not text.strip():
        return False

    # 1. CID font artifacts check: (cid:52), (cid:109), etc.
    if re.search(r"\(cid:\d+\)", text):
        return False

    # 2. Check for actual readable characters (Devanagari or Latin)
    devanagari_chars = len(re.findall(r"[\u0900-\u097F]", text))
    latin_chars = len(re.findall(r"[a-zA-Z]", text))
    total_alpha = devanagari_chars + latin_chars

    # If text has fewer than 4 letters/devanagari characters, it's not usable content
    if total_alpha < 4:
        return False

    # If non-alphanumeric noise dominates the text
    total_len = len(text.strip())
    if total_len > 0 and (total_alpha / total_len) < 0.25:
        return False

    # 3. Detect InDesign / font-encoding corruption:
    # 3a. Separated dependent vowel sign preceded by whitespace or at start of word.
    # Specifically includes \u093F (ि / chhoti-ee) as well as \u093E-\u094C, \u0901-\u0903
    if re.search(r"\s+[\u093E-\u094C\u093F\u0901-\u0903]", text):
        return False

    # 3b. Halant (virama) followed by whitespace (e.g. 'प् ाणी', 'कक् ा')
    if re.search(r"\u094D\s+", text):
        return False

    # 3c. Conflicting / stacked dependent vowel matras (e.g. 'पािी', 'झकु ी', 'ह?ै')
    if re.search(r"[\u093E-\u094C\u093F]{2,}", text):
        return False

    # 3d. InDesign print/reprint metadata embedded directly in the body text
    if re.search(r"\.indd\b|Reprint\s+\d{4}-\d{2}|\b\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M\b", text, re.IGNORECASE):
        return False

    return True


def ocr_pdf_page(page_obj=None, pypdfium_page=None) -> str:
    """Render a PDF page to image and perform high-resolution Tesseract OCR."""
    try:
        import pytesseract

        pytesseract.pytesseract.tesseract_cmd = _binary()

        pil_image = None
        if pypdfium_page is not None:
            # 2.5x scale corresponds to ~180 DPI, crisp and fast for OCR
            pil_image = pypdfium_page.render(scale=2.5).to_pil()
        elif page_obj is not None and hasattr(page_obj, "to_image"):
            pil_image = page_obj.to_image(resolution=200).original

        if pil_image is not None:
            ocr_text = pytesseract.image_to_string(pil_image, lang="hin+eng")
            if ocr_text and ocr_text.strip():
                cleaned = re.sub(r"\(cid:\d+\)", "", ocr_text)
                return cleaned.strip()
    except Exception as e:
        log.warning("OCR for PDF page failed: %s", e)
    return ""


def clean_and_unwrap_text(raw_text: str) -> str:
    """Join soft line wraps within paragraphs and strip textbook headers/page noise,
    publisher metadata (.indd, Reprint, timestamps), and OCR margins.
    """
    if not raw_text:
        return ""
    cleaned = re.sub(r"\(cid:\d+\)", "", raw_text)
    raw_lines = [l.strip() for l in cleaned.splitlines() if l.strip()]

    # Standard boilerplate headings to drop
    boilerplate_pattern = re.compile(
        r"^(पाठ\s*\d+|अभ्यास|पृष्ठ\s*\d+|page\s*\d+|\d+|NCERT|JCERT)$",
        re.IGNORECASE,
    )

    # InDesign / textbook header & footer metadata patterns
    metadata_drop_pattern = re.compile(
        r"(\.indd\b|Reprint\s+\d{4}-\d{2}|\b\d{1,2}-[A-Za-z]+-\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M\b|^\d+\s+(?:वीणा|NCERT|JCERT)\s*\|)",
        re.IGNORECASE,
    )

    filtered_lines = []
    for line in raw_lines:
        line_clean = line.strip()
        if not line_clean or boilerplate_pattern.match(line_clean):
            continue

        # If line contains metadata, strip the metadata portion
        if metadata_drop_pattern.search(line_clean):
            line_clean = re.sub(
                r"\bReprint\s+\d{4}-\d{2}\b|\b(?:Unit\s+\d+\s+)?\d+\s+to\s+\d+\.indd.*|\.indd\s+\d+.*|\b\d{1,2}-[A-Za-z]+-\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M\b|^\d+\s+(?:वीणा|NCERT|JCERT)\s*\|\s*(?:कक्षा\s*\d+)?",
                "",
                line_clean,
                flags=re.IGNORECASE,
            ).strip()

        # If line has remaining valid Hindi/Latin content, keep it
        if line_clean and (any("\u0900" <= c <= "\u097F" for c in line_clean) or any(c.isalpha() for c in line_clean)):
            # Drop pure noise like single non-alphabet tokens or 'LA Cente os' OCR margin noise
            if re.match(r"^[A-Za-z\s\.\*=-]{1,15}$", line_clean):
                continue

            # Strip leading non-alphabet/non-consonant symbols (e.g. '= BR. *', '५', '{', digits)
            line_clean = re.sub(r"^[^\u0905-\u0939a-zA-Z]+", "", line_clean).strip()
            # Strip trailing non-punctuation symbols (e.g. '{', '}')
            line_clean = re.sub(r"[^\u0900-\u097F।॥\?!a-zA-Z\.]+$", "", line_clean).strip()

            # Strip stray Latin OCR tokens mixed into Hindi lines (e.g. 'a 4 -')
            if re.search(r"[a-zA-Z]", line_clean) and any("\u0900" <= c <= "\u097F" for c in line_clean):
                line_clean = re.sub(r"\b[a-zA-Z0-9\-\.\*]+\b", "", line_clean).strip()
                line_clean = re.sub(r"\s+", " ", line_clean).strip()

            # Ignore short incomplete caption fragments that do not end in terminal punctuation
            words = line_clean.split()
            if not line_clean.endswith(("।", "॥", "?", "!", ".")) and len(words) < 4:
                continue

            if line_clean:
                filtered_lines.append(line_clean)

    unwrapped = []
    buf = ""
    for line in filtered_lines:
        if not buf:
            buf = line
        elif buf.endswith(("।", "॥", "?", "!", ":")):
            unwrapped.append(buf)
            buf = line
        else:
            buf = buf + " " + line
    if buf:
        unwrapped.append(buf)

    full = " ".join(unwrapped)
    return re.sub(r"[ \t]+", " ", full).strip()


def split_hindi_sentences(raw_text: str) -> List[str]:
    """Split raw text into clean Hindi sentences, filtering noise and preserving punctuation."""
    if not raw_text:
        return []
    unwrapped_text = clean_and_unwrap_text(raw_text)
    if not unwrapped_text:
        return []

    # Match sentences delimited by Hindi/standard terminators (। ॥ ? !)
    raw_matches = re.findall(r"[^।॥\?!]+[।॥\?!]?", unwrapped_text)
    sentences = []
    for match in raw_matches:
        cleaned = re.sub(r"\s+", " ", match).strip()
        # Filter out standalone metadata or noise lines
        cleaned = re.sub(
            r"\bReprint\s+\d{4}-\d{2}\b|\b(?:Unit\s+\d+\s+)?\d+\s+to\s+\d+\.indd.*|\.indd\s+\d+.*|\b\d{1,2}-[A-Za-z]+-\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M\b",
            "",
            cleaned,
            flags=re.IGNORECASE,
        ).strip()
        # Strip leading punctuation/symbols like '= BR. *', '५', digits followed by dot/dash
        cleaned = re.sub(r"^[=\*\.\-\+\s५३|0-9a-zA-Z]+\s*[\.\*\-]?\s*", "", cleaned).strip()
        words = cleaned.split()
        # Require at least 1 word and 2 characters with readable Hindi/Latin script
        if len(words) >= 1 and len(cleaned) >= 2 and any(
            ("\u0900" <= c <= "\u097F") or c.isalpha() for c in cleaned
        ):
            if not cleaned.endswith(("।", "॥", "?", "!")):
                cleaned += "।"
            sentences.append(cleaned)
    return sentences


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using digital extraction with automatic OCR fallback
    per-page whenever fonts are unmapped (CID artifacts) or pages are scanned.
    """
    text_pieces = []

    # Initialize pypdfium2 doc for page rendering / fallback
    pdfium_doc = None
    try:
        import pypdfium2 as pdfium

        pdfium_doc = pdfium.PdfDocument(file_bytes)
    except Exception as e:
        log.warning("pypdfium2 document initialization failed: %s", e)

    # 1. Try pdfplumber page-by-page
    plumber_worked = False
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            plumber_worked = True
            for idx, page in enumerate(pdf.pages):
                raw_page_text = page.extract_text() or ""
                pdfium_page = (
                    pdfium_doc[idx]
                    if (pdfium_doc and idx < len(pdfium_doc))
                    else None
                )

                if is_usable_text(raw_page_text):
                    text_pieces.append(raw_page_text.strip())
                else:
                    log.info(
                        "Page %d has unmapped/CID fonts or is scanned; falling back to OCR",
                        idx + 1,
                    )
                    ocr_text = ocr_pdf_page(page, pdfium_page)
                    if ocr_text:
                        text_pieces.append(ocr_text)
    except ImportError:
        pass
    except Exception as e:
        log.warning("pdfplumber extraction failed: %s", e)

    # 2. If pdfplumber was not available, use pypdfium2 directly
    if not plumber_worked and pdfium_doc:
        try:
            for idx in range(len(pdfium_doc)):
                pdfium_page = pdfium_doc[idx]
                text_page = pdfium_page.get_textpage()
                raw_page_text = text_page.get_text_range() or ""
                if is_usable_text(raw_page_text):
                    text_pieces.append(raw_page_text.strip())
                else:
                    ocr_text = ocr_pdf_page(None, pdfium_page)
                    if ocr_text:
                        text_pieces.append(ocr_text)
        except Exception as e:
            log.warning("pypdfium text extraction failed: %s", e)

    # Final cleanup: strip any residual CID markers and normalize spaces
    full_extracted = "\n".join(text_pieces)
    sanitized = re.sub(r"\(cid:\d+\)", "", full_extracted)
    sanitized = re.sub(r"[ \t]+", " ", sanitized)
    return sanitized.strip()


@router.post("/chapter/extract")
async def extract_chapter(file: UploadFile = File(...)):
    """Extract sentences from a chapter file (PDF or TXT)."""
    filename = (file.filename or "").lower()
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(400, f"Could not read uploaded file: {e}")

    if not file_bytes:
        raise HTTPException(400, "The uploaded file is empty.")

    raw_text = ""
    if filename.endswith(".txt"):
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1")
    else:
        raw_text = extract_text_from_pdf(file_bytes)

    sentences = split_hindi_sentences(raw_text)
    full_text = clean_and_unwrap_text(raw_text)

    if not sentences:
        raise HTTPException(
            422,
            "Could not extract readable Hindi sentences from this file. "
            "Please verify that Tesseract with 'hin' language pack is installed.",
        )

    return {
        "filename": file.filename,
        "full_text": full_text,
        "sentences": sentences,
        "count": len(sentences),
    }
