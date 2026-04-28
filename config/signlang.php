<?php

return [
    'inference' => [
        'base_url' => rtrim(env('PYTHON_INFERENCE_URL', 'http://127.0.0.1:8001'), '/'),
        'predict_path' => env('PYTHON_INFERENCE_PREDICT_PATH', '/predict'),
        'timeout' => (int) env('PYTHON_INFERENCE_TIMEOUT', 120),
    ],

    'uploads' => [
        'storage_driver' => env('MEDIA_STORAGE_DRIVER', 'disk'),
        'disk' => env('MEDIA_UPLOAD_DISK', env('FILESYSTEM_DISK', 'public')),
        'directory' => trim(env('MEDIA_UPLOAD_DIRECTORY', 'uploads'), '/'),
        'database_max_bytes' => (int) env('MEDIA_DATABASE_MAX_BYTES', 262144),
        'max_kb' => (int) env('MEDIA_MAX_UPLOAD_KB', 102400),
        'allowed_mimes' => array_values(array_filter(array_map(
            static fn (string $mime): string => trim($mime),
            explode(',', env('MEDIA_ALLOWED_MIMES', 'mp4,avi,mov,jpeg,png,jpg,gif'))
        ))),
    ],

    'defaults' => [
        'fallback_user_id' => (int) env('ANALYSIS_FALLBACK_USER_ID', 1),
        'gesture_language' => env('DEFAULT_GESTURE_LANGUAGE', 'ArSL'),
    ],
];
