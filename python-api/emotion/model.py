#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""طبقة تشغيل مودل المشاعر المحفوظ.

هذا الملف لا يدرب المودل، بل يقوم بـ:
- تحميل الـ pipeline الجاهز من القرص
- تحميل label encoder
- التحقق من عدد الخصائص المتوقع
- تنفيذ التنبؤ وإرجاع أعلى الاحتمالات
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np


PROJECT_DIR = Path(__file__).resolve().parents[1]
EMOTION_MODELS_DIR = PROJECT_DIR / "models" / "emotion"

PIPELINE_MODEL_PATH = EMOTION_MODELS_DIR / "emotion_model.pkl"
ENCODER_PATH = EMOTION_MODELS_DIR / "emotion_label_encoder.pkl"


class EmotionModule:
    """كائن بسيط يغلّف مودل المشاعر حتى يُستخدم بسهولة داخل الـ API."""

    def __init__(self):
        self.pipeline = None
        self.label_encoder = None
        self.expected_features = None

        # إذا كانت ملفات المودل موجودة نحملها فورًا.
        if PIPELINE_MODEL_PATH.is_file() and ENCODER_PATH.is_file():
            self.pipeline = joblib.load(PIPELINE_MODEL_PATH)
            self.label_encoder = joblib.load(ENCODER_PATH)
            self.expected_features = int(getattr(self.pipeline, "n_features_in_", 0))

    @property
    def loaded(self) -> bool:
        """هل المودل والـ encoder محمّلان بنجاح؟"""
        return self.pipeline is not None and self.label_encoder is not None

    def decode_label(self, value: int) -> str:
        """تحويل التصنيف الرقمي إلى اسم الفئة الحقيقي."""
        if self.label_encoder is None:
            raise RuntimeError("Emotion label encoder is not loaded")
        return str(self.label_encoder.inverse_transform([int(value)])[0])

    def predict_from_raw_vector(self, raw_vector) -> dict:
        """تشغيل التنبؤ على vector واحد خام مطابق لبيانات التدريب."""
        if not self.loaded:
            raise RuntimeError("Emotion module is not loaded")

        raw_vector = np.asarray(raw_vector, dtype=np.float32)
        if raw_vector.ndim != 1:
            raise ValueError("Emotion vector must be a 1D array")
        if self.expected_features and raw_vector.shape[0] != self.expected_features:
            raise ValueError(
                f"Emotion vector must contain {self.expected_features} features, got {raw_vector.shape[0]}"
            )

        # sklearn يتوقع دائمًا مصفوفة ثنائية الأبعاد حتى لو كانت عينة واحدة.
        vector_2d = raw_vector.reshape(1, -1)

        predicted_index = int(self.pipeline.predict(vector_2d)[0])
        probabilities = self.pipeline.predict_proba(vector_2d)[0]
        classes = [int(value) for value in self.pipeline.classes_]

        top_indices = np.argsort(probabilities)[-3:][::-1]
        top_classes = [classes[int(index)] for index in top_indices]
        winning_position = classes.index(int(predicted_index))

        return {
            "emotion": self.decode_label(predicted_index),
            "emotion_confidence": round(float(probabilities[winning_position]) * 100, 2),
            "emotion_confidence_raw": float(probabilities[winning_position]),
            "emotion_input_features": self.expected_features,
            "emotion_top_predictions": [
                {
                    "emotion": self.decode_label(label_value),
                    "confidence": round(float(probabilities[index]) * 100, 2),
                }
                for index, label_value in zip(top_indices, top_classes)
            ],
        }
