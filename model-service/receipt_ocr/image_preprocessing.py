"""CPU-only receipt image loading and preprocessing."""

import cv2
import numpy as np


MAX_IMAGE_SIDE = 2000


def decode_and_preprocess(encoded_image):
    raw = np.frombuffer(encoded_image, dtype=np.uint8)
    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("This image could not be read. Choose a clear JPG or PNG receipt photo.")
    height, width = image.shape[:2]
    if width < 200 or height < 200:
        raise ValueError("Receipt image is too small. Choose a photo at least 200 by 200 pixels.")
    longest = max(width, height)
    if longest > MAX_IMAGE_SIDE or longest < 1400:
        target = MAX_IMAGE_SIDE if longest > MAX_IMAGE_SIDE else 1400
        scale = target / longest
        interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
        image = cv2.resize(image, (round(width * scale), round(height * scale)), interpolation=interpolation)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
