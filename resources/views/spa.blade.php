<!DOCTYPE html>
<html lang="{{ $initialLanguage }}" dir="{{ $initialLanguage === 'ar' ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ $boot['csrfToken'] }}">
    <meta name="theme-color" content="#06131f">
    <link rel="icon" type="image/svg+xml" href="{{ asset('favicon.svg') }}">
    <link rel="shortcut icon" href="{{ asset('favicon.svg') }}">
    <title>End-to-End Deep Learning System for Sign Language and Emotion Classification</title>
    <style>
        .boot-fallback {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background:
                radial-gradient(circle at 20% 20%, rgba(110, 231, 249, 0.22), transparent 44%),
                radial-gradient(circle at 78% 24%, rgba(124, 156, 251, 0.24), transparent 30%),
                radial-gradient(circle at 50% 88%, rgba(52, 211, 153, 0.14), transparent 34%),
                #04111b;
            color: #eef5ff;
            font-family: system-ui, sans-serif;
        }

        .boot-fallback__card {
            width: min(100%, 760px);
            border: 1px solid rgba(125, 211, 252, 0.26);
            border-radius: 24px;
            padding: 24px;
            background: rgba(11, 34, 52, 0.92);
            box-shadow: 0 26px 64px rgba(3, 10, 20, 0.3);
        }

        .boot-fallback__eyebrow {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 999px;
            border: 1px solid rgba(110, 231, 249, 0.18);
            color: #9be7f8;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
    </style>
    <script>
        window.__APP_BOOT__ = @json($boot);
        window.__showBootError = function (message) {
            const app = document.getElementById('app');
            if (!app) return;

            app.innerHTML = `
                <div class="boot-fallback">
                    <div class="boot-fallback__card">
                        <div class="boot-fallback__eyebrow">System Error</div>
                        <h1 style="margin-top:16px;font-size:32px;font-weight:800;">The deep learning interface failed to start.</h1>
                        <p style="margin-top:16px;line-height:1.8;white-space:pre-wrap;">${String(message ?? 'Unknown error')}</p>
                    </div>
                </div>
            `;
        };

        window.addEventListener('error', function (event) {
            const message = event?.error?.message || event?.message || 'Unknown runtime error';
            window.__showBootError(message);
        });

        window.addEventListener('unhandledrejection', function (event) {
            const reason = event?.reason;
            const message =
                typeof reason === 'string'
                    ? reason
                    : reason?.message || 'Unhandled promise rejection';

            window.__showBootError(message);
        });
    </script>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
</head>
<body>
    <div id="app">
        <div class="boot-fallback">
            <div class="boot-fallback__card">
                <div class="boot-fallback__eyebrow">Loading</div>
                <h1 style="margin-top:16px;font-size:32px;font-weight:800;">Initializing deep learning system...</h1>
                <p style="margin-top:16px;line-height:1.8;">Loading inference modules for sign language and emotion classification. If this message persists, the application bundle likely failed before rendering.</p>
            </div>
        </div>
    </div>
</body>
</html>
