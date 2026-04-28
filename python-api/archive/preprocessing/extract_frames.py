#!/usr/bin/env python3
"""استخراج عدد ثابت من الإطارات من كل فيديو.

هذا السكربت بسيط ومخصص للتجارب المؤرشفة:
- يقرأ الفيديو
- يختار 40 frame موزعة بالتساوي
- يحفظها كصور داخل train/val
"""

import argparse
import logging
import os
import shutil
import sys
from pathlib import Path
from typing import List, Tuple

try:
    import cv2
except ModuleNotFoundError:
    print("ERROR: Missing dependency 'cv2' (opencv-contrib-python).")
    print(r"Run: .\venv\Scripts\python.exe -m pip install opencv-contrib-python")
    raise SystemExit(1)

import numpy as np
from tqdm import tqdm


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROJECT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_EXTERNAL_DATA_ROOT = PROJECT_DIR.parent.parent / "signlang_external_data"


def resolve_input_dir(env_key: str, folder_name: str, fallback: Path) -> Path:
    """تحديد مجلد الإدخال من env أو من المسار الافتراضي."""
    env_value = os.getenv(env_key)
    if env_value:
        return Path(env_value)

    external_root = os.getenv("SIGNLANG_EXTERNAL_DATA_ROOT")
    if external_root:
        candidate = Path(external_root) / folder_name
        if candidate.exists():
            return candidate

    default_candidate = DEFAULT_EXTERNAL_DATA_ROOT / folder_name
    if default_candidate.exists():
        return default_candidate

    return fallback


def resolve_output_dir(env_key: str, folder_name: str, fallback: Path) -> Path:
    """تحديد مجلد الإخراج من env أو من المسار الافتراضي."""
    env_value = os.getenv(env_key)
    if env_value:
        return Path(env_value)

    external_root = os.getenv("SIGNLANG_EXTERNAL_DATA_ROOT")
    if external_root:
        return Path(external_root) / folder_name

    return DEFAULT_EXTERNAL_DATA_ROOT / folder_name if DEFAULT_EXTERNAL_DATA_ROOT.exists() else fallback


DEFAULT_DATASET_DIR = resolve_input_dir("SIGNLANG_BG_REMOVED_DIR", "dataset_bg_removed", PROJECT_DIR / "data" / "dataset_bg_removed")
DEFAULT_OUTPUT_DIR = resolve_output_dir("SIGNLANG_FRAMES_DATASET_DIR", "frames_dataset", PROJECT_DIR / "data" / "frames_dataset")
DEFAULT_NUM_FRAMES = 40
DEFAULT_VAL_SPLIT = 0.2
VALID_VIDEO_SUFFIXES = {".mp4", ".avi", ".mov", ".mkv", ".m4v", ".flv", ".wmv", ".webm"}


def imwrite_unicode(path: Path, frame) -> bool:
    """حفظ الصورة حتى لو كان المسار يحتوي على أحرف عربية."""
    ext = path.suffix if path.suffix else ".jpg"
    ok, buf = cv2.imencode(ext, frame)
    if not ok:
        return False
    try:
        buf.tofile(str(path))
        return True
    except Exception:
        return False


def collect_video_tasks(dataset_dir: Path) -> List[Tuple[Path, str]]:
    """جمع الفيديوهات وربط كل فيديو بالـ label القادم من اسم المجلد."""
    tasks: List[Tuple[Path, str]] = []
    for label_path in sorted(dataset_dir.iterdir()):
        if not label_path.is_dir():
            continue
        label = label_path.name
        for video_file in sorted(label_path.iterdir()):
            if video_file.is_file() and video_file.suffix.lower() in VALID_VIDEO_SUFFIXES:
                tasks.append((video_file, label))
    return tasks


def build_split_map(video_tasks: List[Tuple[Path, str]], val_split: float) -> dict:
    """تقسيم الفيديوهات إلى train و val بطريقة ثابتة قابلة لإعادة التكرار."""
    rng = np.random.RandomState(42)
    label_to_videos = {}
    for video_path, label in video_tasks:
        label_to_videos.setdefault(label, []).append(video_path)

    split_map = {}
    for label, vids in label_to_videos.items():
        vids = list(vids)
        rng.shuffle(vids)
        val_count = max(1, int(len(vids) * val_split)) if len(vids) > 1 else 0
        val_set = set(vids[:val_count])
        for vp in vids:
            split_map[(vp, label)] = "val" if vp in val_set else "train"
    return split_map


def sample_indices(total_frames: int, num_frames: int) -> np.ndarray:
    """اختيار مؤشرات frames موزعة بالتساوي على طول الفيديو."""
    if total_frames <= 0:
        return np.array([], dtype=int)
    return np.linspace(0, total_frames - 1, num_frames, dtype=int)


def extract_frames_from_video(video_path: Path, num_frames: int) -> List:
    """قراءة الفيديو واستخراج frames المطلوبة."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = sample_indices(total_frames, num_frames)
    if len(indices) == 0:
        cap.release()
        return []

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret and frame is not None:
            frames.append(frame)
    cap.release()
    return frames


def save_frames(output_dir: Path, split: str, label: str, video_name: str, frames: List) -> int:
    """حفظ frames المستخرجة ضمن هيكلية train/val."""
    out_folder = output_dir / split / label / Path(video_name).stem
    out_folder.mkdir(parents=True, exist_ok=True)
    saved = 0
    for i, frame in enumerate(frames):
        out_file = out_folder / f"frame_{i:04d}.jpg"
        if imwrite_unicode(out_file, frame):
            saved += 1
    return saved


def clear_generated_output(output_dir: Path):
    """حذف المجلدات المولدة سابقًا حتى لا تختلط النتائج القديمة بالجديدة."""
    for split_dir in (output_dir / "train", output_dir / "val"):
        if split_dir.exists():
            shutil.rmtree(split_dir)


def main():
    """نقطة التشغيل الرئيسية لاستخراج الإطارات."""
    parser = argparse.ArgumentParser(description="Extract 40 frames per video without any modifications")
    parser.add_argument("--dataset_dir", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--output_dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--num_frames", type=int, default=DEFAULT_NUM_FRAMES)
    parser.add_argument("--val_split", type=float, default=DEFAULT_VAL_SPLIT)
    parser.add_argument("--keep_existing", action="store_true")
    args = parser.parse_args()

    dataset_dir = args.dataset_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not dataset_dir.is_dir():
        logger.error("Dataset directory does not exist: %s", dataset_dir)
        sys.exit(1)

    video_tasks = collect_video_tasks(dataset_dir)
    if not video_tasks:
        logger.error("No video files were found in %s", dataset_dir)
        sys.exit(1)

    if not args.keep_existing:
        clear_generated_output(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

    split_map = build_split_map(video_tasks, args.val_split)

    total_videos = len(video_tasks)
    processed = 0
    failed = []
    total_saved = 0

    logger.info("Found %d videos in %s", total_videos, dataset_dir)
    logger.info("Output directory: %s", output_dir)
    logger.info("Frames per video: %d", args.num_frames)

    for video_path, label in tqdm(video_tasks, desc="Processing videos"):
        split = split_map[(video_path, label)]
        frames = extract_frames_from_video(video_path, args.num_frames)
        if not frames:
            failed.append(video_path.name)
            continue
        saved = save_frames(output_dir, split, label, video_path.name, frames)
        if saved == 0:
            failed.append(video_path.name)
            continue
        processed += 1
        total_saved += saved

    logger.info("=" * 70)
    logger.info("Processing completed")
    logger.info("Total videos: %d", total_videos)
    logger.info("Successfully processed: %d", processed)
    logger.info("Failed completely: %d", len(failed))
    logger.info("Total saved frames: %d", total_saved)
    if processed > 0:
        logger.info("Average saved frames per video: %.1f", total_saved / processed)
    logger.info("Output directory: %s", output_dir)
    if failed:
        logger.warning("Failed videos (%d):", len(failed))
        for name in failed[:20]:
            logger.warning(" - %s", name)
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
