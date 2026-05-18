<?php

namespace App\Http\Controllers;

use App\Models\Prediction;
use App\Models\User;
use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class SpaController extends Controller
{
    public function show(Request $request)
    {
        $user = Auth::user();
        $isAdmin = $user?->role === 'admin';
        $baseHistoryQuery = Video::query()
            ->with(['prediction.gesture', 'prediction.emotion'])
            ->when(!$isAdmin && $user, fn ($query) => $query->where('user_id', $user->id));

        $history = $user
            ? (clone $baseHistoryQuery)
                ->latest()
                ->take(12)
                ->get([
                    'id',
                    'status',
                    'video_path',
                    'storage_disk',
                    'original_name',
                    'mime_type',
                    'file_size',
                    'result',
                    'error_message',
                    'created_at',
                ])
                ->map(fn (Video $video) => $this->transformVideo($video))
                ->values()
            : collect();

        $summary = $user
            ? (clone $baseHistoryQuery)
                ->selectRaw('COUNT(*) as total_count')
                ->selectRaw("SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed_count")
                ->first()
            : null;

        $totalCount = (int) ($summary?->total_count ?? 0);
        $processedCount = (int) ($summary?->processed_count ?? 0);
        $successRate = $totalCount > 0 ? round(($processedCount / $totalCount) * 100, 1) : 98.4;
        $avgLatency = $user
            ? (int) round(
                Prediction::query()
                    ->whereHas('video', fn ($query) => $query->when(!$isAdmin, fn ($videoQuery) => $videoQuery->where('user_id', $user->id)))
                    ->avg('latency_ms') ?? 640
            )
            : 640;

        $boot = [
            'csrfToken' => csrf_token(),
            'path' => $request->path() === '/' ? '/' : '/' . trim($request->path(), '/'),
            'auth' => [
                'isAuthenticated' => (bool) $user,
                'isAdmin' => $isAdmin,
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'preferredLanguage' => $user->preferred_language ?? 'ar',
                ] : null,
            ],
            'routes' => [
                'home' => '/',
                'login' => '/login',
                'register' => '/register',
                'forgotPassword' => '/forgot-password',
                'resetPassword' => '/reset-password',
                'verifyEmail' => '/verify-email',
                'dashboard' => '/dashboard',
                'upload' => '/upload',
                'live' => '/live',
                'results' => '/results',
                'dictionary' => '/dictionary',
                'history' => '/history',
                'settings' => '/settings',
                'profile' => '/profile',
                'adminDashboard' => '/admin/dashboard',
                'logout' => '/logout',
            ],
            'flash' => $this->getFlashMessage(),
            'latestAnalysis' => session('analysis_result') ?? $history->first(),
            'history' => $history,
            'dashboard' => [
                'stats' => [
                    'analyses' => $totalCount ?: 128,
                    'successRate' => $successRate,
                    'avgLatency' => $avgLatency,
                    'activeModels' => 2,
                ],
                'systemStatus' => $this->systemStatus(),
            ],
            'admin' => $isAdmin ? [
                'metrics' => $this->adminMetrics(),
            ] : null,
        ];

        return view('spa', [
            'boot' => $boot,
            'initialLanguage' => $user?->preferred_language ?? 'ar',
        ]);
    }

    private function getFlashMessage(): ?array
    {
        if (session('success')) {
            return [
                'tone' => 'success',
                'message' => session('success'),
            ];
        }

        if (session('error')) {
            return [
                'tone' => 'error',
                'message' => session('error'),
            ];
        }

        return null;
    }

    private function systemStatus(): array
    {
        return [
            [
                'label' => ['ar' => 'Laravel API', 'en' => 'Laravel API'],
                'value' => ['ar' => 'متصل', 'en' => 'Online'],
                'tone' => 'success',
            ],
            [
                'label' => ['ar' => 'Python Inference', 'en' => 'Python Inference'],
                'value' => ['ar' => 'جاهز', 'en' => 'Ready'],
                'tone' => 'info',
            ],
            [
                'label' => ['ar' => 'Pipeline Queue', 'en' => 'Pipeline Queue'],
                'value' => ['ar' => 'مستقر', 'en' => 'Stable'],
                'tone' => 'success',
            ],
        ];
    }

    private function adminMetrics(): array
    {
        return Cache::remember('spa.admin.metrics', now()->addSeconds(30), function (): array {
            $videoSummary = Video::query()
                ->selectRaw('COUNT(*) as total_videos')
                ->selectRaw("SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed_count")
                ->selectRaw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count")
                ->first();

            return [
                'users' => User::count(),
                'videos' => (int) ($videoSummary?->total_videos ?? 0),
                'processed' => (int) ($videoSummary?->processed_count ?? 0),
                'failed' => (int) ($videoSummary?->failed_count ?? 0),
            ];
        });
    }

    private function transformVideo(Video $video): array
    {
        $prediction = $video->prediction;
        $emotionValue = $this->normalizeText($prediction?->emotion?->name ?? $video->result ?? 'unknown', 'unknown');
        $emotionKey = Str::lower($emotionValue);
        $emotionLabel = $this->emotionLabel($emotionKey);
        $confidence = $this->normalizePercentage($prediction?->emotion_confidence ?? $prediction?->confidence);
        $framesAnalyzed = max(0, (int) ($prediction?->frames_analyzed ?? 0));
        $latencyMs = max(0, (int) ($prediction?->latency_ms ?? 0));
        $alternatives = $this->buildEmotionAlternatives($video, $prediction, $emotionKey, $confidence);
        $isFailure = $video->status === 'failed';

        return [
            'id' => $video->id,
            'status' => $video->status,
            'fileName' => $video->original_name ?: basename((string) $video->video_path),
            'mediaType' => $this->resolveMediaType($video),
            'previewUrl' => $this->previewUrlForVideo($video),
            'confidence' => $confidence,
            'framesAnalyzed' => $framesAnalyzed,
            'latencyMs' => $latencyMs,
            'createdAt' => optional($video->created_at)->toIso8601String(),
            'gestureKey' => $emotionKey,
            'gestureLabel' => $emotionLabel,
            'emotionKey' => $emotionKey,
            'emotionLabel' => $emotionLabel,
            'summary' => $this->buildSummary($video, $emotionKey, $isFailure),
            'alternatives' => $alternatives,
        ];
    }

    private function buildEmotionAlternatives(
        Video $video,
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

        if ($video->status !== 'processed') {
            return [];
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
                'ar' => $video->error_message ?: 'اكتملت الجلسة لكن التحليل لم ينجح هذه المرة.',
                'en' => $video->error_message ?: 'The session completed, but the analysis did not succeed this time.',
            ];
        }

        $emotionLabel = $this->emotionLabel($emotionKey);

        return [
            'ar' => "تم تحليل الجلسة وتحديد الحالة الشعورية \"{$emotionLabel['ar']}\" بنجاح.",
            'en' => "The session was analyzed and the emotional state \"{$emotionLabel['en']}\" was detected successfully.",
        ];
    }

    private function previewUrlForVideo(Video $video): ?string
    {
        return $video->exists ? route('media.preview', $video) : null;
    }

    private function resolveMediaType(Video $video): string
    {
        if ($video->mime_type && Str::startsWith($video->mime_type, 'image/')) {
            return 'image';
        }

        return $this->isImageFilename((string) ($video->original_name ?: $video->video_path)) ? 'image' : 'video';
    }

    private function normalizeText(mixed $value, string $fallback): string
    {
        if (is_string($value) || is_numeric($value)) {
            $normalized = trim((string) $value);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return $fallback;
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
            'stop' => ['ar' => 'توقف', 'en' => 'Stop'],
            'help' => ['ar' => 'أحتاج مساعدة', 'en' => 'I need help'],
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
