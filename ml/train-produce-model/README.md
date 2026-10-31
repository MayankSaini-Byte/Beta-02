# Training a custom fruits & vegetables detector for KitchenSync

The app ships with **on-device detection that already works**: the browser runs
TensorFlow.js MobileNet (`frontend/index.html` loads it from CDN) and
`backend/src/routes/vision.routes.js` maps ImageNet labels to the KitchenSync
catalog (English + Hindi synonyms).

For noticeably better accuracy on **Indian produce** (bottle gourd, karela, tinda,
specific mango varieties...), train a custom classifier with the pipeline here and
swap it in.

## Pipeline

```
dataset/                  # ImageFolder layout
├── train/
│   ├── tomato/  *.jpg
│   ├── onion/   *.jpg
│   └── ...one folder per produce (name = catalog key)
└── val/
    ├── tomato/ ...
    └── ...

train.py            # 1) transfer learning + fine-tuning (Keras)
                    # 2) evaluation + confusion matrix
                    # 3) export to TensorFlow.js (models/produce-model/)
```

## Steps

```bash
pip install -r requirements.txt

# 1. Put your dataset in place (Fruits-360 on Kaggle works great as a base,
#    plus ~100-200 phone photos per Indian vegetable you add)
python train.py --data dataset --epochs 12 --finetune-epochs 6

# 2. Files land in models/produce-model/ (model.json + group1-shard*.bin)

# 3. Serve them from frontend/public/models/produce-model/ and in
#    frontend/src/pages/Scan.jsx replace:
#      window.mobilenet.load(...)
#    with:
#      await tf.loadLayersModel('/models/produce-model/model.json')
#    (a clearly marked TODO shows the exact spot)
```

Class names must match catalog **keys** (`tomato`, `onion`, `banana`, ...).

> **v3 note:** the Scan page now ships only the expiry-date checker and the
> receipt scanner, and the `/api/vision/*` routes were removed. If you revive
> produce detection, serve predictions through the model service contract in
> `model-service/` (add a `/produce` endpoint next to `/predict` and `/expiry`)
> and reuse `resolveCatalog()` from `backend/src/utils/text.js` for label
> mapping. The training pipeline itself is unchanged.
