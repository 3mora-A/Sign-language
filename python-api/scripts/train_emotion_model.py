#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تدريب مودل المشاعر من vectors مجهزة مسبقًا.

الملف يعتمد على:
- X.npy كمصفوفة خصائص
- y.npy كتسميات

ثم ينفذ:
- Label Encoding
- تقسيم train/test
- StandardScaler
- PCA اختياري
- SVM للتصنيف
- حفظ ملفات المودل والتقارير
"""

import json
import logging
import os
import sys
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from sklearn.decomposition import PCA
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

_stream_handler = logging.StreamHandler(sys.stdout)
try:
    _stream_handler.stream.reconfigure(encoding="utf-8")
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format="%(message)s", handlers=[_stream_handler])
logger = logging.getLogger(__name__)

PROJECT_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

EMOTION_MODELS_DIR = PROJECT_DIR / "models" / "emotion"
EMOTION_VECTORS_DIR = EMOTION_MODELS_DIR / "vectors"


class Config:
    """إعدادات التدريب الخاصة بمودل المشاعر."""

    X_PATH = os.path.join(EMOTION_VECTORS_DIR, "X.npy")
    Y_PATH = os.path.join(EMOTION_VECTORS_DIR, "y.npy")
    LABEL_MAP_PATH = os.path.join(EMOTION_VECTORS_DIR, "emotion_label_map.json")
    TEST_SIZE = 0.2
    RANDOM_SEED = 42
    USE_PCA = False
    PCA_COMPONENTS = 256
    PCA_WHITEN = True
    SVM_C = 10.0
    SVM_KERNEL = "rbf"
    SVM_GAMMA = "scale"
    SVM_PROBABILITY = True
    SVM_CLASS_WEIGHT = "balanced"
    LABELS_FILENAME = "emotion_labels.json"
    PIPELINE_MODEL_FILENAME = "emotion_model.pkl"
    ENCODER_FILENAME = "emotion_label_encoder.pkl"
    REPORT_FILENAME = "emotion_training_report.json"
    SPLIT_FILENAME = "emotion_test_split.npz"


config = Config()


def load_arrays():
    """تحميل مصفوفات التدريب والتحقق من سلامتها الأساسية."""
    if not os.path.isfile(config.X_PATH):
        raise FileNotFoundError(f"Missing vectors file: {config.X_PATH}")
    if not os.path.isfile(config.Y_PATH):
        raise FileNotFoundError(f"Missing labels file: {config.Y_PATH}")

    X = np.load(config.X_PATH, allow_pickle=True)
    y = np.load(config.Y_PATH, allow_pickle=True)

    if len(X.shape) != 2:
        raise ValueError(f"Expected X to be 2D, got shape {X.shape}")

    if len(y.shape) > 1:
        y = y.ravel()

    if len(X) != len(y):
        raise ValueError(f"X and y row counts do not match: {len(X)} != {len(y)}")

    if not np.issubdtype(X.dtype, np.number):
        raise ValueError(f"X must be numeric, got dtype {X.dtype}")

    X = X.astype(np.float32, copy=False)

    if np.isnan(X).any():
        raise ValueError("X contains NaN values")

    return X, y


def normalize_label_key(label):
    """توحيد شكل label حتى نستطيع مطابقته مع label map."""
    if isinstance(label, np.generic):
        label = label.item()
    if isinstance(label, (int, np.integer)):
        return str(int(label))
    if isinstance(label, (float, np.floating)) and float(label).is_integer():
        return str(int(label))
    return str(label)


def load_label_map(unique_labels):
    """تحميل خريطة labels الرقمية إلى أسماء المشاعر الحقيقية."""
    fallback_map = {normalize_label_key(label): str(normalize_label_key(label)) for label in unique_labels}

    if not os.path.isfile(config.LABEL_MAP_PATH):
        logger.warning(
            "No emotion label map found at %s. Using numeric labels for now.",
            config.LABEL_MAP_PATH,
        )
        return fallback_map

    with open(config.LABEL_MAP_PATH, "r", encoding="utf-8") as file_obj:
        raw_map = json.load(file_obj)

    normalized_map = {str(key): str(value) for key, value in raw_map.items()}

    missing = [normalize_label_key(label) for label in unique_labels if normalize_label_key(label) not in normalized_map]
    if missing:
        raise ValueError(
            f"emotion_label_map.json is missing labels for: {missing}"
        )

    return normalized_map

def main():
    """تنفيذ مسار التدريب الكامل لمودل المشاعر."""
    os.makedirs(EMOTION_MODELS_DIR, exist_ok=True)

    logger.info("=" * 60)
    logger.info("Emotion vectors -> SVM")
    logger.info("=" * 60)
    logger.info("Vectors path: %s", config.X_PATH)
    logger.info("Labels path: %s", config.Y_PATH)

    # نقرأ بيانات التدريب الخام.
    X, y = load_arrays()
    unique_labels = np.unique(y)
    label_map = load_label_map(unique_labels)
    semantic_y = np.asarray([label_map[normalize_label_key(label)] for label in y], dtype=object)
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(semantic_y)
    target_names = label_encoder.classes_.tolist()

    logger.info("X shape: %s", X.shape)
    logger.info("y shape: %s", y.shape)
    logger.info("Classes: %s", target_names)
    logger.info("Counts: %s", dict(Counter(semantic_y.tolist())))

    # نقسم البيانات مع الحفاظ على التوازن بين الفئات.
    indices = np.arange(len(X))
    train_indices, test_indices = train_test_split(
        indices,
        test_size=config.TEST_SIZE,
        random_state=config.RANDOM_SEED,
        stratify=y_encoded,
    )

    X_train = X[train_indices]
    X_test = X[test_indices]
    y_train = y_encoded[train_indices]
    y_test = y_encoded[test_indices]

    logger.info("\nFitting StandardScaler...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    pca = None
    X_train_features = X_train_scaled
    X_test_features = X_test_scaled
    # PCA اختياري لتقليل الأبعاد إذا كان مفعلًا في الإعدادات.
    if config.USE_PCA:
        effective_components = min(
            config.PCA_COMPONENTS,
            X_train_scaled.shape[0] - 1,
            X_train_scaled.shape[1],
        )
        if effective_components >= 1:
            logger.info("Fitting PCA with %d components...", effective_components)
            pca = PCA(
                n_components=effective_components,
                whiten=config.PCA_WHITEN,
                random_state=config.RANDOM_SEED,
            )
            X_train_features = pca.fit_transform(X_train_scaled)
            X_test_features = pca.transform(X_test_scaled)
            logger.info(
                "PCA retained variance: %.4f",
                float(np.sum(pca.explained_variance_ratio_)),
            )

    # المصنف النهائي المستخدم هنا هو SVM بنواة RBF.
    logger.info("Training SVM...")
    svm = SVC(
        C=config.SVM_C,
        kernel=config.SVM_KERNEL,
        gamma=config.SVM_GAMMA,
        probability=config.SVM_PROBABILITY,
        class_weight=config.SVM_CLASS_WEIGHT,
        random_state=config.RANDOM_SEED,
    )
    svm.fit(X_train_features, y_train)

    y_pred = svm.predict(X_test_features)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(
        y_test,
        y_pred,
        labels=np.arange(len(target_names)),
        target_names=target_names,
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(y_test, y_pred, labels=np.arange(len(target_names)))

    logger.info("\nAccuracy: %.4f", accuracy)
    logger.info("\nClassification report:\n%s", classification_report(
        y_test,
        y_pred,
        labels=np.arange(len(target_names)),
        target_names=target_names,
        zero_division=0,
    ))
    logger.info("Confusion matrix:\n%s", matrix)

    labels_path = os.path.join(EMOTION_MODELS_DIR, config.LABELS_FILENAME)
    pipeline_model_path = os.path.join(EMOTION_MODELS_DIR, config.PIPELINE_MODEL_FILENAME)
    encoder_path = os.path.join(EMOTION_MODELS_DIR, config.ENCODER_FILENAME)
    report_path = os.path.join(EMOTION_MODELS_DIR, config.REPORT_FILENAME)
    split_path = os.path.join(EMOTION_MODELS_DIR, config.SPLIT_FILENAME)

    with open(labels_path, "w", encoding="utf-8") as file_obj:
        json.dump(
            {str(index): label for index, label in enumerate(target_names)},
            file_obj,
            ensure_ascii=False,
            indent=2,
        )

    # نحفظ pipeline كاملة حتى يصبح الاستدلال لاحقًا أبسط وأكثر أمانًا.
    pipeline_steps = [("scaler", scaler)]
    if pca is not None:
        pipeline_steps.append(("pca", pca))
    pipeline_steps.append(("clf", svm))
    emotion_pipeline = Pipeline(pipeline_steps)

    joblib.dump(emotion_pipeline, pipeline_model_path)
    joblib.dump(label_encoder, encoder_path)

    for legacy_filename in ("emotion_svm.pkl", "emotion_scaler.pkl", "emotion_pca.pkl"):
        legacy_path = os.path.join(EMOTION_MODELS_DIR, legacy_filename)
        if os.path.isfile(legacy_path):
            os.remove(legacy_path)

    with open(report_path, "w", encoding="utf-8") as file_obj:
        json.dump(
            {
                "accuracy": accuracy,
                "classes": target_names,
                "label_map": {str(index): label for index, label in enumerate(target_names)},
                "confusion_matrix": matrix.tolist(),
                "report": report,
                "x_shape": list(X.shape),
                "input_features": int(X.shape[1]),
                "pca_components": int(pca.n_components_) if pca is not None else None,
                "train_size": int(len(X_train)),
                "test_size": int(len(X_test)),
                "pipeline_model": os.path.basename(pipeline_model_path),
                "label_encoder": os.path.basename(encoder_path),
            },
            file_obj,
            ensure_ascii=False,
            indent=2,
        )

    np.savez(split_path, train_indices=train_indices, test_indices=test_indices)

    logger.info("\nSaved:")
    logger.info("- %s", labels_path)
    logger.info("- %s", pipeline_model_path)
    logger.info("- %s", encoder_path)
    logger.info("- %s", report_path)
    logger.info("- %s", split_path)


if __name__ == "__main__":
    main()
