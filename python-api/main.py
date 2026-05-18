"""الخادم الرئيسي الخاص بالاستدلال على المشاعر.

هذا الملف هو نقطة الربط بين Laravel وطبقة Python.
المسؤوليات الأساسية هنا هي:
- استقبال الصورة أو الفيديو المرفوع من الواجهة الخلفية
- حفظ نسخة مؤقتة أثناء المعالجة
- استخراج الخصائص الخاصة بالمشاعر أو استقبال vector جاهز
- تمرير الخصائص إلى مودل المشاعر
- إعادة النتيجة بصيغة JSON قابلة للتخزين في Laravel
"""

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
import asyncio
from datetime import datetime
import hashlib
import io
import json
import logging
import os
import time
import traceback
from typing import List, Optional

import numpy as np

# نستورد طبقة المشاعر من باكيج واحد واضح: استخراج الخصائص + تشغيل المودل.
from emotion import (
    DEFAULT_NUM_FRAMES as DEFAULT_EMOTION_NUM_FRAMES,
    EmotionModule,
    extract_vector_from_media_path,
    load_feature_extractor as load_emotion_feature_extractor,
)


# مجلدات العمل الأساسية الخاصة بخدمة الـ API.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUNTIME_DIR = os.path.join(BASE_DIR, "runtime")
TEMP_DIR = os.path.join(RUNTIME_DIR, "temp")
CACHE_DIR = os.path.join(RUNTIME_DIR, "cache")
LOG_PATH = os.path.join(RUNTIME_DIR, "api_server.log")

# نتأكد أن مجلدات الملفات المؤقتة والكاش موجودة قبل بدء التشغيل.
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

import sys

_stream_handler = logging.StreamHandler(sys.stdout)
try:
    _stream_handler.stream.reconfigure(encoding="utf-8")
except Exception:
    pass

# إعدادات الـ logging حتى نحتفظ بسجل واضح لعمليات التنبؤ والأخطاء.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        _stream_handler,
    ],
)
logger = logging.getLogger(__name__)

# تعريف تطبيق FastAPI الرئيسي.
app = FastAPI(
    title="Emotion Recognition API",
    description="API dedicated to emotion analysis from images, videos, or raw feature vectors.",
    version="3.0.0",
)

# نسمح بالاتصال من أي Origin لأن الاستدعاء قد يأتي من Laravel محليًا أو من أدوات اختبار.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# نحمل مودل المشاعر مرة واحدة عند تشغيل السيرفر بدل تحميله مع كل طلب.
emotion_inference = EmotionModule()
emotion_feature_extractor = None
try:
    emotion_feature_extractor = load_emotion_feature_extractor()
    logger.info("Loaded emotion feature extractor")
except Exception as exc:
    logger.warning("Emotion feature extractor load failed: %s", exc)
    emotion_feature_extractor = None


class Config:
    """إعدادات التشغيل الخاصة بالخدمة.

    هذه القيم تحدد:
    - الحد الأقصى لحجم الملف
    - الامتدادات المسموحة
    - عدد الإطارات المستخدمة عند تحليل الفيديو
    - هل نفعّل الكاش أم لا
    """

    MAX_FILE_SIZE = 100 * 1024 * 1024
    SUPPORTED_IMAGES = {".jpg", ".jpeg", ".png", ".bmp"}
    SUPPORTED_VIDEOS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    SUPPORTED_VECTOR_FILES = {".npy", ".csv", ".txt", ".json"}
    EMOTION_NUM_SAMPLES = DEFAULT_EMOTION_NUM_FRAMES
    CACHE_ENABLED = True
    CACHE_VERSION = 1
    USE_EMOTION_SVM = emotion_inference.loaded


config = Config()


def parse_emotion_vector_bytes(contents: bytes, filename: str) -> np.ndarray:
    """قراءة vector مشاعر خام من ملف مرفوع وتحويله إلى مصفوفة رقمية جاهزة."""
    file_ext = os.path.splitext(filename or "")[1].lower()
    if file_ext not in config.SUPPORTED_VECTOR_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported emotion vector file type. Supported: {config.SUPPORTED_VECTOR_FILES}",
        )

    try:
        if file_ext == ".npy":
            vector = np.load(io.BytesIO(contents), allow_pickle=True)
        elif file_ext == ".json":
            vector = np.asarray(json.loads(contents.decode("utf-8")), dtype=np.float32)
        else:
            delimiter = "," if file_ext == ".csv" else None
            vector = np.loadtxt(io.StringIO(contents.decode("utf-8-sig")), delimiter=delimiter)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse emotion vector file: {exc}") from exc

    vector = np.asarray(vector, dtype=np.float32)
    if vector.ndim == 2:
        if vector.shape[0] == 1:
            vector = vector[0]
        elif vector.shape[1] == 1:
            vector = vector[:, 0]
        else:
            raise HTTPException(status_code=400, detail="Emotion vector file must contain one sample only")

    if vector.ndim != 1:
        raise HTTPException(status_code=400, detail="Emotion vector must be a 1D array")

    if np.isnan(vector).any():
        raise HTTPException(status_code=400, detail="Emotion vector contains NaN values")

    return vector


def predict_emotion_from_raw_vector(raw_vector: np.ndarray) -> dict:
    """تشغيل مودل المشاعر مباشرة على vector خام سبق تجهيزه."""
    if not config.USE_EMOTION_SVM or not emotion_inference.loaded:
        raise HTTPException(status_code=503, detail="Emotion model is not loaded")

    try:
        return emotion_inference.predict_from_raw_vector(raw_vector)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def predict_emotion_from_media_path(file_path: str, num_frames: int | None = None) -> dict:
    """استخراج خصائص المشاعر من media file ثم تمريرها للمودل."""
    if not config.USE_EMOTION_SVM or emotion_feature_extractor is None:
        raise HTTPException(status_code=503, detail="Emotion model is not loaded")

    try:
        raw_vector = extract_vector_from_media_path(
            file_path,
            emotion_feature_extractor,
            num_frames=num_frames or config.EMOTION_NUM_SAMPLES,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to extract emotion features: {exc}") from exc

    result = predict_emotion_from_raw_vector(raw_vector)
    result["emotion_source"] = "media_auto"
    return result


class PredictionCache:
    """كاش بسيط لتجنب إعادة تحليل نفس الملف أكثر من مرة."""

    def __init__(self, cache_dir=CACHE_DIR):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def get_cached_result(self, file_hash: str) -> Optional[dict]:
        cache_file = os.path.join(self.cache_dir, f"{file_hash}_v{config.CACHE_VERSION}.json")
        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as handle:
                return json.load(handle)
        return None

    def cache_result(self, file_hash: str, result: dict):
        cache_file = os.path.join(self.cache_dir, f"{file_hash}_v{config.CACHE_VERSION}.json")
        with open(cache_file, "w", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False)


cache = PredictionCache() if config.CACHE_ENABLED else None


def build_compatibility_payload(file_ext: str, started_at: float) -> dict:
    """بناء payload ابتدائي متوافق مع الشكل الذي تتوقعه Laravel."""
    return {
        "status": "success",
        "file_type": "image" if file_ext in config.SUPPORTED_IMAGES else "video",
        "processing_time": round(time.time() - started_at, 2),
        "frames_analyzed": 0,
        "gesture": "unknown",
        "confidence": 0.0,
        "confidence_raw": 0.0,
        "top_predictions": [],
    }


def apply_emotion_compatibility_aliases(result: dict) -> dict:
    """ملء الحقول القديمة بقيم مبنية على ناتج مودل المشاعر فقط."""
    emotion_value = str(result.get("emotion") or "unknown")
    emotion_confidence = result.get("emotion_confidence")
    emotion_confidence_raw = result.get("emotion_confidence_raw")
    emotion_top_predictions = result.get("emotion_top_predictions") or []

    result["gesture"] = emotion_value
    result["confidence"] = round(float(emotion_confidence), 2) if isinstance(emotion_confidence, (int, float)) else 0.0
    result["confidence_raw"] = float(emotion_confidence_raw) if isinstance(emotion_confidence_raw, (int, float)) else 0.0
    result["top_predictions"] = [
        {
            "gesture": str(item.get("emotion") or "unknown"),
            "confidence": round(float(item.get("confidence") or 0.0), 2),
        }
        for item in emotion_top_predictions
        if isinstance(item, dict)
    ]

    return result


async def cleanup_temp_file(file_path: str):
    """حذف الملف المؤقت بعد فترة قصيرة حتى لا تتراكم الملفات على الخادم."""
    await asyncio.sleep(60)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info("Removed temp file: %s", file_path)
    except Exception as exc:
        logger.error("Temp file cleanup failed: %s", exc)


@app.get("/", response_class=HTMLResponse)
async def root():
    """صفحة تعريف بسيطة عند فتح الخدمة من المتصفح مباشرة."""
    return """
    <html>
        <head>
            <title>Emotion Recognition API</title>
            <style>
                body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
                h1 { color: #333; }
                .endpoint { background: #f4f4f4; padding: 10px; border-radius: 5px; margin: 10px 0; }
                code { background: #e0e0e0; padding: 2px 5px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>Emotion Recognition API</h1>
            <p>This runtime currently serves emotion inference only.</p>

            <div class="endpoint">
                <h3>Media Prediction</h3>
                <p><code>POST /predict</code> - upload an image or video and receive emotion analysis.</p>
            </div>

            <div class="endpoint">
                <h3>Vector Prediction</h3>
                <p><code>POST /predict/emotion/vector</code> - predict emotion from a raw feature vector file.</p>
            </div>

            <div class="endpoint">
                <h3>Diagnostics</h3>
                <p><code>GET /info</code> - model information</p>
                <p><code>GET /health</code> - health check</p>
            </div>
        </body>
    </html>
    """


@app.get("/health")
async def health_check():
    """فحص صحي سريع للتأكد من أن الخدمة والمودل جاهزان."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "emotion_model_loaded": config.USE_EMOTION_SVM,
        "emotion_feature_extractor_loaded": emotion_feature_extractor is not None,
        "mode": "emotion_only",
    }


@app.get("/info")
async def get_info():
    """إرجاع معلومات تشخيصية عن المودل والمدخلات المدعومة."""
    return {
        "mode": "emotion_only",
        "emotion_model_loaded": config.USE_EMOTION_SVM,
        "emotion_classes": list(getattr(emotion_inference.label_encoder, "classes_", [])) if emotion_inference.loaded else [],
        "emotion_input_features": int(emotion_inference.expected_features or 0) if emotion_inference.loaded else None,
        "supported_images": sorted(config.SUPPORTED_IMAGES),
        "supported_videos": sorted(config.SUPPORTED_VIDEOS),
        "supported_vector_files": sorted(config.SUPPORTED_VECTOR_FILES),
    }


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    emotion_vector: Optional[UploadFile] = File(None),
    background_tasks: BackgroundTasks = None,
):
    """المسار الرئيسي المستخدم من Laravel.

    السيناريو الطبيعي:
    - استقبال الملف
    - التحقق من حجمه ونوعه
    - حفظه مؤقتًا
    - محاولة استخدام الكاش إن وجد
    - استخراج الخصائص وتشغيل المودل
    - إعادة النتيجة النهائية
    """

    started_at = time.time()
    file_path = None

    # نقرأ الملف كاملًا في الذاكرة لأن Laravel يرسله كـ multipart upload.
    contents = await file.read()
    file_size = len(contents)
    emotion_vector_contents = None
    if emotion_vector is not None:
        emotion_vector_contents = await emotion_vector.read()

    if file_size > config.MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="The uploaded file exceeds the 100MB limit")

    original_filename = os.path.basename(file.filename or "upload")
    file_ext = os.path.splitext(original_filename)[1].lower()
    if file_ext not in config.SUPPORTED_IMAGES | config.SUPPORTED_VIDEOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported media file type. Supported: {config.SUPPORTED_IMAGES | config.SUPPORTED_VIDEOS}",
        )

    # نبني hash للملف حتى نستخدمه كمفتاح للكاش.
    hash_seed = contents if emotion_vector_contents is None else contents + emotion_vector_contents
    file_hash = hashlib.md5(hash_seed).hexdigest()[:16]
    file_path = os.path.join(TEMP_DIR, f"{file_hash}{file_ext}")

    try:
        # نحفظ نسخة مؤقتة لأن بعض خطوات الاستخراج تعمل على مسار ملف.
        with open(file_path, "wb") as handle:
            handle.write(contents)

        logger.info("Received media file: %s (%.2f KB)", original_filename, file_size / 1024)

        if cache:
            cached_result = cache.get_cached_result(file_hash)
            if cached_result:
                logger.info("Using cached emotion result for: %s", original_filename)
                return JSONResponse(content=apply_emotion_compatibility_aliases(cached_result))

        # نبدأ بهيكل response موحد ثم نضيف عليه ناتج المودل.
        result = build_compatibility_payload(file_ext, started_at)

        if emotion_vector_contents is not None:
            parsed_vector = parse_emotion_vector_bytes(
                emotion_vector_contents,
                emotion_vector.filename or "emotion_vector.npy",
            )
            result.update(predict_emotion_from_raw_vector(parsed_vector))
            result["emotion_source"] = "vector_upload"
        else:
            result.update(predict_emotion_from_media_path(file_path))

        result["processing_time"] = round(time.time() - started_at, 2)
        apply_emotion_compatibility_aliases(result)

        if cache:
            cache.cache_result(file_hash, result)

        logger.info(
            "Emotion prediction completed: %s (%s%%) in %s sec",
            result.get("emotion"),
            result.get("emotion_confidence"),
            result.get("processing_time"),
        )
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Prediction failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Server error: {exc}") from exc
    finally:
        if background_tasks and file_path:
            background_tasks.add_task(cleanup_temp_file, file_path)


@app.post("/predict/emotion/vector")
async def predict_emotion_vector(file: UploadFile = File(...)):
    """مسار بديل للتنبؤ عندما يكون الإدخال vector جاهز وليس media file."""
    if not config.USE_EMOTION_SVM:
        raise HTTPException(status_code=503, detail="Emotion model files are not available")

    contents = await file.read()
    raw_vector = parse_emotion_vector_bytes(contents, file.filename or "emotion_vector.npy")
    result = predict_emotion_from_raw_vector(raw_vector)
    result.update(
        {
            "status": "success",
            "source": file.filename,
        }
    )
    return JSONResponse(content=result)


@app.post("/predict/batch")
async def predict_batch(files: List[UploadFile] = File(...)):
    """تنفيذ التنبؤ على مجموعة ملفات دفعة واحدة لأغراض الاختبار أو المعالجة الجماعية."""
    results = []

    for item in files:
        try:
            contents = await item.read()
            original_filename = os.path.basename(item.filename or "upload")
            file_ext = os.path.splitext(original_filename)[1].lower()
            if file_ext not in config.SUPPORTED_IMAGES | config.SUPPORTED_VIDEOS:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

            file_hash = hashlib.md5(contents).hexdigest()[:16]
            file_path = os.path.join(TEMP_DIR, f"{file_hash}{file_ext}")

            with open(file_path, "wb") as handle:
                handle.write(contents)

            result = build_compatibility_payload(file_ext, time.time())
            result.update(predict_emotion_from_media_path(file_path))
            apply_emotion_compatibility_aliases(result)
            results.append(
                {
                    "filename": item.filename,
                    "result": result,
                }
            )
        except Exception as exc:
            results.append(
                {
                    "filename": item.filename,
                    "error": str(exc),
                }
            )

    return JSONResponse(
        content={
            "total": len(files),
            "successful": sum(1 for item in results if "error" not in item),
            "results": results,
        }
    )


if __name__ == "__main__":
    # تشغيل الخدمة مباشرة من هذا الملف أثناء التطوير المحلي.
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        workers=1,
        log_level="info",
    )
