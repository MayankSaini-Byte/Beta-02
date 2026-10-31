"""
KitchenSync model service (Python/FastAPI)
==========================================

The Node backend forwards phone-camera images here:

    POST /predict   multipart "receipt" -> { "items": [ { raw_name, name, qty, unit, price, confidence } ] }
    POST /expiry    multipart "photo"   -> { "product": "...", "expiry_date": "YYYY-MM-DD", "confidence": 0.9 }
    GET  /health

Wire in YOUR model
------------------
Everything routes through two functions you own:

    run_your_model(img)       -> list of dicts (receipt line items)
    run_your_expiry_model(img)-> {"product": ..., "expiry_date": ..., "confidence": ...}

Drop your trained model in (torch / TF / paddleocr / ...), return the fields
above, and the Node backend normalizes the rest (units, fuzzy match, review).
If your model raises or returns nothing, a pytesseract OCR fallback runs; if
that also fails, the backend shows "Couldn't read this receipt" - it never
invents items.

Run:
    pip install -r requirements.txt
    uvicorn model_service:app --host 0.0.0.0 --port 8000

Then in the Node backend .env:
    MODEL_SERVICE_URL=http://127.0.0.1:8000
    MODEL_TIMEOUT_MS=8000
"""
import io
import re
import os
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

app = FastAPI(title="KitchenSync model service", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ----------------------------------------------------------------------------
# 1) YOUR MODEL GOES HERE - replace these two functions
# ----------------------------------------------------------------------------

def run_your_model(img: Image.Image) -> List[dict]:
    """Your trained receipt model. Return one dict per line item:
    {"raw_name": "AMUL BUTTER 500G", "qty": 500, "unit": "g", "price": 275, "confidence": 0.91}
    qty must be in base units (g | ml | pc); the Node backend re-checks anyway.
    """
    raise NotImplementedError  # -> falls through to the OCR fallback below


def run_your_expiry_model(img: Image.Image) -> Optional[dict]:
    """Your trained expiry-date reader. Return
    {"product": "Amul Butter", "expiry_date": "2026-08-17", "confidence": 0.93}
    or None if no date is visible.
    """
    raise NotImplementedError  # -> falls through to the OCR fallback below


# ----------------------------------------------------------------------------
# 2) OCR fallback (works out of the box if pytesseract + tesseract are installed)
# ----------------------------------------------------------------------------

try:
    import pytesseract
    HAS_OCR = True
except Exception:
    HAS_OCR = False

UNIT_TABLE = {
    "kg": ("g", 1000), "kgs": ("g", 1000), "kilo": ("g", 1000), "kilogram": ("g", 1000),
    "g": ("g", 1), "gm": ("g", 1), "gms": ("g", 1), "gram": ("g", 1), "grams": ("g", 1),
    "l": ("ml", 1000), "lt": ("ml", 1000), "ltr": ("ml", 1000), "litre": ("ml", 1000),
    "liter": ("ml", 1000), "ml": ("ml", 1),
    "pc": ("pc", 1), "pcs": ("pc", 1), "piece": ("pc", 1), "pieces": ("pc", 1), "nos": ("pc", 1),
}
QTY_RX = re.compile(
    r"(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilogram|g|gm|gms|gram|grams|l|lt|ltr|litre|liter|ml|pc|pcs|piece|pieces|nos)\b",
    re.IGNORECASE,
)
PRICE_RX = re.compile(r"(?:rs\.?|\u20b9|inr)?\s*(\d+(?:\.\d{1,2})?)\s*$", re.IGNORECASE)
NOISE_RX = re.compile(
    r"(total|subtotal|gst|cgst|sgst|vat|tax|amount|cash|change|thank|visit|bill|invoice|store|"
    r"branch|cashier|token|order|date|time|phone|address|saved|points|paytm|upi|card|balance|mrp)",
    re.IGNORECASE,
)
STORE_RX = re.compile(
    r"^(big\s*)?(bazar|bazaar|kirana|supermarket|grocer(y|s)?|general\s*store|mart|traders|stores?|provision|pvt|ltd)\b.*$",
    re.IGNORECASE,
)
DATE_RX = re.compile(r"(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})")


def ocr(img: Image.Image) -> str:
    if not HAS_OCR:
        raise RuntimeError("pytesseract not installed - add your model or pip install pytesseract")
    return pytesseract.image_to_string(img)


def parse_receipt_lines(text: str) -> List[dict]:
    """Receipt text -> raw items (same rules as the Node demo engine)."""
    items = []
    for line in text.splitlines():
        s = re.sub(r"\s+", " ", line).strip()
        if len(s) < 3:
            continue
        price = None
        m = PRICE_RX.search(s)
        if m:
            price = float(m.group(1))
            s = s[: m.start()].strip()
        s = re.sub(r"^\s*\d+\s*[xX*]\s*", "", s).strip()
        if not s or NOISE_RX.search(s) or STORE_RX.match(s):
            continue
        qty, unit = None, None
        q = QTY_RX.search(s)
        if q:
            target, mult = UNIT_TABLE[q.group(2).lower()]
            qty, unit = float(q.group(1)) * mult, target
            s = s.replace(q.group(0), " ").strip()
        if not s:
            continue
        items.append({
            "raw_name": s,
            "qty": qty,
            "unit": unit,
            "price": price,
            "confidence": 0.75,  # OCR fallback confidence - Node flags < 0.7 amber
        })
        if len(items) >= 20:
            break
    return items


def parse_expiry(text: str) -> Optional[dict]:
    """OCR text -> expiry date (DD/MM/YYYY is the common Indian print format)."""
    m = DATE_RX.search(text)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    if not (1 <= mo <= 12 and 1 <= d <= 31 and 2000 <= y <= 2099):
        return None
    return {
        "product": None,
        "expiry_date": f"{y:04d}-{mo:02d}-{d:02d}",
        "confidence": 0.72,
    }


# ----------------------------------------------------------------------------
# 3) Endpoints
# ----------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True, "ocr": HAS_OCR}


@app.post("/predict")
async def predict(receipt: UploadFile = File(...)):
    img = Image.open(io.BytesIO(await receipt.read())).convert("RGB")
    try:
        items = run_your_model(img)  # your model first
    except Exception:
        try:
            items = parse_receipt_lines(ocr(img))  # OCR fallback
        except Exception:
            return {"items": []}  # Node backend shows the honest failure card
    return {"items": items or []}


@app.post("/expiry")
async def expiry(photo: UploadFile = File(...)):
    img = Image.open(io.BytesIO(await photo.read())).convert("RGB")
    try:
        result = run_your_expiry_model(img)  # your model first
    except Exception:
        try:
            result = parse_expiry(ocr(img))  # OCR fallback
        except Exception:
            result = None
    return result or {"product": None, "expiry_date": None, "confidence": 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
