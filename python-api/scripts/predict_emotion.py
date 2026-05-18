#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""سكربت مساعد لاختبار مودل المشاعر يدويًا.

يمكن استخدامه بثلاث طرق:
- أخذ sample جاهز من X.npy
- قراءة vector محفوظ من ملف
- استخراج vector من صورة أو فيديو ثم تشغيل المودل عليه
"""

import argparse
import sys
from pathlib import Path

import numpy as np

PROJECT_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from emotion import EmotionModule, extract_vector_from_media_path, load_feature_extractor

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

EMOTION_VECTORS_DIR = PROJECT_DIR / "models" / "emotion" / "vectors"
X_PATH = EMOTION_VECTORS_DIR / "X.npy"
Y_PATH = EMOTION_VECTORS_DIR / "y.npy"


def load_vector_from_file(path):
    """قراءة vector خام من ملف بصيغة npy أو csv/txt."""
    extension = Path(path).suffix.lower()
    if extension == ".npy":
        vector = np.load(path, allow_pickle=True)
    else:
        vector = np.loadtxt(path, delimiter=",")
    vector = np.asarray(vector, dtype=np.float32)
    if vector.ndim == 2:
        if vector.shape[0] != 1:
            raise ValueError("vector file must contain exactly one sample")
        vector = vector[0]
    if vector.ndim != 1:
        raise ValueError("vector file must contain a 1D feature vector")
    return vector


def main():
    """نقطة التشغيل الرئيسية للسكربت."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample-index", type=int, help="Use one sample from X.npy for a quick check")
    parser.add_argument("--vector-file", help="Path to a .npy or .csv/.txt file with one raw feature vector")
    parser.add_argument("--media-file", help="Path to one image or video file to auto-extract emotion features")
    args = parser.parse_args()

    if args.sample_index is None and not args.vector_file and not args.media_file:
        parser.error("provide --sample-index, --vector-file, or --media-file")

    # نحمل المودل المحفوظ حتى نستطيع تنفيذ التنبؤ.
    emotion_module = EmotionModule()
    if not emotion_module.loaded:
        raise RuntimeError("Emotion model files were not found")

    raw_vector = None
    true_label = None
    source = ""

    # نحدد مصدر الإدخال ثم نجهز vector خام مطابق لما يتوقعه المودل.
    if args.media_file:
        feature_extractor = load_feature_extractor()
        raw_vector = extract_vector_from_media_path(args.media_file, feature_extractor)
        source = args.media_file
    elif args.sample_index is not None:
        X = np.load(X_PATH, allow_pickle=True).astype(np.float32)
        y = np.load(Y_PATH, allow_pickle=True)
        if len(y.shape) > 1:
            y = y.ravel()
        if args.sample_index < 0 or args.sample_index >= len(X):
            raise IndexError(f"sample index out of range: {args.sample_index}")
        raw_vector = X[args.sample_index]
        true_label = emotion_module.decode_label(y[args.sample_index])
        source = f"X.npy[{args.sample_index}]"
    else:
        raw_vector = load_vector_from_file(args.vector_file)
        source = args.vector_file

    expected_features = int(emotion_module.expected_features or 0)
    if raw_vector.shape[0] != expected_features:
        raise ValueError(
            f"expected raw vector with {expected_features} features, got {raw_vector.shape[0]}"
        )

    # بعد تجهيز الـ vector يتم تشغيل المودل وإظهار أهم النتائج للمستخدم.
    result = emotion_module.predict_from_raw_vector(raw_vector)

    print(f"\nPrediction source: {source}")
    print(f"Raw feature count: {expected_features}")
    if true_label is not None:
        print(f"True label: {true_label}")
    print(f"Predicted emotion: {result['emotion']}")

    print("\nTop predictions:")
    for item in result["emotion_top_predictions"]:
        print(f"- {item['emotion']}: {item['confidence']:.2f}%")


if __name__ == "__main__":
    main()
