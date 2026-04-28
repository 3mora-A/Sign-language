import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        react(),
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        tailwindcss(),
    ],
    optimizeDeps: {
        entries: [
            'resources/js/app.tsx',
            'resources/js/bootstrap.js',
            'resources/js/app/**/*.tsx',
        ],
        include: [
            'react',
            'react/jsx-runtime',
            'react-dom/client',
            'react-router-dom',
            'framer-motion',
            'lucide-react',
        ],
        holdUntilCrawlEnd: false,
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        hmr: {
            host: '127.0.0.1',
        },
        warmup: {
            clientFiles: [
                './resources/css/app.css',
                './resources/js/app.tsx',
                './resources/js/app/App.tsx',
                './resources/js/app/components.tsx',
                './resources/js/app/context.tsx',
                './resources/js/app/public-pages.tsx',
                './resources/js/app/workspace-pages.tsx',
                './resources/js/app/analysis-pages.tsx',
            ],
        },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
