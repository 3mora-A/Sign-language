export type Language = 'ar' | 'en';
export type ThemeMode = 'dark' | 'light';
export type FontScale = 'comfortable' | 'large';
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface LocalizedText {
    ar: string;
    en: string;
}

export interface AnalysisAlternative {
    key: string;
    label: LocalizedText;
    confidence: number;
}

export interface AnalysisResult {
    id: number | string;
    status: string;
    fileName: string;
    mediaType?: 'image' | 'video';
    previewUrl?: string;
    createdAt?: string | null;
    framesAnalyzed: number;
    latencyMs: number;
    confidence: number;
    emotionKey: string;
    emotionLabel: LocalizedText;
    summary: LocalizedText;
    alternatives: AnalysisAlternative[];
}

export interface BootPayload {
    csrfToken: string;
    path: string;
    auth: {
        isAuthenticated: boolean;
        isAdmin: boolean;
        user: {
            id: number;
            name: string;
            email: string;
            role: string;
            preferredLanguage: Language;
        } | null;
    };
    routes: {
        home: string;
        login: string;
        register: string;
        forgotPassword: string;
        resetPassword: string;
        verifyEmail: string;
        dashboard: string;
        upload: string;
        live: string;
        results: string;
        history: string;
        settings: string;
        profile: string;
        adminDashboard: string;
        logout: string;
    };
    flash: {
        tone: Tone;
        message: string;
    } | null;
    latestAnalysis: AnalysisResult | null;
    history: AnalysisResult[];
    dashboard: {
        stats: {
            analyses: number;
            successRate: number;
            avgLatency: number;
            activeModels: number;
        };
        systemStatus: {
            label: LocalizedText;
            value: LocalizedText;
            tone: Tone;
        }[];
    };
    admin: {
        metrics: {
            users: number;
            videos: number;
            processed: number;
            failed: number;
        };
    } | null;
}

export interface AppSettings {
    language: Language;
    theme: ThemeMode;
    fontScale: FontScale;
    reducedMotion: boolean;
    saveHistory: boolean;
    accessibilityMode: boolean;
    notifications: boolean;
}

export interface NavItem {
    to: string;
    label: LocalizedText;
    icon: string;
    exact?: boolean;
    adminOnly?: boolean;
}

export interface FeatureCard {
    title: LocalizedText;
    description: LocalizedText;
    icon: string;
    tone: Tone;
}

export interface WorkflowStep {
    title: LocalizedText;
    description: LocalizedText;
    icon: string;
}

export interface QuickAction {
    to: string;
    title: LocalizedText;
    description: LocalizedText;
    icon: string;
}

export interface ToastMessage {
    tone: Tone;
    message: string;
}
