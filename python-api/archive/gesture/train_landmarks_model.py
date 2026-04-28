#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""سكربت مؤرشف لتدريب نسخة أقدم ومبسطة من مودل الإشارة.

المسار القديم هنا كان يعتمد على:
- MediaPipe Hands
- تطبيع إحداثيات اليد
- اختيار الجزء النشط
- بناء sequence ثابت
- StandardScaler + PCA + RBF SVM
"""

import json
import logging
import os
import pickle
import sys
from collections import Counter
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import mediapipe as mp
import numpy as np
from sklearn.decomposition import PCA
from sklearn.metrics import classification_report
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

try:
    from sklearn.model_selection import StratifiedGroupKFold
except ImportError:
    StratifiedGroupKFold = None

PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from gesture.features import (
    IMAGE_EXTENSIONS,
    MAX_NUM_HANDS,
    SEQUENCE_LENGTH,
    VIDEO_FEATURE_SIZE,
    augment_frame_sequence,
    build_video_feature,
    extract_frame_feature_from_image,
    read_image_file,
    select_evenly_spaced,
)

_stream_handler = logging.StreamHandler(sys.stdout)
try:
    _stream_handler.stream.reconfigure(encoding="utf-8")
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format="%(message)s", handlers=[_stream_handler])
logger = logging.getLogger(__name__)

DATA_DIR = PROJECT_DIR / "data"
ARTIFACTS_MODELS_DIR = PROJECT_DIR / "artifacts" / "models"
DEFAULT_EXTERNAL_DATA_ROOT = PROJECT_DIR.parent.parent / "signlang_external_data"


def resolve_frames_dataset_path() -> Path:
    """تحديد مسار frames_dataset من env أو من المسار الافتراضي."""
    env_value = os.getenv("SIGNLANG_FRAMES_DATASET_DIR")
    if env_value:
        return Path(env_value)

    external_root = os.getenv("SIGNLANG_EXTERNAL_DATA_ROOT")
    if external_root:
        return Path(external_root) / "frames_dataset"

    default_candidate = DEFAULT_EXTERNAL_DATA_ROOT / "frames_dataset"
    if default_candidate.exists():
        return default_candidate

    return DATA_DIR / "frames_dataset"


class Config:
    """إعدادات التدريب الخاصة بالنسخة المؤرشفة من مودل الإشارة."""

    DATASET_PATH = str(resolve_frames_dataset_path())
    OUTPUT_DIR = ARTIFACTS_MODELS_DIR
    MAX_NUM_HANDS = MAX_NUM_HANDS
    SEQUENCE_LENGTH = SEQUENCE_LENGTH
    FEATURE_SIZE = VIDEO_FEATURE_SIZE
    USE_PCA = True
    PCA_COMPONENTS = 64
    PCA_WHITEN = True
    SVM_C = 1.0
    SVM_KERNEL = "rbf"
    SVM_GAMMA = "scale"
    USE_GRID_SEARCH = True
    GRID_SEARCH_CV = 5
    GRID_SEARCH_JOBS = 1
    AUGMENT_TRAIN = False
    AUGMENTATION_COPIES = 0
    RANDOM_SEED = 42
    MIN_DETECTION_CONFIDENCE = 0.5
    MIN_TRACKING_CONFIDENCE = 0.5


config = Config()


def ensure_multiclass_targets(y_values, split_name):
    """التأكد أن البيانات تحتوي على أكثر من class واحد قبل التدريب."""
    unique_classes = np.unique(y_values)
    if len(unique_classes) < 2:
        raise ValueError(
            f"{split_name} must contain at least 2 classes, found {len(unique_classes)}."
        )


def resolve_grid_search_cv(y_values, requested_cv):
    """تحديد عدد folds مناسب حسب أقل عدد عينات موجود في أي class."""
    class_counts = Counter(int(v) for v in y_values.tolist())
    min_class_samples = min(class_counts.values()) if class_counts else 0
    effective_cv = min(requested_cv, min_class_samples)
    if effective_cv < 2:
        return None, min_class_samples
    return effective_cv, min_class_samples


def extract_video_sequence_from_dir(video_path, hands_detector):
    """استخراج sequence خصائص من مجلد صور يمثل فيديو واحدًا."""
    image_files = sorted(
        [
            os.path.join(video_path, fname)
            for fname in os.listdir(video_path)
            if fname.lower().endswith(IMAGE_EXTENSIONS)
        ]
    )
    if not image_files:
        return None, 0, 0

    frame_features = []
    skipped_frames = 0

    for img_path in image_files:
        img = read_image_file(img_path)
        if img is None:
            skipped_frames += 1
            continue
        frame_features.append(extract_frame_feature_from_image(img, hands_detector))

    if not frame_features:
        return None, 0, skipped_frames

    return np.asarray(frame_features, dtype=np.float32), len(frame_features), skipped_frames


def extract_landmarks_from_dataset(data_dir, hands_detector, augment_copies=0, rng=None):
    """استخراج feature vector واحد لكل فيديو داخل الـ dataset."""
    X_list = []
    y_list = []
    group_list = []
    class_names = sorted([d for d in os.listdir(data_dir) if os.path.isdir(os.path.join(data_dir, d))])
    class_to_idx = {class_name: idx for idx, class_name in enumerate(class_names)}
    total_videos = 0
    skipped_videos = 0
    total_frames = 0
    skipped_frames = 0
    next_group_id = 0

    for class_name in class_names:
        class_path = os.path.join(data_dir, class_name)
        class_count = 0
        for video_dir in sorted(os.listdir(class_path)):
            video_path = os.path.join(class_path, video_dir)
            if not os.path.isdir(video_path):
                continue

            sequence, used_frames, skipped_frame_count = extract_video_sequence_from_dir(video_path, hands_detector)
            total_frames += used_frames
            skipped_frames += skipped_frame_count

            if sequence is None:
                skipped_videos += 1
                continue

            feature = build_video_feature(sequence, config.SEQUENCE_LENGTH)
            if feature is None:
                skipped_videos += 1
                continue

            class_idx = class_to_idx[class_name]
            group_id = next_group_id
            next_group_id += 1
            X_list.append(feature)
            y_list.append(class_idx)
            group_list.append(group_id)

            if augment_copies > 0 and rng is not None:
                for _ in range(augment_copies):
                    augmented_sequence = augment_frame_sequence(sequence, rng)
                    augmented_feature = build_video_feature(augmented_sequence, config.SEQUENCE_LENGTH)
                    if augmented_feature is not None:
                        X_list.append(augmented_feature)
                        y_list.append(class_idx)
                        group_list.append(group_id)

            total_videos += 1
            class_count += 1

        logger.info("   %s: %d videos", class_name, class_count)

    if not X_list:
        return None, None, None, None, None, 0, 0, 0, 0

    X = np.vstack(X_list)
    y = np.array(y_list)
    groups = np.array(group_list)
    return X, y, groups, class_names, class_to_idx, total_videos, skipped_videos, total_frames, skipped_frames


def main():
    """تنفيذ مسار التدريب الكامل للنسخة المؤرشفة."""
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    train_root = os.path.join(config.DATASET_PATH, "train")
    val_root = os.path.join(config.DATASET_PATH, "val")

    if not os.path.isdir(train_root):
        logger.error("Dataset not found: %s", train_root)
        return

    logger.info("=" * 60)
    logger.info("MediaPipe Hands + PCA + RBF SVM")
    logger.info("=" * 60)
    logger.info("Dataset path: %s", config.DATASET_PATH)
    logger.info("Output path: %s", config.OUTPUT_DIR)
    logger.info("Sequence length: %d frames", config.SEQUENCE_LENGTH)
    logger.info("Feature size per video before PCA: %d", config.FEATURE_SIZE)

    mp_hands = mp.solutions.hands
    rng = np.random.default_rng(config.RANDOM_SEED)

    hands = mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=config.MAX_NUM_HANDS,
        min_detection_confidence=config.MIN_DETECTION_CONFIDENCE,
        min_tracking_confidence=config.MIN_TRACKING_CONFIDENCE,
    )

    logger.info("\nExtracting training landmark sequences...")
    X_train, y_train, train_groups, class_names, class_to_idx, total_videos, skipped_videos, total_frames, skipped_frames = (
        extract_landmarks_from_dataset(
            train_root,
            hands,
            augment_copies=config.AUGMENTATION_COPIES if config.AUGMENT_TRAIN else 0,
            rng=rng,
        )
    )
    hands.close()

    if X_train is None or len(X_train) == 0:
        logger.error("No training data found.")
        return

    ensure_multiclass_targets(y_train, "Training set")

    logger.info("Training videos: %d", total_videos)
    logger.info("Training frames used: %d", total_frames)
    logger.info("Training samples: %d", len(X_train))
    if skipped_videos:
        logger.info("Skipped videos: %d", skipped_videos)
    if skipped_frames:
        logger.info("Skipped frames: %d", skipped_frames)
    logger.info("Flattened feature size: %d", X_train.shape[1])

    # أول خطوة في التدريب: توحيد مقياس الخصائص.
    logger.info("\nFitting StandardScaler...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)

    pca = None
    X_train_features = X_train_scaled
    # PCA اختياري لتقليل الأبعاد قبل إدخالها إلى SVM.
    if config.USE_PCA:
        effective_pca_components = min(
            config.PCA_COMPONENTS,
            X_train_scaled.shape[0] - 1,
            X_train_scaled.shape[1],
        )
        if effective_pca_components < 1:
            logger.warning("Skipping PCA because there are not enough samples.")
        else:
            logger.info("\nFitting PCA...")
            pca = PCA(
                n_components=effective_pca_components,
                whiten=config.PCA_WHITEN,
                random_state=config.RANDOM_SEED,
            )
            X_train_features = pca.fit_transform(X_train_scaled)
            logger.info(
                "PCA: %d -> %d dims (%.2f%% variance)",
                X_train.shape[1],
                X_train_features.shape[1],
                pca.explained_variance_ratio_.sum() * 100,
            )

    # المصنف المستخدم هنا هو SVM بنواة RBF.
    logger.info("\nTraining SVM...")
    use_grid_search = config.USE_GRID_SEARCH
    grid_search_cv = config.GRID_SEARCH_CV

    if use_grid_search:
        effective_cv, min_class_samples = resolve_grid_search_cv(y_train, config.GRID_SEARCH_CV)
        if effective_cv is None:
            logger.warning(
                "Skipping GridSearchCV because the smallest class has only %d samples.",
                min_class_samples,
            )
            use_grid_search = False
        else:
            grid_search_cv = effective_cv
            if effective_cv != config.GRID_SEARCH_CV:
                logger.warning(
                    "Reducing GridSearchCV folds from %d to %d due to class counts.",
                    config.GRID_SEARCH_CV,
                    effective_cv,
                )

    if use_grid_search:
        param_grid = {
            "C": [0.3, 1, 3, 10],
            "gamma": ["scale", 0.1, 0.01, 0.001],
            "kernel": ["rbf"],
            "class_weight": ["balanced"],
        }
        if train_groups is not None and StratifiedGroupKFold is not None:
            cv_splitter = StratifiedGroupKFold(
                n_splits=grid_search_cv,
                shuffle=True,
                random_state=config.RANDOM_SEED,
            )
            search_fit_kwargs = {"groups": train_groups}
            logger.info("Using StratifiedGroupKFold to keep augmented copies in the same fold.")
        else:
            cv_splitter = StratifiedKFold(
                n_splits=grid_search_cv,
                shuffle=True,
                random_state=config.RANDOM_SEED,
            )
            search_fit_kwargs = {}
            logger.warning("Falling back to StratifiedKFold because StratifiedGroupKFold is unavailable.")
        search = GridSearchCV(
            SVC(probability=False, random_state=config.RANDOM_SEED),
            param_grid,
            cv=cv_splitter,
            n_jobs=config.GRID_SEARCH_JOBS,
            verbose=1,
            scoring="accuracy",
        )
        search.fit(X_train_features, y_train, **search_fit_kwargs)
        logger.info("Best SVM params: %s", search.best_params_)
        logger.info("Best cross-validation accuracy: %.4f", search.best_score_)
        svm = SVC(
            probability=True,
            random_state=config.RANDOM_SEED,
            **search.best_params_,
        )
        svm.fit(X_train_features, y_train)
    else:
        svm = SVC(
            C=config.SVM_C,
            kernel=config.SVM_KERNEL,
            gamma=config.SVM_GAMMA,
            probability=True,
            class_weight="balanced",
            random_state=config.RANDOM_SEED,
        )
        svm.fit(X_train_features, y_train)

    train_acc = svm.score(X_train_features, y_train)
    logger.info("Training accuracy: %.2f%%", train_acc * 100)

    if os.path.isdir(val_root):
        logger.info("\nExtracting validation landmark sequences...")
        hands_val = mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=config.MAX_NUM_HANDS,
            min_detection_confidence=config.MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=config.MIN_TRACKING_CONFIDENCE,
        )
        X_val, y_val, _, _, _, n_val, skipped_val_videos, val_frames, skipped_val_frames = (
            extract_landmarks_from_dataset(val_root, hands_val)
        )
        hands_val.close()

        if X_val is not None and len(X_val) > 0:
            X_val_scaled = scaler.transform(X_val)
            X_val_features = pca.transform(X_val_scaled) if pca is not None else X_val_scaled
            val_acc = svm.score(X_val_features, y_val)
            logger.info("Validation accuracy: %.2f%%", val_acc * 100)
            logger.info("Validation videos: %d, frames used: %d", n_val, val_frames)
            logger.info(
                "\nValidation report:\n%s",
                classification_report(
                    y_val,
                    svm.predict(X_val_features),
                    target_names=class_names,
                    zero_division=0,
                ),
            )
            if skipped_val_videos:
                logger.info("Skipped validation videos: %d", skipped_val_videos)
            if skipped_val_frames:
                logger.info("Skipped validation frames: %d", skipped_val_frames)

    labels = {int(idx): class_name for class_name, idx in class_to_idx.items()}
    labels_path = os.path.join(config.OUTPUT_DIR, "labels.json")
    landmarks_svm_path = os.path.join(config.OUTPUT_DIR, "landmarks_svm.pkl")
    landmarks_scaler_path = os.path.join(config.OUTPUT_DIR, "landmarks_scaler.pkl")
    landmarks_pca_path = os.path.join(config.OUTPUT_DIR, "landmarks_pca.pkl")

    with open(labels_path, "w", encoding="utf-8") as file_obj:
        json.dump(labels, file_obj, ensure_ascii=False, indent=2)
    with open(landmarks_svm_path, "wb") as file_obj:
        pickle.dump(svm, file_obj)
    with open(landmarks_scaler_path, "wb") as file_obj:
        pickle.dump(scaler, file_obj)
    if pca is not None:
        with open(landmarks_pca_path, "wb") as file_obj:
            pickle.dump(pca, file_obj)
    elif os.path.isfile(landmarks_pca_path):
        os.remove(landmarks_pca_path)

    logger.info("\n" + "=" * 60)
    logger.info("Saved model artifacts to: %s", config.OUTPUT_DIR)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
