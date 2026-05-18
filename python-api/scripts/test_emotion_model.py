#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""اختبار مودل المشاعر المحفوظ على نفس hold-out split الخاص بالتدريب."""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

PROJECT_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

EMOTION_MODELS_DIR = PROJECT_DIR / "models" / "emotion"
EMOTION_VECTORS_DIR = EMOTION_MODELS_DIR / "vectors"

X_PATH = EMOTION_VECTORS_DIR / "X.npy"
Y_PATH = EMOTION_VECTORS_DIR / "y.npy"
MODEL_PATH = EMOTION_MODELS_DIR / "emotion_model.pkl"
LABELS_PATH = EMOTION_MODELS_DIR / "emotion_labels.json"
SPLIT_PATH = EMOTION_MODELS_DIR / "emotion_test_split.npz"

TEST_SIZE = 0.2
RANDOM_SEED = 42
PREVIEW_ROWS = 20

def load_arrays():
    """تحميل X و y من ملفات البيانات الأصلية."""
    X = np.load(X_PATH, allow_pickle=True).astype(np.float32)
    y = np.load(Y_PATH, allow_pickle=True)
    if len(y.shape) > 1:
        y = y.ravel()
    return X, y


def load_label_map():
    """تحميل خريطة labels النصية إن كانت موجودة."""
    if not LABELS_PATH.is_file():
        return {}
    with open(LABELS_PATH, "r", encoding="utf-8") as file_obj:
        raw_map = json.load(file_obj)
    return {int(key): str(value) for key, value in raw_map.items()}


def decode_label(label_map, value):
    """تحويل رقم الفئة إلى اسمها النصي."""
    return label_map.get(int(value), str(value))


def load_test_indices(y):
    """تحميل test split المحفوظ أو إعادة إنشائه بنفس الإعدادات القديمة."""
    if SPLIT_PATH.is_file():
        split = np.load(SPLIT_PATH)
        return split["test_indices"]

    indices = np.arange(len(y))
    _, test_indices = train_test_split(
        indices,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=y,
    )
    return test_indices


def main():
    """تنفيذ تقييم المودل وعرض النتائج على الطرفية."""
    X, y = load_arrays()
    label_map = load_label_map()

    model = joblib.load(MODEL_PATH)

    test_indices = load_test_indices(y)
    X_test = X[test_indices]
    y_test = y[test_indices]

    y_pred = model.predict(X_test)

    unique_labels = np.unique(y)
    target_names = [decode_label(label_map, label) for label in unique_labels]

    print("\nHold-out test set evaluation")
    print("=" * 40)
    print(f"X shape: {X.shape}")
    print(f"Test size: {len(X_test)}")
    print(f"Input features: {X.shape[1]}")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred, labels=unique_labels))
    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            y_pred,
            labels=unique_labels,
            target_names=target_names,
            zero_division=0,
        )
    )

    print("\nSample predictions:")
    for index in range(min(PREVIEW_ROWS, len(test_indices))):
        sample_id = int(test_indices[index])
        print(
            f"sample[{sample_id}] "
            f"true={decode_label(label_map, y_test[index])} "
            f"pred={decode_label(label_map, y_pred[index])}"
        )


if __name__ == "__main__":
    main()
