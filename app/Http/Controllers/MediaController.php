<?php

namespace App\Http\Controllers;

use App\Models\Emotion;
use App\Models\Gesture;
use App\Models\Prediction;
use App\Models\User;
use App\Models\Video;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    public function showUploadForm()
    {
        return redirect()->route('upload.form');
    }

    public function upload(Request $request)
    {
        $allowedMimes = config('signlang.uploads.allowed_mimes', ['mp4', 'avi', 'mov', 'jpeg', 'png', 'jpg', 'gif']);
        $maxUploadKb = (int) config('signlang.uploads.max_kb', 102400);

        $request->validate([
            'media' => 'required|file|mimes:' . implode(',', $allowedMimes) . '|max:' . $maxUploadKb,
        ]);

        $file = $request->file('media');
        $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
        $fileContents = file_get_contents($file->getRealPath());

        if ($fileContents === false) {
            return response()->json([
                'ok' => false,
                'message' => 'تعذر قراءة الملف المرفوع.',
            ], 422);
        }

        $video = $this->storeUploadedMedia($file, $filename, $fileContents);
        $result = $this->analyzeWithPython($filename, $fileContents);
        $this->persistAnalysis($video, $result);
        $video->load(['prediction.gesture', 'prediction.emotion']);

        $analysis = $this->formatAnalysisPayload($result, $video, $filename);

        if ($request->expectsJson()) {
            return response()->json([
                'ok' => !isset($result['error']),
                'message' => $result['error'] ?? 'تمت معالجة الملف بنجاح.',
                'analysis' => $analysis,
            ], isset($result['error']) ? 422 : 200);
        }

        return redirect()
            ->route('results')
            ->with(isset($result['error']) ? 'error' : 'success', $result['error'] ?? 'تم تحليل الملف بنجاح.')
            ->with('analysis_result', $analysis);
    }

    public function preview(Request $request, Video $video)
    {
        abort_unless($this->canAccessVideo($video), 403);

        $mimeType = $video->mime_type ?: 'application/octet-stream';
        $downloadName = $video->original_name ?: basename((string) $video->video_path);

        if (($video->storage_disk ?: '') === 'database') {
            $encoded = $video->mediaContent?->media_base64;
            abort_if(!is_string($encoded), 404, 'Stored media content was not found.');
            $contents = base64_decode($encoded, true);
            abort_if($contents === false, 500, 'Stored media content could not be decoded.');

            return $this->binaryResponse($request, $contents, $mimeType, $downloadName);
        }

        $diskName = $video->storage_disk ?: config('signlang.uploads.disk', 'public');
        $disk = Storage::disk($diskName);
        abort_unless($disk->exists((string) $video->video_path), 404, 'Stored media file was not found.');

        $contents = $disk->get((string) $video->video_path);

        return $this->binaryResponse($request, $contents, $mimeType, $downloadName);
    }

    private function storeUploadedMedia(UploadedFile $file, string $filename, string $fileContents): Video
    {
        $storageDriver = (string) config('signlang.uploads.storage_driver', 'disk');
        $uploadDisk = (string) config('signlang.uploads.disk', config('filesystems.default', 'public'));
        $uploadDirectory = trim((string) config('signlang.uploads.directory', 'uploads'), '/');
        $logicalPath = $uploadDirectory . '/' . $filename;
        $storeInDatabase = $this->shouldStoreMediaInDatabase($file, $storageDriver, $fileContents);

        return DB::transaction(function () use ($file, $fileContents, $filename, $logicalPath, $storeInDatabase, $uploadDisk): Video {
            $video = Video::create([
                'user_id' => $this->resolveUserId(),
                'video_path' => $logicalPath,
                'storage_disk' => $storeInDatabase ? 'database' : $uploadDisk,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'duration' => 0,
                'status' => 'processing',
            ]);

            if ($storeInDatabase) {
                $video->mediaContent()->create([
                    'media_base64' => base64_encode($fileContents),
                    'checksum_sha256' => hash('sha256', $fileContents),
                ]);
            } else {
                $file->storeAs(dirname($logicalPath), basename($logicalPath), $uploadDisk);
            }

            return $video;
        });
    }

    private function shouldStoreMediaInDatabase(UploadedFile $file, string $storageDriver, string $fileContents): bool
    {
        if (Str::lower(trim($storageDriver)) !== 'database') {
            return false;
        }

        $mimeType = (string) ($file->getMimeType() ?: '');
        $isImage = Str::startsWith($mimeType, 'image/')
            || $this->isImageFilename($file->getClientOriginalName());

        if (!$isImage) {
            return false;
        }

        $maxBytes = max(0, (int) config('signlang.uploads.database_max_bytes', 262144));
        if ($maxBytes === 0) {
            return false;
        }

        return strlen($fileContents) <= $maxBytes;
    }

    private function analyzeWithPython(string $filename, string $fileContents): array
    {
        try {
            $response = Http::timeout((int) config('signlang.inference.timeout', 120))->attach(
                'file',
                $fileContents,
                $filename
            )->post(
                rtrim((string) config('signlang.inference.base_url', 'http://127.0.0.1:8001'), '/') .
                '/' .
                ltrim((string) config('signlang.inference.predict_path', '/predict'), '/')
            );

            if ($response->successful()) {
                return $response->json();
            }

            $errorData = $response->json();

            return ['error' => $errorData['detail'] ?? 'خطأ في معالجة الذكاء الاصطناعي.'];
        } catch (\Exception $e) {
            return ['error' => 'فشل الاتصال بمحرك Python: ' . $e->getMessage()];
        }
    }

    private function persistAnalysis(Video $video, array $result): void
    {
        if (isset($result['error'])) {
            $video->update([
                'status' => 'failed',
                'result' => null,
                'error_message' => (string) $result['error'],
            ]);

            return;
        }

        DB::transaction(function () use ($video, $result): void {
            $gestureValue = $this->normalizeText($result['gesture'] ?? 'unknown', 'unknown');
            $emotionValue = $this->normalizeText($result['emotion'] ?? 'unknown', 'unknown');
            $confidenceValue = $result['emotion_confidence'] ?? $result['confidence'] ?? null;

            $gestureKey = Str::lower($gestureValue);
            $emotionKey = Str::lower($emotionValue);

            $gesture = Gesture::firstOrCreate(
                [
                    'label' => $gestureValue,
                    'language' => (string) config('signlang.defaults.gesture_language', 'ArSL'),
                ],
                [
                    'description' => $this->gestureLabel($gestureKey, $gestureValue)['en'],
                ]
            );

            $emotion = Emotion::firstOrCreate(
                [
                    'name' => $emotionKey,
                ],
                [
                    'arabic_name' => $this->emotionLabel($emotionKey)['ar'],
                ]
            );

            Prediction::updateOrCreate(
                ['video_id' => $video->id],
                [
                    'gesture_id' => $gesture->id,
                    'emotion_id' => $emotion->id,
                    'confidence' => $this->normalizePercentage($confidenceValue),
                    'emotion_confidence' => $this->normalizePercentage($confidenceValue),
                    'frames_analyzed' => $this->resolveFramesAnalyzed($result),
                    'latency_ms' => $this->resolveLatencyMs($result),
                    'emotion_source' => $this->normalizeNullableText($result['emotion_source'] ?? null),
                    'gesture_alternatives' => $this->normalizePredictionList($result['top_predictions'] ?? [], 'gesture'),
                    'emotion_top_predictions' => $this->normalizePredictionList($result['emotion_top_predictions'] ?? [], 'emotion'),
                    'raw_response' => $result,
                ]
            );

            $video->update([
                'status' => 'processed',
                'result' => $emotionValue,
                'error_message' => null,
            ]);
        });
    }

    private function formatAnalysisPayload(array $result, Video $video, string $filename): array
    {
        $prediction = $video->prediction;
        $gestureValue = $this->normalizeText(
            $result['gesture'] ?? $result['emotion'] ?? $prediction?->gesture?->label ?? $video->result ?? 'unknown',
            'unknown'
        );
        $emotionValue = $this->normalizeText(
            $result['emotion'] ?? $prediction?->emotion?->name ?? $video->result ?? 'unknown',
            'unknown'
        );

        $emotionKey = Str::lower($emotionValue);
        $emotionLabel = $this->emotionLabel($emotionKey);
        $confidence = $this->normalizePercentage(
            $result['emotion_confidence']
                ?? $prediction?->emotion_confidence
                ?? $result['confidence']
                ?? $prediction?->confidence
        );
        $framesAnalyzed = $this->resolveFramesAnalyzed($result, $prediction?->frames_analyzed);
        $latencyMs = $this->resolveLatencyMs($result, $prediction?->latency_ms);
        $mediaType = $video->mime_type && Str::startsWith($video->mime_type, 'image/')
            ? 'image'
            : ($this->isImageFilename($video->original_name ?: $filename) ? 'image' : 'video');
        $alternatives = $this->buildEmotionAlternatives($result, $prediction, $emotionKey, $confidence);
        $isFailure = isset($result['error']) || $video->status === 'failed';

        return [
            'id' => $video->id,
            'status' => $isFailure ? 'failed' : 'processed',
            'fileName' => $video->original_name ?: $filename,
            'mediaType' => $mediaType,
            'previewUrl' => $this->previewUrlForVideo($video),
            'createdAt' => optional($video->created_at)->toIso8601String(),
            'framesAnalyzed' => $framesAnalyzed,
            'latencyMs' => $latencyMs,
            'confidence' => $confidence,
            'gestureKey' => $emotionKey,
            'gestureLabel' => $emotionLabel,
            'emotionKey' => $emotionKey,
            'emotionLabel' => $emotionLabel,
            'summary' => $this->buildSummary($video, $emotionKey, $isFailure),
            'alternatives' => $alternatives,
        ];
    }

    private function buildEmotionAlternatives(
        array $result,
        ?Prediction $prediction,
        string $emotionKey,
        float $confidence
    ): array {
        $storedAlternatives = collect($prediction?->emotion_top_predictions ?? [])
            ->map(function (array $item) {
                $value = $this->normalizeText($item['value'] ?? $item['emotion'] ?? 'unknown', 'unknown');
                $key = Str::lower($value);

                return [
                    'key' => $key,
                    'label' => $this->emotionLabel($key),
                    'confidence' => $this->normalizePercentage($item['confidence'] ?? null),
                ];
            })
            ->filter(fn (array $item) => $item['confidence'] > 0)
            ->take(3)
            ->values()
            ->all();

        if ($storedAlternatives !== []) {
            return $storedAlternatives;
        }

        $resultAlternatives = collect($result['emotion_top_predictions'] ?? $result['top_predictions'] ?? [])
            ->map(function (array $prediction) {
                $value = $this->normalizeText($prediction['emotion'] ?? $prediction['gesture'] ?? 'unknown', 'unknown');
                $key = Str::lower($value);

                return [
                    'key' => $key,
                    'label' => $this->emotionLabel($key),
                    'confidence' => $this->normalizePercentage($prediction['confidence'] ?? null),
                ];
            })
            ->filter(fn (array $item) => $item['confidence'] > 0)
            ->take(3)
            ->values()
            ->all();

        if ($resultAlternatives !== []) {
            return $resultAlternatives;
        }

        return [
            [
                'key' => $emotionKey,
                'label' => $this->emotionLabel($emotionKey),
                'confidence' => $confidence,
            ],
        ];
    }

    private function buildSummary(Video $video, string $emotionKey, bool $isFailure): array
    {
        if ($isFailure) {
            return [
                'ar' => $video->error_message ?: 'اكتمل رفع الملف لكن التحليل لم ينجح، يرجى المحاولة مرة أخرى.',
                'en' => $video->error_message ?: 'The file was uploaded, but the analysis did not complete successfully.',
            ];
        }

        $emotionLabel = $this->emotionLabel($emotionKey);

        return [
            'ar' => "تم تحديد الحالة الشعورية \"{$emotionLabel['ar']}\" لهذا المقطع.",
            'en' => "The platform detected the emotional state \"{$emotionLabel['en']}\" for this sample.",
        ];
    }

    private function binaryResponse(Request $request, string $contents, string $mimeType, string $downloadName)
    {
        $size = strlen($contents);
        $start = 0;
        $end = max(0, $size - 1);
        $status = 200;
        $rangeHeader = $request->header('Range');

        $headers = [
            'Content-Type' => $mimeType,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, max-age=3600',
            'Content-Disposition' => $this->contentDispositionHeader($downloadName),
        ];

        if ($rangeHeader && preg_match('/bytes=(\d*)-(\d*)/i', $rangeHeader, $matches)) {
            $rangeStart = $matches[1] !== '' ? (int) $matches[1] : null;
            $rangeEnd = $matches[2] !== '' ? (int) $matches[2] : null;

            if ($rangeStart === null && $rangeEnd !== null) {
                $rangeStart = max(0, $size - $rangeEnd);
                $rangeEnd = $size - 1;
            } else {
                $rangeStart = $rangeStart ?? 0;
                $rangeEnd = $rangeEnd ?? ($size - 1);
            }

            if ($size === 0 || $rangeStart > $rangeEnd || $rangeStart >= $size) {
                return response('', 416, [
                    'Content-Range' => 'bytes */' . $size,
                    'Accept-Ranges' => 'bytes',
                ]);
            }

            $start = max(0, $rangeStart);
            $end = min($size - 1, $rangeEnd);
            $status = 206;
            $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
        }

        $payload = $size > 0 ? substr($contents, $start, ($end - $start) + 1) : '';
        $headers['Content-Length'] = (string) strlen($payload);

        return response($payload, $status, $headers);
    }

    private function canAccessVideo(Video $video): bool
    {
        $user = Auth::user();
        if (!$user) {
            return false;
        }

        if (($user->role ?? null) === 'admin') {
            return true;
        }

        return (int) $video->user_id === (int) $user->id;
    }

    private function contentDispositionHeader(string $downloadName): string
    {
        $fallback = Str::of($downloadName)
            ->ascii()
            ->replace('"', '')
            ->value();

        $fallback = $fallback !== '' ? $fallback : 'media';

        return "inline; filename=\"{$fallback}\"; filename*=UTF-8''" . rawurlencode($downloadName);
    }

    private function normalizePredictionList(array $items, string $valueKey): array
    {
        return collect($items)
            ->map(function ($item) use ($valueKey) {
                if (!is_array($item)) {
                    return null;
                }

                $value = $this->normalizeNullableText($item[$valueKey] ?? null);
                $confidence = $this->normalizePercentage($item['confidence'] ?? null);

                if ($value === null) {
                    return null;
                }

                return [
                    'value' => $value,
                    'confidence' => $confidence,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function normalizeText(mixed $value, string $fallback): string
    {
        $normalized = $this->normalizeNullableText($value);

        return $normalized ?? $fallback;
    }

    private function resolveUserId(): int
    {
        if (Auth::id()) {
            return (int) Auth::id();
        }

        $fallbackUserId = (int) config('signlang.defaults.fallback_user_id', 1);
        $resolvedUserId = User::query()
            ->whereKey($fallbackUserId)
            ->value('id')
            ?? User::query()->value('id');

        if ($resolvedUserId === null) {
            throw new \RuntimeException('No Laravel user record was found to own the uploaded media.');
        }

        return (int) $resolvedUserId;
    }

    private function normalizeNullableText(mixed $value): ?string
    {
        if (!is_string($value) && !is_numeric($value)) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private function normalizePercentage(mixed $value): float
    {
        if (!is_numeric($value)) {
            return 0.0;
        }

        $numeric = (float) $value;
        if ($numeric >= 0 && $numeric <= 1) {
            $numeric *= 100;
        }

        return round(max(0.0, min(100.0, $numeric)), 2);
    }

    private function resolveFramesAnalyzed(array $result, ?int $fallback = null): int
    {
        $value = $result['frames_analyzed'] ?? $fallback ?? 0;

        return max(0, (int) $value);
    }

    private function resolveLatencyMs(array $result, ?int $fallback = null): int
    {
        if (isset($result['latency_ms']) && is_numeric($result['latency_ms'])) {
            return max(0, (int) round((float) $result['latency_ms']));
        }

        if (isset($result['processing_time']) && is_numeric($result['processing_time'])) {
            return max(0, (int) round(((float) $result['processing_time']) * 1000));
        }

        return max(0, (int) ($fallback ?? 0));
    }

    private function previewUrlForVideo(Video $video): ?string
    {
        return $video->exists ? route('media.preview', $video) : null;
    }

    private function isImageFilename(string $filename): bool
    {
        return Str::endsWith(Str::lower($filename), ['.png', '.jpg', '.jpeg', '.gif']);
    }

    private function gestureLabel(string $gestureKey, ?string $fallback = null): array
    {
        $labels = [
            'fine' => ['ar' => 'أنا بخير', 'en' => "I'm fine"],
            'hello' => ['ar' => 'مرحبًا', 'en' => 'Hello'],
            'thanks' => ['ar' => 'شكرًا', 'en' => 'Thank you'],
            'love' => ['ar' => 'أحبك', 'en' => 'I love you'],
            'happy' => ['ar' => 'أنا سعيد', 'en' => 'I am happy'],
            'help' => ['ar' => 'أحتاج مساعدة', 'en' => 'I need help'],
            'stop' => ['ar' => 'توقف', 'en' => 'Stop'],
            'unknown' => ['ar' => $fallback ?: 'غير معروف', 'en' => $fallback ? Str::headline($fallback) : 'Unknown'],
        ];

        return $labels[$gestureKey] ?? ['ar' => $fallback ?: 'إشارة غير معروفة', 'en' => $fallback ? Str::headline($fallback) : 'Unknown sign'];
    }

    private function emotionLabel(string $emotionKey): array
    {
        $labels = [
            'unknown' => ['ar' => 'غير متوفر', 'en' => 'Unavailable'],
            'angry' => ['ar' => 'غاضب', 'en' => 'Angry'],
            'fear' => ['ar' => 'خائف', 'en' => 'Fear'],
            'happy' => ['ar' => 'سعيد', 'en' => 'Happy'],
            'normal' => ['ar' => 'محايد', 'en' => 'Normal'],
            'sad' => ['ar' => 'حزين', 'en' => 'Sad'],
            'serious' => ['ar' => 'جدي', 'en' => 'Serious'],
            'neutral' => ['ar' => 'محايد', 'en' => 'Neutral'],
        ];

        return $labels[$emotionKey] ?? $labels['unknown'];
    }
}
