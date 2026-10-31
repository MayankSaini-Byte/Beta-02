"""Local PP-OCRv5 mobile receipt OCR for the KitchenSync model service."""

import io
import json
import os
import shutil
import threading
from pathlib import Path

from PIL import Image

from .image_preprocessing import decode_and_preprocess
from .item_extraction import parse_receipt

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(os.environ.get("RECEIPT_MODEL_DIR", str(BASE_DIR / ".receipt-models")))
_ENGINE = None
_LOCK = threading.Lock()


def _model_paths():
    det = MODEL_DIR / "PP-OCRv5_mobile_det"
    rec = MODEL_DIR / "en_PP-OCRv5_mobile_rec"
    for path in (det, rec):
        if not ((path / "inference.json").is_file() or (path / "inference.pdmodel").is_file()):
            raise RuntimeError("Local PaddleOCR models are missing. Run `python setup_models.py` once before scanning receipts.")
    return det, rec


def _engine(allow_download=False):
    global _ENGINE
    with _LOCK:
        if _ENGINE is not None:
            return _ENGINE
        os.environ.setdefault("DISABLE_MODEL_SOURCE_CHECK", "True")
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        from paddleocr import PaddleOCR

        if allow_download:
            os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
            _ENGINE = PaddleOCR(
                text_detection_model_name="PP-OCRv5_mobile_det",
                text_recognition_model_name="en_PP-OCRv5_mobile_rec",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                device="cpu",
            )
            roots = [Path.home() / ".paddlex" / "official_models"]
            configured = os.environ.get("PADDLE_PDX_HOME")
            if configured:
                roots.append(Path(configured) / "official_models")
            MODEL_DIR.mkdir(parents=True, exist_ok=True)
            for name in ("PP-OCRv5_mobile_det", "en_PP-OCRv5_mobile_rec"):
                source = next((root / name for root in roots if (root / name).is_dir()), None)
                if source is None:
                    raise RuntimeError(f"Could not find the downloaded local model {name}.")
                target = MODEL_DIR / name
                if not target.exists():
                    shutil.copytree(source, target)
            _ENGINE = None

        det, rec = _model_paths()
        _ENGINE = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_detection_model_dir=str(det),
            text_recognition_model_name="en_PP-OCRv5_mobile_rec",
            text_recognition_model_dir=str(rec),
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
        )
        return _ENGINE


def models_ready():
    try:
        _model_paths()
        return True
    except RuntimeError:
        return False


def analyze_receipt(image: Image.Image):
    """Return structured OCR-derived receipt fields and grocery line items."""
    rgb = image.convert("RGB")
    encoded = io.BytesIO()
    rgb.save(encoded, format="JPEG", quality=95)
    prepared = decode_and_preprocess(encoded.getvalue())
    results = _engine().predict(prepared)
    lines = []
    for result in results:
        payload = getattr(result, "json", {})
        if callable(payload):
            payload = payload()
        if isinstance(payload, str):
            payload = json.loads(payload)
        payload = payload.get("res", payload) if isinstance(payload, dict) else {}
        texts, scores = payload.get("rec_texts", []), payload.get("rec_scores", [])
        for index, text in enumerate(texts):
            text = str(text).strip()
            if text:
                lines.append({"text": text, "confidence": float(scores[index]) if index < len(scores) else None})

    # KitchenSync performs its own pantry/catalog matching after this response.
    parsed = parse_receipt(lines, catalogue=[])
    items = []
    for item in parsed["items"]:
        if not item.get("name"):
            continue
        confidence = item.get("ocr_confidence")
        if confidence is None:
            confidence = item.get("confidence")
        items.append({
            "raw_name": item["name"],
            "name": item["name"],
            "qty": item.get("quantity"),
            "unit": item.get("unit"),
            "price": item.get("total_price"),
            "confidence": confidence,
        })
    return {
        "items": items,
        "receipt": {
            "store": parsed.get("store"),
            "date": parsed.get("date"),
            "subtotal": parsed.get("subtotal"),
            "tax": parsed.get("tax"),
            "discount": parsed.get("discount"),
            "total_amount": parsed.get("total_amount"),
            "currency": parsed.get("currency"),
        },
    }


def extract_receipt_items(image: Image.Image):
    """Compatibility wrapper returning just the line items."""
    return analyze_receipt(image)["items"]
