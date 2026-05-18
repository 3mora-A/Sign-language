import { startTransition, createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AnalysisResult, AppSettings, BootPayload, ThemeMode, ToastMessage } from './types';

const defaultBoot: BootPayload = {
    csrfToken: '',
    path: '/',
    auth: { isAuthenticated: false, isAdmin: false, user: null },
    routes: {
        home: '/',
        login: '/login',
        register: '/register',
        forgotPassword: '/forgot-password',
        resetPassword: '/reset-password',
        verifyEmail: '/verify-email',
        dashboard: '/upload',
        upload: '/upload',
        live: '/live',
        results: '/results',
        history: '/history',
        settings: '/settings',
        profile: '/profile',
        adminDashboard: '/admin/dashboard',
        logout: '/logout',
    },
    flash: null,
    latestAnalysis: null,
    history: [],
    dashboard: {
        stats: { analyses: 128, successRate: 98.4, avgLatency: 640, activeModels: 1 },
        systemStatus: [],
    },
    admin: null,
};

const settingsStorageKey = 'signsense.settings';
const latestAnalysisStorageKey = 'signsense.latest-analysis';

interface AppContextValue {
    boot: BootPayload;
    language: 'ar' | 'en';
    direction: 'rtl' | 'ltr';
    resolvedTheme: ThemeMode;
    settings: AppSettings;
    history: AnalysisResult[];
    latestAnalysis: AnalysisResult | null;
    toast: ToastMessage | null;
    updateSettings: (patch: Partial<AppSettings>) => void;
    setLanguage: (language: 'ar' | 'en') => void;
    setTheme: (theme: ThemeMode) => void;
    setToast: (toast: ToastMessage | null) => void;
    addHistoryItem: (analysis: AnalysisResult) => void;
    setLatestAnalysis: (analysis: AnalysisResult | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readBoot(): BootPayload {
    return window.__APP_BOOT__ ?? defaultBoot;
}

function getSystemTheme(): ThemeMode {
    if (typeof window.matchMedia !== 'function') {
        return 'dark';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function normalizeTheme(theme: unknown): ThemeMode {
    if (theme === 'dark' || theme === 'light') {
        return theme;
    }

    return getSystemTheme();
}

function readStoredJson<T>(storage: Storage, key: string): T | null {
    const raw = storage.getItem(key);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        storage.removeItem(key);
        return null;
    }
}

function loadSettings(boot: BootPayload): AppSettings {
    const parsed = readStoredJson<Partial<AppSettings>>(window.localStorage, settingsStorageKey) ?? {};

    return {
        language: parsed.language ?? boot.auth.user?.preferredLanguage ?? 'ar',
        theme: normalizeTheme(parsed.theme),
        fontScale: parsed.fontScale ?? 'comfortable',
        reducedMotion: parsed.reducedMotion ?? false,
        saveHistory: parsed.saveHistory ?? true,
        accessibilityMode: parsed.accessibilityMode ?? false,
        notifications: parsed.notifications ?? true,
    };
}

function loadLatestAnalysis(boot: BootPayload): AnalysisResult | null {
    const stored = readStoredJson<AnalysisResult>(window.sessionStorage, latestAnalysisStorageKey);
    if (stored) {
        return stored;
    }

    return boot.latestAnalysis ?? boot.history[0] ?? null;
}

export function AppProvider({ children }: { children: ReactNode }) {
    const boot = useMemo(readBoot, []);
    const [settings, setSettings] = useState<AppSettings>(() => loadSettings(boot));
    const [history, setHistory] = useState<AnalysisResult[]>(boot.history);
    const [latestAnalysis, setLatestAnalysisState] = useState<AnalysisResult | null>(() => loadLatestAnalysis(boot));
    const [toast, setToast] = useState<ToastMessage | null>(boot.flash);
    const resolvedTheme = settings.theme;
    const direction = settings.language === 'ar' ? 'rtl' : 'ltr';

    useEffect(() => {
        document.documentElement.lang = settings.language;
        document.documentElement.dir = direction;
        document.documentElement.dataset.theme = resolvedTheme;
        document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
        document.documentElement.style.setProperty('--font-scale', settings.fontScale === 'large' ? '1.06' : '1');
        window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    }, [direction, resolvedTheme, settings]);

    useEffect(() => {
        if (latestAnalysis) {
            window.sessionStorage.setItem(latestAnalysisStorageKey, JSON.stringify(latestAnalysis));
            return;
        }

        window.sessionStorage.removeItem(latestAnalysisStorageKey);
    }, [latestAnalysis]);

    useEffect(() => {
        if (!toast) {
            return undefined;
        }

        const timeout = window.setTimeout(() => setToast(null), 4200);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    const updateSettings = (patch: Partial<AppSettings>) => {
        startTransition(() => {
            setSettings((current) => ({ ...current, ...patch }));
        });
    };

    const setLatestAnalysis = (analysis: AnalysisResult | null) => {
        setLatestAnalysisState(analysis);
        if (analysis) {
            setHistory((current) => {
                const withoutDuplicate = current.filter((entry) => String(entry.id) !== String(analysis.id));
                return [analysis, ...withoutDuplicate].slice(0, 20);
            });
        }
    };

    const addHistoryItem = (analysis: AnalysisResult) => {
        setHistory((current) => {
            const withoutDuplicate = current.filter((entry) => String(entry.id) !== String(analysis.id));
            return [analysis, ...withoutDuplicate].slice(0, 20);
        });
    };

    const value = useMemo<AppContextValue>(
        () => ({
            boot,
            language: settings.language,
            direction,
            resolvedTheme,
            settings,
            history,
            latestAnalysis,
            toast,
            updateSettings,
            setLanguage: (language) => updateSettings({ language }),
            setTheme: (theme) => updateSettings({ theme }),
            setToast,
            addHistoryItem,
            setLatestAnalysis,
        }),
        [boot, direction, history, latestAnalysis, resolvedTheme, settings, toast],
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
}
