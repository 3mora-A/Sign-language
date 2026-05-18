#!/usr/bin/env python3
# -*- coding: utf-8 -*-


# صورة أو فيديو
# ↓
# اختيار/تجهيز frame
# ↓
# تحسين الصورة وإزالة الخلفية أحيانًا
# ↓
# إدخال الصورة إلى EfficientNet-B0
# ↓
# استخراج feature vector
# ↓
# إرسال vector إلى EmotionModule للتنبؤ




from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, List

import cv2
import mediapipe as mp
import numpy as np
import torch
from PIL import Image
from torchvision import models, transforms


# ثوابت خاصة بتجهيز الصور واختيار الإطارات المناسبة من الفيديو.
IMG_SIZE = 224
DEFAULT_NUM_FRAMES = 10
DEFAULT_OUTPUT_FRAMES = 1
BRIGHT_THRESHOLD = 235
DARK_THRESHOLD = 15
MIN_SHARPNESS = 50.0
CLAHE_CLIP_LIMIT = 1.5
UNSHARP_SIGMA = 1.0
UNSHARP_STRENGTH = 0.35
PROJECT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_TORCH_HOME = PROJECT_DIR / "runtime" / "torch"


def load_feature_extractor(device: str = "cpu"):
    """تحميل EfficientNet-B0 كـ feature extractor فقط بدون classifier."""
    os.environ.setdefault("TORCH_HOME", str(DEFAULT_TORCH_HOME))
    weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1
    model = models.efficientnet_b0(weights=weights)
    model.classifier = torch.nn.Identity()
    model = model.to(device)
    model.eval()

    preprocess = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    return {
        "model": model,
        "device": device,
        "preprocess": preprocess,
    }


def read_image_unicode(path: Path):
    """قراءة صورة حتى لو كان مسارها يحتوي على أحرف غير إنجليزية."""
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
        if data.size == 0:
            return None
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception:
        return None


def sharpness_score(gray: np.ndarray) -> float:
    """قياس تقريبي لحدة الصورة باستخدام تباين Laplacian."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def is_bad_frame(gray: np.ndarray) -> bool:
    """استبعاد الإطارات شديدة السطوع أو شديدة الظلام أو غير الواضحة."""
    mean_val = float(np.mean(gray))
    if mean_val > BRIGHT_THRESHOLD or mean_val < DARK_THRESHOLD:
        return True
    if sharpness_score(gray) < MIN_SHARPNESS:
        return True
    return False


def motion_score(prev_gray: np.ndarray, curr_gray: np.ndarray) -> float:
    """قياس مقدار التغير بين frame والـ frame التالي."""
    diff = cv2.absdiff(curr_gray, prev_gray).astype(np.float32)
    return float(np.mean(diff))


def enhance_image_natural(image_bgr: np.ndarray) -> np.ndarray:
    """تحسين خفيف للصورة مع الحفاظ على شكل طبيعي قدر الإمكان."""
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    lab = cv2.merge((l_channel, a_channel, b_channel))
    result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    blurred = cv2.GaussianBlur(result, (0, 0), UNSHARP_SIGMA)
    result = cv2.addWeighted(
        src1=result,
        alpha=1.0 + UNSHARP_STRENGTH,
        src2=blurred,
        beta=-UNSHARP_STRENGTH,
        gamma=0,
    )
    return np.clip(result, 0, 255).astype(np.uint8)


def apply_background_removal(frame_bgr: np.ndarray, segmenter) -> np.ndarray:
    """إزالة الخلفية باستخدام MediaPipe واستبدالها بخلفية بيضاء."""
    frame_bgr = cv2.resize(frame_bgr, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    result = segmenter.process(rgb_frame)
    mask = getattr(result, "segmentation_mask", None)
    if mask is None:
        return frame_bgr

    condition = mask > 0.5
    mask_3ch = np.stack((condition, condition, condition), axis=-1)
    background = np.ones(frame_bgr.shape, dtype=np.uint8) * 255
    return np.where(mask_3ch, frame_bgr, background)


def prepare_frame_for_feature(frame_rgb: np.ndarray, feature_extractor) -> np.ndarray:
    """تحويل frame واحد إلى vector خصائص باستخدام EfficientNet-B0."""
    image = Image.fromarray(frame_rgb.astype(np.uint8))
    tensor = feature_extractor["preprocess"](image).unsqueeze(0).to(feature_extractor["device"])
    with torch.no_grad():
        outputs = feature_extractor["model"](tensor)
    return outputs.squeeze(0).detach().cpu().numpy().astype(np.float32)


def extract_vector_from_prepared_frames(frames: Iterable[np.ndarray], feature_extractor) -> np.ndarray:
    """دمج عدة frames في vector واحد عبر أخذ متوسط الـ feature vectors."""
    prepared = [frame for frame in frames if frame is not None]
    if not prepared:
        raise ValueError("No valid frames were available for emotion extraction")

    vectors = [prepare_frame_for_feature(frame, feature_extractor) for frame in prepared]
    return np.mean(np.asarray(vectors, dtype=np.float32), axis=0).astype(np.float32)


def extract_vector_from_image_path(image_path: Path | str, feature_extractor) -> np.ndarray:
    """استخراج vector من صورة واحدة."""
    image_path = Path(image_path)
    image_bgr = read_image_unicode(image_path)
    if image_bgr is None:
        raise ValueError(f"Could not read image: {image_path}")
    image_rgb = cv2.cvtColor(cv2.resize(image_bgr, (IMG_SIZE, IMG_SIZE)), cv2.COLOR_BGR2RGB)
    return extract_vector_from_prepared_frames([image_rgb], feature_extractor)


def sample_evenly_spaced(items: List, max_items: int) -> List:
    """اختيار عناصر موزعة بالتساوي من قائمة أطول."""
    if not items:
        return []
    if len(items) <= max_items:
        return list(items)
    indices = np.linspace(0, len(items) - 1, num=max_items, dtype=int)
    return [items[int(index)] for index in indices]


def extract_vector_from_frame_paths(
    frame_paths: Iterable[Path | str],
    feature_extractor,
    num_frames: int = DEFAULT_OUTPUT_FRAMES,
) -> np.ndarray:
    """قراءة مجموعة صور Frames وتحويلها إلى vector موحد."""
    frame_paths = [Path(path) for path in frame_paths]
    selected_paths = sample_evenly_spaced(sorted(frame_paths), max(1, num_frames))
    prepared_frames = []
    for frame_path in selected_paths:
        frame_bgr = read_image_unicode(frame_path)
        if frame_bgr is None:
            continue
        frame_rgb = cv2.cvtColor(cv2.resize(frame_bgr, (IMG_SIZE, IMG_SIZE)), cv2.COLOR_BGR2RGB)
        prepared_frames.append(frame_rgb)
    return extract_vector_from_prepared_frames(prepared_frames, feature_extractor)


def _load_candidate_video_frames(video_path: Path, max_frames: int) -> List[np.ndarray]:
    """قراءة عدد محدود من الإطارات المرشحة من بداية الفيديو بعد تخطي أول frame."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    frames = []
    cap.read()  # skip first frame to match the documented preprocessing
    while len(frames) < max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)

    cap.release()
    return frames


def select_keyframe_from_video(video_path: Path | str, frames_to_check: int = DEFAULT_NUM_FRAMES) -> np.ndarray:
    """اختيار أفضل frame من الفيديو ليُمثل الحالة الشعورية.

    المنطق هنا يعتمد على:
    - إزالة الخلفية
    - استبعاد الإطارات السيئة
    - الموازنة بين الحدة والحركة
    """

    video_path = Path(video_path)
    raw_frames = _load_candidate_video_frames(video_path, frames_to_check)
    if not raw_frames:
        raise ValueError(f"Video has no readable frames after the initial frame skip: {video_path}")

    mp_selfie = mp.solutions.selfie_segmentation
    candidates: List[tuple[np.ndarray, np.ndarray]] = []

    # نفحص عدة إطارات ونحتفظ فقط بالمرشحين الجيدين.
    with mp_selfie.SelfieSegmentation(model_selection=1) as segmenter:
        for frame in raw_frames:
            processed_bgr = apply_background_removal(frame, segmenter)
            gray = cv2.cvtColor(processed_bgr, cv2.COLOR_BGR2GRAY)
            if is_bad_frame(gray):
                continue
            candidates.append((processed_bgr, gray))

    if not candidates:
        fallback_bgr = cv2.resize(raw_frames[min(1, len(raw_frames) - 1)], (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
        enhanced_bgr = enhance_image_natural(fallback_bgr)
        return cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2RGB)

    if len(candidates) == 1:
        enhanced_bgr = enhance_image_natural(candidates[0][0])
        return cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2RGB)

    sharp_vals = np.asarray([sharpness_score(candidate[1]) for candidate in candidates], dtype=np.float32)
    motion_vals = np.zeros(len(candidates), dtype=np.float32)
    for index in range(1, len(candidates)):
        motion_vals[index] = motion_score(candidates[index - 1][1], candidates[index][1])
    motion_vals[0] = motion_vals[1] if len(candidates) > 1 else 0.0

    # نطبع القيم إلى مجال موحد حتى نجمع sharpness وmotion في score واحد.
    def normalize(values: np.ndarray) -> np.ndarray:
        value_range = float(values.max() - values.min())
        if value_range <= 1e-9:
            return np.zeros_like(values)
        return (values - values.min()) / value_range

    scores = 0.6 * normalize(sharp_vals) + 0.4 * normalize(motion_vals)
    best_index = int(np.argmax(scores))
    enhanced_bgr = enhance_image_natural(candidates[best_index][0])
    return cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2RGB)


def extract_vector_from_video_path(
    video_path: Path | str,
    feature_extractor,
    num_frames: int = DEFAULT_NUM_FRAMES,
) -> np.ndarray:
    """استخراج vector من فيديو عبر اختيار keyframe واحد مناسب."""
    keyframe_rgb = select_keyframe_from_video(video_path, frames_to_check=max(10, num_frames))
    return extract_vector_from_prepared_frames([keyframe_rgb], feature_extractor)


def extract_vector_from_media_path(
    media_path: Path | str,
    feature_extractor,
    num_frames: int = DEFAULT_NUM_FRAMES,
) -> np.ndarray:
    """تحديد نوع الملف ثم استدعاء مسار الاستخراج المناسب له."""
    media_path = Path(media_path)
    suffix = media_path.suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".bmp"}:
        return extract_vector_from_image_path(media_path, feature_extractor)
    if suffix in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        return extract_vector_from_video_path(media_path, feature_extractor, num_frames=num_frames)
    raise ValueError(f"Unsupported media file type: {media_path.suffix}")
