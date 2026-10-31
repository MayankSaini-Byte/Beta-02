FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY model_service.py setup_models.py ./
COPY receipt_ocr ./receipt_ocr
ENV RECEIPT_MODEL_DIR=/models/.receipt-models
EXPOSE 8000
CMD ["uvicorn", "model_service:app", "--host", "0.0.0.0", "--port", "8000"]
