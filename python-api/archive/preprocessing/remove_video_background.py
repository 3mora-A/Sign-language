#!/usr/bin/env python3
"""إزالة الخلفية من جميع فيديوهات الداتاست باستخدام MediaPipe Selfie Segmentation.

الهدف من هذا السكربت هو تجهيز نسخة أنظف من الفيديوهات قبل استخراج الإطارات
أو قبل إجراء تجارب تدريب لاحقة.
"""

import argparse
import os
from pathlib import Path
import sys

try:
    import cv2
except ModuleNotFoundError:
    print("ERROR: Missing dependency 'cv2' (opencv-contrib-python).")
    print(r"Run: .\venv\Scripts\python.exe -m pip install opencv-contrib-python")
    raise SystemExit(1)

import mediapipe as mp
import numpy as np


VALID_VIDEO_SUFFIXES = {".mp4", ".avi", ".mov", ".mkv", ".m4v", ".flv", ".wmv", ".webm"}
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


def parse_args() -> argparse.Namespace:
    """تعريف معاملات سطر الأوامر الخاصة بمعالجة الخلفية."""
    parser = argparse.ArgumentParser(description="Remove video background for all videos in a directory tree")
    parser.add_argument("--input_dir", type=Path, default=resolve_input_dir("SIGNLANG_DATASET_DIR", "dataset", PROJECT_DIR / "data" / "dataset"),
                        help="Root directory that contains class folders and videos")
    parser.add_argument("--output_dir", type=Path, default=resolve_output_dir("SIGNLANG_BG_REMOVED_DIR", "dataset_bg_removed", PROJECT_DIR / "data" / "dataset_bg_removed"),
                        help="Root directory to write processed videos")
    parser.add_argument("--mask_threshold", type=float, default=0.5,
                        help="Segmentation threshold (0.0 - 1.0)")
    parser.add_argument("--max_side", type=int, default=0,
                        help="Resize long side before segmentation (0 = keep original)")
    return parser.parse_args()


def collect_videos(root: Path) -> list[Path]:
    """جمع جميع الفيديوهات داخل شجرة المجلدات."""
    videos: list[Path] = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in VALID_VIDEO_SUFFIXES:
            videos.append(p)
    return sorted(videos)


def resize_keep_aspect(frame: np.ndarray, max_side: int) -> np.ndarray:
    """تصغير الإطار مع الحفاظ على نسبة الأبعاد."""
    if max_side <= 0:
        return frame
    h, w = frame.shape[:2]
    side = max(h, w)
    if side <= max_side:
        return frame
    scale = max_side / side
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)


def remove_background_frame(frame_bgr: np.ndarray, segmenter, threshold: float) -> np.ndarray:
    """إزالة خلفية frame واحد واستبدالها بخلفية بيضاء."""
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    result = segmenter.process(rgb)
    if result is None or result.segmentation_mask is None:
        return frame_bgr

    condition = result.segmentation_mask > threshold
    condition_3ch = np.stack((condition, condition, condition), axis=-1)
    white_bg = np.ones(frame_bgr.shape, dtype=np.uint8) * 255
    return np.where(condition_3ch, frame_bgr, white_bg)


def process_video(video_path: Path, input_root: Path, output_root: Path, segmenter, threshold: float, max_side: int) -> bool:
    """معالجة فيديو واحد كاملًا frame by frame."""
    rel = video_path.relative_to(input_root)
    out_path = output_root / rel
    out_path.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"FAILED open video: {video_path}")
        return False

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0

    ret, first = cap.read()
    if not ret or first is None:
        cap.release()
        print(f"FAILED read first frame: {video_path}")
        return False

    first = resize_keep_aspect(first, max_side)
    h, w = first.shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path.with_suffix(".mp4")), fourcc, fps, (w, h))
    if not writer.isOpened():
        cap.release()
        print(f"FAILED create output video: {out_path.with_suffix('.mp4')}")
        return False

    first_out = remove_background_frame(first, segmenter, threshold)
    writer.write(first_out)

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame = resize_keep_aspect(frame, max_side)
        out = remove_background_frame(frame, segmenter, threshold)
        writer.write(out)

    cap.release()
    writer.release()
    return True


def main() -> int:
    """تنفيذ معالجة الخلفية على جميع الفيديوهات الموجودة."""
    args = parse_args()
    input_dir = args.input_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f"ERROR: Input dir not found: {input_dir}")
        return 1

    videos = collect_videos(input_dir)
    if not videos:
        print(f"No videos found in: {input_dir}")
        return 1

    print(f"Found {len(videos)} videos")
    print(f"Input : {input_dir}")
    print(f"Output: {output_dir}")

    mp_selfie = mp.solutions.selfie_segmentation
    ok_count = 0
    failed = []

    with mp_selfie.SelfieSegmentation(model_selection=1) as segmenter:
        for i, video in enumerate(videos, start=1):
            success = process_video(
                video_path=video,
                input_root=input_dir,
                output_root=output_dir,
                segmenter=segmenter,
                threshold=args.mask_threshold,
                max_side=args.max_side,
            )
            if success:
                ok_count += 1
            else:
                failed.append(video)
            print(f"[{i}/{len(videos)}] {'OK' if success else 'FAILED'} - {video.name}")

    print("\n" + "=" * 50)
    print("Done")
    print(f"Processed successfully: {ok_count}")
    print(f"Failed: {len(failed)}")
    print(f"Output root: {output_dir}")
    if failed:
        print("First failed files:")
        for p in failed[:20]:
            print(f" - {p}")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
