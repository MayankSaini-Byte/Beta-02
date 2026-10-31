"""Rule-based receipt parsing: preserve unknown values and flag uncertain rows."""

from datetime import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NUMBER = r"(?:\d+[,.]?\d*|[,.]\d+)"
UNIT_RE = re.compile(r"\b(lbs?|lb|fl\s*oz|millilitres?|milliliters?|litres?|liters?|kgs?|kg|gms?|gm|g|ml|ltr|l|oz|pcs?|nos?|ct|count|ea|each|pkt|packets?|packs?|boxes?)\b", re.I)
HEADER_RE = re.compile(r"\b(sub\s*total|subtotal|grand\s*total|total|tax|gst|cgst|sgst|igst|discount|savings|change\s+due|tend|cashier|invoice|receipt|bill\s*no|date|time|item\s*count|thank\s*you|thanks)\b", re.I)
DATE_RE = re.compile(r"\b(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})\b")
PRICE_RE = re.compile(rf"(?:₹|INR\s*)?({NUMBER})\s*(?:TFA|TAX|TAXABLE)?\s*$", re.I)
CONTINUATION_RE = re.compile(rf"^\s*({NUMBER})\s*(?:E?A|EACH|PCS?)\s*[@©]\s*(?:₹\s*)?({NUMBER})\s*/\s*(?:E?A|EACH)\b", re.I)


def number(value):
    try:
        text = str(value).replace(",", "")
        return float(text) if text else None
    except (TypeError, ValueError):
        return None


def normalize_unit(unit):
    normalized = re.sub(r"\s+", "", str(unit or "").lower())
    if normalized in {"kg", "kgs"}: return "kg"
    if normalized in {"g", "gm", "gms"}: return "g"
    if normalized in {"l", "ltr", "litre", "litres", "liter", "liters"}: return "L"
    if normalized in {"ml", "millilitre", "millilitres", "milliliter", "milliliters"}: return "ml"
    if normalized in {"pc", "pcs", "no", "nos", "ct", "count", "ea", "each", "pkt", "packet", "packets", "pack", "packs", "box", "boxes"}: return "pcs"
    return None


def convert_measure(quantity, source_unit):
    value = number(quantity)
    if value is None:
        return None, None
    raw = re.sub(r"\s+", " ", str(source_unit).lower()).strip()
    if raw in {"lb", "lbs"}:
        return round(value * 0.45359237, 4), "kg"
    if raw == "oz":
        return round(value * 28.349523125, 2), "g"
    if raw in {"fl oz", "floz"}:
        return round(value * 29.5735295625, 2), "ml"
    unit = normalize_unit(raw)
    if unit is None:
        return None, None
    return value, unit


def product_catalogue():
    try:
        return json.loads((ROOT / "public" / "catalogue.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


def match_product(name, catalogue):
    folded = re.sub(r"[^a-z0-9]+", " ", name.casefold()).strip()
    best, score = None, 0.0
    for product in catalogue:
        for candidate in [product.get("name", ""), *product.get("aliases", [])]:
            target = re.sub(r"[^a-z0-9]+", " ", candidate.casefold()).strip()
            if not target:
                continue
            if folded == target:
                return product, 1.0
            if folded in target or target in folded:
                ratio = min(len(folded), len(target)) / max(len(folded), len(target))
                if ratio > score:
                    best, score = product, ratio
            else:
                from difflib import SequenceMatcher
                ratio = SequenceMatcher(None, folded, target).ratio()
                if ratio > score:
                    best, score = product, ratio
    return (best, score) if score >= 0.68 else (None, score)


def _money(text):
    return number(text.replace("₹", "").replace("INR", "").strip())


def _trailing_price(line):
    match = re.search(rf"(?:[$₹]\s*|INR\s*)?({NUMBER})\s*(?:TFA|TAX|TAXABLE)?\s*$", line, re.I)
    if not match:
        return None, None
    evidence = match.group(0)
    numeric_text = match.group(1)
    if not re.search(r"[$₹]|\bINR\b|\bTFA\b|\bTAX(?:ABLE)?\b", evidence, re.I) and not re.search(r"[.,]\d{1,2}$", numeric_text):
        return None, None
    return match, _money(match.group(1))


def parse_receipt(lines, catalogue=None):
    catalogue = product_catalogue() if catalogue is None else catalogue
    text_lines = [item.get("text", "") if isinstance(item, dict) else str(item) for item in lines]
    line_scores = {item.get("text", "").strip(): float(item["confidence"]) for item in lines if isinstance(item, dict) and item.get("confidence") is not None}
    source_lines = [line.strip() for line in text_lines if line.strip()]
    normalized = []
    index = 0
    while index < len(source_lines):
        line = source_lines[index]
        continuation_price = index + 1 < len(source_lines) and re.match(rf"^\s*[@©]\s*(?:₹\s*)?{NUMBER}\s*/\s*(?:E?A|EACH)\b", source_lines[index + 1], re.I)
        if re.fullmatch(rf"\s*{NUMBER}\s*(?:E?A|EACH|PCS?)\s*", line, re.I) and continuation_price:
            line = line + " " + source_lines[index + 1]
            index += 1
        if re.fullmatch(r"\s*(?:sub\s*total|subtotal|grand\s*total|total|tax|gst|cgst|sgst|igst|discount|savings|amount\s+due)\s*", line, re.I) and index + 1 < len(source_lines):
            next_money = re.fullmatch(rf"\s*(?:[$₹]\s*|INR\s*)?{NUMBER}\s*(?:TFA|TAX|TAXABLE)?\s*", source_lines[index + 1], re.I)
            if next_money:
                line = line + " " + source_lines[index + 1]
                index += 1
        price_only = index + 1 < len(source_lines) and re.fullmatch(rf"\s*(?:[$₹]\s*|INR\s*)?{NUMBER}\s*(?:TFA|TAX|TAXABLE)?\s*", source_lines[index + 1], re.I)
        if index + 1 < len(source_lines) and not HEADER_RE.search(line) and _trailing_price(line)[1] is None and price_only and not CONTINUATION_RE.match(source_lines[index + 1]):
            line = line + " " + source_lines[index + 1]
            index += 1
        normalized.append(line)
        index += 1
    output, tax, discount, total, subtotal, store, receipt_date = [], None, None, None, None, None, None
    for index, line in enumerate(normalized):
        low = line.casefold()
        money_match, value = _trailing_price(line)
        if re.search(r"\b(grand\s*total|total\s+amount|amount\s+due|balance\s+due|total)\b", low) and value is not None:
            total = value
        elif re.search(r"\bsub\s*total\b", low) and value is not None:
            subtotal = value
        elif re.search(r"\b(tax|gst|cgst|sgst|igst)\b", low) and value is not None:
            tax = (tax or 0) + value
        elif re.search(r"\b(discount|savings)\b", low) and value is not None:
            discount = (discount or 0) + value
        if receipt_date is None:
            date_match = DATE_RE.search(line)
            if date_match:
                raw = date_match.group(1)
                for pattern in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%y", "%d/%m/%y"):
                    try:
                        receipt_date = datetime.strptime(raw, pattern).date().isoformat()
                        break
                    except ValueError:
                        continue
        if store is None and index < 5 and not HEADER_RE.search(line) and not re.search(r"\d{3,}", line) and len(line) > 2:
            store = line[:100]
        if HEADER_RE.search(line) or re.search(r"\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b", line, re.I):
            continue
        continuation = CONTINUATION_RE.match(line)
        if continuation and output:
            quantity = number(continuation.group(1))
            output[-1]["quantity"], output[-1]["unit"] = quantity, "pcs"
            unit_price = number(continuation.group(2))
            if output[-1]["total_price"] is None and unit_price is not None:
                output[-1]["total_price"] = round(quantity * unit_price, 2)
            elif unit_price is not None:
                output[-1]["unit_price"] = unit_price
            continue
        if not money_match or value is None:
            continue
        item_text = line[:money_match.start()].strip(" $₹-\t")
        if not item_text:
            continue
        count_match = re.match(rf"^\s*({NUMBER})\s*[x×]\s*", item_text, re.I)
        package_count = number(count_match.group(1)) if count_match else None
        if count_match:
            item_text = item_text[count_match.end():]
        measure_match = re.search(rf"\(?\s*({NUMBER})\s*(lbs?|lb|fl\s*oz|millilitres?|milliliters?|litres?|liters?|kgs?|kg|gms?|gm|g|ml|ltr|l|oz|pcs?|nos?|ct|count|ea|each|pkt|packets?|packs?|boxes?)\b\s*\)?", item_text, re.I)
        quantity, unit = package_count, "pcs" if package_count is not None else None
        if measure_match:
            quantity, unit = convert_measure(measure_match.group(1), measure_match.group(2))
            if package_count is not None and quantity is not None:
                quantity = round(quantity * package_count, 4)
            item_text = item_text[:measure_match.start()] + " " + item_text[measure_match.end():]
        product, confidence = match_product(item_text, catalogue)
        ocr_confidence = line_scores.get(line)
        if ocr_confidence is not None:
            confidence = min(confidence, ocr_confidence)
        name = product.get("name") if product else re.sub(r"\s+", " ", item_text).strip(" -:*")
        if not name:
            continue
        explicit_count = package_count is not None or measure_match is not None
        output.append({
            "name": name,
            "quantity": quantity,
            "unit": unit,
            "unit_price": None,
            "total_price": round(value, 2),
            "confidence": round(confidence, 3),
            "ocr_confidence": round(ocr_confidence, 3) if ocr_confidence is not None else None,
            "needs_review": confidence < 0.72 or not explicit_count or (ocr_confidence is not None and ocr_confidence < 0.82),
            "category": product.get("category", "Other") if product else "Other",
            "source_text": line,
        })
    # Merge repeated normalized products; prices and amounts remain traceable in the item sum.
    merged = []
    for item in output:
        prior = next((entry for entry in merged if entry["name"].casefold() == item["name"].casefold() and entry["unit"] == item["unit"] and item["unit"] is not None), None)
        if prior:
            prior["quantity"] = (prior["quantity"] or 0) + (item["quantity"] or 0)
            prior["total_price"] = round((prior["total_price"] or 0) + (item["total_price"] or 0), 2)
            prior["confidence"] = min(prior["confidence"], item["confidence"])
            prior["needs_review"] = prior["needs_review"] or item["needs_review"]
            prior["source_text"] += " | " + item["source_text"]
        else:
            merged.append(item)
    return {
        "store": store,
        "date": receipt_date,
        "items": merged,
        "subtotal": round(subtotal, 2) if subtotal is not None else None,
        "tax": round(tax, 2) if tax is not None else None,
        "discount": round(discount, 2) if discount is not None else None,
        "total_amount": round(total, 2) if total is not None else None,
        "currency": "INR" if any("₹" in line or "INR" in line.upper() for line in normalized) else "USD" if any("$" in line for line in normalized) else None,
        "raw_text": "\n".join(normalized),
    }
