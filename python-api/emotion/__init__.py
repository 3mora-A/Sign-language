"""واجهة موحدة لكود المشاعر داخل python-api.

هذا المجلد يحتوي فقط على:
- `extractor.py`: استخراج feature vector من صورة أو فيديو.
- `model.py`: تحميل ملفات المودل وتنفيذ التنبؤ.
"""

from .extractor import (
    DEFAULT_NUM_FRAMES,
    extract_vector_from_frame_paths,
    extract_vector_from_image_path,
    extract_vector_from_media_path,
    extract_vector_from_prepared_frames,
    load_feature_extractor,
    select_keyframe_from_video,
)
from .model import EmotionModule

__all__ = [
    "DEFAULT_NUM_FRAMES",
    "EmotionModule",
    "extract_vector_from_frame_paths",
    "extract_vector_from_image_path",
    "extract_vector_from_media_path",
    "extract_vector_from_prepared_frames",
    "load_feature_extractor",
    "select_keyframe_from_video",
]
