import type { Language, LocalizedText, Tone } from './types';

export function cx(...values: Array<string | false | null | undefined>): string {
    return values.filter(Boolean).join(' ');
}

export function copyFor(language: Language, copy: LocalizedText): string {
    return copy[language];
}

export function createCopy(ar: string, en: string): LocalizedText {
    return { ar, en };
}

export function formatNumber(language: Language, value: number): string {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        maximumFractionDigits: value % 1 === 0 ? 0 : 1,
    }).format(value);
}

export function formatPercent(language: Language, value: number): string {
    return `${formatNumber(language, value)}%`;
}

export function formatDate(language: Language, value?: string | null): string {
    if (!value) {
        return language === 'ar' ? 'الآن' : 'Now';
    }

    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function initials(name?: string | null): string {
    if (!name) {
        return 'AI';
    }

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}

export function toneClass(tone: Tone): string {
    switch (tone) {
        case 'success':
            return 'status-success';
        case 'warning':
            return 'status-warning';
        case 'error':
            return 'status-error';
        case 'info':
            return 'status-info';
        default:
            return 'status-neutral';
    }
}

export function toAppPath(target?: string | null): string {
    if (!target) {
        return '/';
    }

    if (target.startsWith('/')) {
        return target;
    }

    try {
        const url = new URL(target, window.location.origin);
        if (url.origin === window.location.origin) {
            return `${url.pathname}${url.search}${url.hash}` || '/';
        }
    } catch {
        return target;
    }

    return target;
}

export function toAppUrl(target?: string | null): string {
    return new URL(toAppPath(target), window.location.origin).toString();
}

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}
