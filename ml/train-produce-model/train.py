#!/usr/bin/env python3
"""
KitchenSync - custom produce classifier training (PS-5 "model training on
vegetable and fruits" requirement).

Transfer learning with MobileNetV2:
  1. Train a classification head on your produce dataset (ImageFolder layout).
  2. Optional fine-tuning of the last MobileNetV2 block.
  3. Export to TensorFlow.js so the React app can run it fully on-device.

Usage:
  python train.py --data dataset --epochs 12 --finetune-epochs 6 --out models/produce-model

Dataset layout (class folder name MUST equal the catalog key):
  dataset/train/tomato/*.jpg   dataset/val/tomato/*.jpg ...
"""
import argparse
import pathlib

import numpy as np
import tensorflow as tf

IMG_SIZE = 224
BATCH = 32


def build_datasets(data_dir: pathlib.Path):
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir / "train", image_size=(IMG_SIZE, IMG_SIZE), batch_size=BATCH, label_mode="categorical"
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir / "val", image_size=(IMG_SIZE, IMG_SIZE), batch_size=BATCH, label_mode="categorical"
    )
    class_names = train_ds.class_names
    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(autotune)
    val_ds = val_ds.prefetch(autotune)
    return train_ds, val_ds, class_names


def build_model(num_classes: int) -> tf.keras.Model:
    base = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3), include_top=False, weights="imagenet"
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs)


def fine_tune(model: tf.keras.Model, train_ds, val_ds, epochs: int):
    """Unfreeze the top block of MobileNetV2 and fine-tune with a low LR."""
    base = None
    for layer in model.layers:
        if isinstance(layer, tf.keras.Model) and layer.name.startswith("mobilenetv2"):
            base = layer
            break
    if base is None:
        print("(!) base model not found, skipping fine-tune")
        return

    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(train_ds, validation_data=val_ds, epochs=epochs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=pathlib.Path, default=pathlib.Path("dataset"))
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--finetune-epochs", type=int, default=6)
    ap.add_argument("--out", type=pathlib.Path, default=pathlib.Path("models/produce-model"))
    args = ap.parse_args()

    train_ds, val_ds, class_names = build_datasets(args.data)
    print(f"Classes ({len(class_names)}): {class_names}")

    aug = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.12),
            tf.keras.layers.RandomBrightness(0.12),
        ]
    )

    # Wrap augmentation into the datasets via map (deterministic enough for demo)
    train_aug = train_ds.map(lambda x, y: (aug(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)

    model = build_model(num_classes=len(class_names))
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="categorical_crossentropy", metrics=["accuracy"])

    callbacks = [
        tf.keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True, monitor="val_accuracy"),
        tf.keras.callbacks.ReduceLROnPlateau(patience=2, factor=0.4, monitor="val_loss"),
    ]

    print("== Stage 1: training classification head ==")
    model.fit(train_aug, validation_data=val_ds, epochs=args.epochs, callbacks=callbacks)

    if args.finetune_epochs > 0:
        print("== Stage 2: fine-tuning top MobileNetV2 block ==")
        fine_tune(model, train_aug, val_ds, args.finetune_epochs)

    print("== Evaluation ==")
    loss, acc = model.evaluate(val_ds)
    print(f"val_loss={loss:.4f} val_accuracy={acc:.4f}")

    args.out.mkdir(parents=True, exist_ok=True)
    keras_path = args.out / "produce.keras"
    model.save(keras_path)
    with open(args.out / "labels.txt", "w") as f:
        f.write("\n".join(class_names))

    print("== Exporting to TensorFlow.js ==")
    try:
        import tensorflowjs as tfjs  # pip install tensorflowjs

        tfjs.converters.save_keras_model(model, str(args.out))
        print(f"TFJS model written to {args.out}/ (model.json + shards)")
    except ImportError:
        print("tensorflowjs not installed - run:  pip install tensorflowjs")
        print("then: tensorflowjs_converter --input_format=keras "
              f"{keras_path} {args.out}")

    print("\nDeploy: copy this folder to frontend/public/models/produce-model and")
    print("swap the loader in frontend/src/pages/Scan.jsx (marked TODO).")


if __name__ == "__main__":
    main()
