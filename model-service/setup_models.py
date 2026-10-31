"""Download the official PP-OCRv5 mobile models once for offline local scans."""

from receipt_ocr.engine import _engine


if __name__ == "__main__":
    print("Downloading the pretrained PaddleOCR mobile CPU models. This setup step needs internet once.")
    _engine(allow_download=True)
    print("Models are cached locally. Receipt scans can now run without internet.")
