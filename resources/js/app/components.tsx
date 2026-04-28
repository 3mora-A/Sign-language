import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowLeftRight,
    AudioLines,
    BookOpenText,
    Brain,
    Camera,
    CheckCircle2,
    ChevronDown,
    CircleAlert,
    CircleDashed,
    CircleOff,
    Globe2,
    HeartHandshake,
    History,
    House,
    Layers3,
    LayoutDashboard,
    LoaderCircle,
    LogOut,
    Menu,
    MoonStar,
    ScanSearch,
    Settings2,
    ShieldCheck,
    Sparkles,
    SunMedium,
    UploadCloud,
    UserCircle2,
    Users,
    Video,
    X,
} from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { appNav, publicNav } from './data';
import { useAppContext } from './context';
import type { AnalysisResult, LocalizedText, NavItem, ThemeMode, Tone } from './types';
import { copyFor, cx, formatDate, formatNumber, formatPercent, initials, toAppPath, toAppUrl, toneClass } from './utils';

const iconMap: Record<string, LucideIcon> = {
    home: House,
    sparkles: Sparkles,
    shield: ShieldCheck,
    globe: Globe2,
    book: BookOpenText,
    history: History,
    settings: Settings2,
    user: UserCircle2,
    camera: Camera,
    upload: UploadCloud,
    brain: Brain,
    heart: HeartHandshake,
    users: Users,
    layers: Layers3,
    frames: Video,
    scan: ScanSearch,
    'layout-dashboard': LayoutDashboard,
};

const pageTransition: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, y: -12, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] as const } },
};

const stagger: Variants = {
    animate: {
        transition: {
            staggerChildren: 0.08,
        },
    },
};

export function AppIcon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
    const Icon = iconMap[name] ?? Sparkles;
    return <Icon className={className} />;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
    const { language } = useAppContext();

    return (
        <Link to="/" className="group flex items-center gap-3">
            <div className="panel-strong flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.09] shadow-[0_8px_28px_-6px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:scale-[1.03]">
                <Sparkles className="h-5 w-5 text-[var(--primary)]" />
            </div>
            {!compact ? (
                <div className="leading-tight transition-opacity group-hover:opacity-95">
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-[rgb(var(--primary-rgb)/0.75)] sm:text-sm sm:tracking-[0.28em]">Deep Learning System</div>
                    <div className="text-lg font-extrabold text-gradient">{language === 'ar' ? 'الإشارة والمشاعر' : 'Sign & Emotion'}</div>
                </div>
            ) : null}
        </Link>
    );
}

export function AnimatedBackground() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="hero-mesh" />
            <motion.div
                className="blur-orb left-[-4rem] top-[8rem] bg-[rgb(var(--accent-rgb)/0.24)]"
                animate={{ y: [0, -22, 0], x: [0, 14, 0] }}
                transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            />
            <motion.div
                className="blur-orb right-[-6rem] top-[18rem] bg-[rgb(var(--secondary-rgb)/0.24)]"
                animate={{ y: [0, 28, 0], x: [0, -18, 0] }}
                transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            />
            <motion.div
                className="blur-orb bottom-[-5rem] left-1/3 bg-[rgb(var(--primary-rgb)/0.2)]"
                animate={{ y: [0, -16, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            />
            <div className="grid-overlay" />
        </div>
    );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

function buttonClass(variant: ButtonVariant) {
    return cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition duration-200',
        variant === 'primary' && 'button-primary',
        variant === 'secondary' && 'button-secondary',
        variant === 'ghost' && 'button-ghost',
    );
}

export function ButtonLink({
    to,
    children,
    className,
    variant = 'primary',
}: {
    to: string;
    children: ReactNode;
    className?: string;
    variant?: ButtonVariant;
}) {
    return (
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Link to={to} className={cx(buttonClass(variant), className)}>
                {children}
            </Link>
        </motion.div>
    );
}

export function ActionButton({
    children,
    className,
    variant = 'primary',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
    return (
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <button className={cx(buttonClass(variant), className)} {...props}>
                {children}
            </button>
        </motion.div>
    );
}

export function Badge({
    tone = 'neutral',
    text,
}: {
    tone?: Tone;
    text: string;
}) {
    return <span className={cx('status-pill', toneClass(tone))}>{text}</span>;
}

export function SectionHeading({
    eyebrow,
    title,
    description,
    align = 'start',
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    align?: 'start' | 'center';
}) {
    return (
        <div className={cx('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h2 className="section-title mt-5 text-balance">{title}</h2>
            {description ? <p className="body-soft mt-5 text-lg leading-8">{description}</p> : null}
        </div>
    );
}

export function SpotlightCard({
    children,
    className,
    noHover = false,
}: {
    children: ReactNode;
    className?: string;
    noHover?: boolean;
}) {
    const [coords, setCoords] = useState({ x: '50%', y: '0%' });

    return (
        <motion.div
            whileHover={noHover ? undefined : { y: -3 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = `${((event.clientX - rect.left) / rect.width) * 100}%`;
                const y = `${((event.clientY - rect.top) / rect.height) * 100}%`;
                setCoords({ x, y });
            }}
            style={{ ['--spotlight-x' as string]: coords.x, ['--spotlight-y' as string]: coords.y }}
            className={cx('panel spotlight rounded-[1.75rem] p-6 md:p-7', className)}
        >
            {children}
        </motion.div>
    );
}

export function StatCard({
    label,
    value,
    detail,
    icon,
}: {
    label: string;
    value: string;
    detail: string;
    icon: string;
}) {
    return (
        <SpotlightCard className="min-h-[180px]">
            <div className="mb-6 inline-flex rounded-2xl border border-[rgb(var(--primary-rgb)/0.12)] bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent p-3 shadow-inner ring-1 ring-white/[0.04]">
                <AppIcon name={icon} className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <p className="body-muted text-sm uppercase tracking-[0.24em]">{label}</p>
            <p className="mt-3 text-4xl font-extrabold">{value}</p>
            <p className="body-soft mt-3 text-sm">{detail}</p>
        </SpotlightCard>
    );
}

export function InputField({
    label,
    icon,
    className,
    ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: string }) {
    return (
        <label className={cx('block space-y-3', className)}>
            <span className="text-sm font-semibold text-[var(--text-soft)]">{label}</span>
            <div className="relative">
                {icon ? <AppIcon name={icon} className="pointer-events-none absolute inset-y-0 top-0 my-auto h-4 w-4 ltr:left-4 rtl:right-4 text-[var(--text-muted)]" /> : null}
                <input
                    {...props}
                    className={cx('input-shell', icon && 'ltr:pl-11 rtl:pr-11', className)}
                />
            </div>
        </label>
    );
}

export function SelectField({
    label,
    children,
    className,
    ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; children: ReactNode }) {
    return (
        <label className={cx('block space-y-3', className)}>
            {label && <span className="text-sm font-semibold text-[var(--text-soft)]">{label}</span>}
            <div className="relative">
                <select {...props} className={cx('input-shell appearance-none', className)}>
                    {children}
                </select>
                <ChevronDown className="pointer-events-none absolute inset-y-0 top-0 my-auto h-4 w-4 ltr:right-4 rtl:left-4 text-[var(--text-muted)]" />
            </div>
        </label>
    );
}

export function OptionGridField({
    label,
    value,
    options,
    onChange,
    className,
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    className?: string;
}) {
    return (
        <div className={cx('space-y-3', className)}>
            <span className="block text-sm font-semibold text-[var(--text-soft)]">{label}</span>
            <div className="grid grid-cols-2 gap-2">
                {options.map((option) => {
                    const active = option.value === value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            aria-pressed={active}
                            className={cx(
                                'rounded-[1.2rem] border px-4 py-3 text-sm font-semibold transition',
                                active
                                    ? 'bg-[rgb(var(--primary-rgb)/0.14)] text-[var(--text)] border-[rgb(var(--primary-rgb)/0.38)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                                    : 'bg-white/[0.03] text-[var(--text-soft)] border-white/10 hover:bg-white/[0.05] hover:text-[var(--text)]',
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function TextAreaField({
    label,
    className,
    ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
    return (
        <label className={cx('block space-y-3', className)}>
            <span className="text-sm font-semibold text-[var(--text-soft)]">{label}</span>
            <textarea {...props} className={cx('input-shell min-h-[140px] resize-none', className)} />
        </label>
    );
}

export function ToggleCard({
    checked,
    onChange,
    title,
    description,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    title: string;
    description: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="panel flex w-full items-start justify-between gap-4 rounded-[1.4rem] p-5 text-start sm:items-center"
        >
            <div className="min-w-0 flex-1">
                <p className="font-semibold">{title}</p>
                <p className="body-soft mt-2 text-sm">{description}</p>
            </div>
            <span
                dir="ltr"
                className={cx(
                    'inline-flex h-8 w-[3.35rem] shrink-0 items-center overflow-hidden rounded-full border border-white/10 p-1 transition',
                    checked ? 'justify-end bg-[rgb(var(--secondary-rgb)/0.72)]' : 'justify-start bg-white/10',
                )}
            >
                <span className="block h-6 w-6 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.16)] transition-transform" />
            </span>
        </button>
    );
}

export function ConfidenceBar({ label, value }: { label: string; value: number }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
                <span className="body-soft">{label}</span>
                <span className="font-bold text-[var(--primary)]">{value.toFixed(1)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/6">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, Math.min(100, value))}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--secondary),var(--primary))]"
                />
            </div>
        </div>
    );
}

export function ProgressTimeline({
    steps,
    activeIndex,
    complete,
}: {
    steps: Array<{ label: string; description: string }>;
    activeIndex: number;
    complete?: boolean;
}) {
    return (
        <div className="space-y-4">
            {steps.map((step, index) => {
                const done = complete || index < activeIndex;
                const current = !complete && index === activeIndex;

                return (
                    <div key={step.label} className="panel-soft flex items-start gap-4 rounded-2xl p-4">
                        <div className={cx('mt-0.5 rounded-full p-2', done ? 'bg-[rgb(var(--primary-rgb)/0.18)] text-[var(--primary)]' : current ? 'bg-[rgb(var(--secondary-rgb)/0.18)] text-[var(--secondary)]' : 'bg-white/5 text-[var(--text-muted)]')}>
                            {done ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : current ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                <CircleDashed className="h-4 w-4" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="font-semibold">{step.label}</p>
                            <p className="body-soft text-sm">{step.description}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon: string;
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <SpotlightCard noHover className="relative flex min-h-[320px] flex-col items-center justify-center !p-10 text-center shadow-inner">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(var(--primary-rgb)/0.09),transparent_60%)]" />
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgb(var(--primary-rgb)/0.25)] bg-gradient-to-br from-[rgb(var(--primary-rgb)/0.15)] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-4 ring-black/20">
                <AppIcon name={icon} className="h-7 w-7 text-[var(--primary)]" />
            </div>
            <h3 className="relative mt-2 text-2xl font-extrabold sm:text-3xl">{title}</h3>
            <p className="body-soft relative mt-4 max-w-xl text-base leading-8">{description}</p>
            {action ? <div className="relative mt-8">{action}</div> : null}
        </SpotlightCard>
    );
}

export function SkeletonBlock({ className }: { className: string }) {
    return <div className={cx('skeleton rounded-2xl', className)} />;
}

function ThemeSwitcher() {
    const { language, resolvedTheme, settings, setTheme } = useAppContext();
    const order: ThemeMode[] = ['dark', 'light'];
    const currentIndex = order.indexOf(settings.theme);
    const next = () => setTheme(order[(currentIndex + 1) % order.length]);
    const icon =
        resolvedTheme === 'dark'
            ? <MoonStar className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2.2} />
            : <SunMedium className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2.2} />;

    return (
        <ActionButton
            variant="ghost"
            aria-label={language === 'ar' ? 'تبديل الوضع الليلي/النهاري' : 'Toggle light/dark'}
            onClick={next}
            className="h-11 w-11 shrink-0 rounded-2xl px-0 text-lg"
        >
            <span aria-hidden="true" className="inline-flex items-center justify-center">{icon}</span>
        </ActionButton>
    );
}

function LanguageSwitcher() {
    const { language, setLanguage } = useAppContext();
    return (
        <ActionButton
            variant="ghost"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="min-w-[5.2rem]"
        >
            <ArrowLeftRight className="h-4 w-4" />
            <span>{language === 'ar' ? 'EN' : 'ع'}</span>
        </ActionButton>
    );
}

async function postLogout(token: string, url: string) {
    const response = await fetch(toAppUrl(url), {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': token,
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as { redirect?: string } | null;
    window.location.href = toAppPath(payload?.redirect) || '/login';
}

function PublicLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
    const { language, boot } = useAppContext();
    const visibleItems = useMemo(
        () => items.filter((item) => !item.adminOnly && (!boot.auth.isAuthenticated || item.to !== '/history')),
        [boot.auth.isAuthenticated, items],
    );

    return (
        <>
            {visibleItems.map((item) => (
                <NavLink
                    key={item.to}
                    end={item.exact}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                        cx(
                            'rounded-full px-4 py-2 text-sm font-semibold transition',
                            isActive
                                ? 'bg-[rgb(var(--primary-rgb)/0.16)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[rgb(var(--primary-rgb)/0.22)]'
                                : 'text-[var(--text-soft)] hover:bg-white/[0.06] hover:text-white',
                        )
                    }
                >
                    {copyFor(language, item.label)}
                </NavLink>
            ))}
        </>
    );
}

export function Navbar() {
    const { boot, language } = useAppContext();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-gradient-to-b from-[rgba(14,10,10,0.88)] via-[rgba(12,9,9,0.72)] to-[rgba(10,8,8,0.55)] backdrop-blur-2xl shadow-[0_4px_36px_-10px_rgba(0,0,0,0.55)]">
            <div className="app-container flex h-20 items-center justify-between gap-4">
                <BrandMark />
                <nav className="hidden items-center gap-2 lg:flex">
                    <PublicLinks items={publicNav} />
                </nav>
                <div className="hidden items-center gap-3 lg:flex">
                    <LanguageSwitcher />
                    <ThemeSwitcher />
                    {boot.auth.isAuthenticated ? (
                        <ButtonLink to={boot.auth.isAdmin ? '/admin/dashboard' : '/upload'}>{language === 'ar' ? 'الرفع والتحليل' : 'Upload & Analysis'}</ButtonLink>
                    ) : (
                        <>
                            <ButtonLink to="/login" variant="ghost">
                                {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                            </ButtonLink>
                            <ButtonLink to="/register">{language === 'ar' ? 'ابدأ الآن' : 'Get started'}</ButtonLink>
                        </>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2 lg:hidden">
                    <ThemeSwitcher />
                    <ActionButton variant="ghost" className="h-11 w-11 shrink-0 rounded-2xl px-0 text-[var(--primary)]" onClick={() => setMobileOpen((value) => !value)}>
                        {mobileOpen ? <X className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2.2} /> : <Menu className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2.2} />}
                    </ActionButton>
                </div>
            </div>
            <AnimatePresence>
                {mobileOpen ? (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/5 lg:hidden"
                    >
                        <div className="app-container flex flex-col gap-2 py-4">
                            <PublicLinks items={publicNav} onNavigate={() => setMobileOpen(false)} />
                            <div className="mt-2 flex flex-wrap gap-2">
                                <LanguageSwitcher />
                                {boot.auth.isAuthenticated ? (
                                    <ButtonLink to={boot.auth.isAdmin ? '/admin/dashboard' : '/upload'} className="flex-1" variant="secondary">
                                        {language === 'ar' ? 'الرفع والتحليل' : 'Upload & Analysis'}
                                    </ButtonLink>
                                ) : (
                                    <>
                                        <ButtonLink to="/login" className="flex-1" variant="ghost">
                                            {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                                        </ButtonLink>
                                        <ButtonLink to="/register" className="flex-1">
                                            {language === 'ar' ? 'ابدأ الآن' : 'Get started'}
                                        </ButtonLink>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </header>
    );
}

export function Footer() {
    const { language } = useAppContext();
    return (
        <footer className="relative mt-auto border-t border-white/[0.07] bg-gradient-to-t from-black/25 via-transparent to-transparent py-10">
            <div className="app-container flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <BrandMark compact />
                <p className="body-soft text-sm">
                    {language === 'ar'
                        ? 'نظام تعلم عميق متكامل لتصنيف لغة الإشارة والمشاعر — مدعوم بـ Laravel وPython.'
                        : 'End-to-end deep learning system for sign language and emotion classification — powered by Laravel and Python.'}
                </p>
            </div>
        </footer>
    );
}

export function DashboardFrame({ children }: { children: ReactNode }) {
    const { boot, language, direction } = useAppContext();
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const navItems = appNav.filter((item) => !item.adminOnly || boot.auth.isAdmin);

    useEffect(() => {
        setMobileOpen(false);
    }, [direction]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const desktopMedia = window.matchMedia('(min-width: 1024px)');
        const syncDesktopState = () => {
            if (desktopMedia.matches) {
                setMobileOpen(false);
            }
        };

        syncDesktopState();

        if (typeof desktopMedia.addEventListener === 'function') {
            desktopMedia.addEventListener('change', syncDesktopState);
            return () => desktopMedia.removeEventListener('change', syncDesktopState);
        }

        desktopMedia.addListener(syncDesktopState);
        return () => desktopMedia.removeListener(syncDesktopState);
    }, []);

    return (
        <div className="app-container relative py-6">
            <AnimatePresence>
                {mobileOpen ? (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setMobileOpen(false)}
                        className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
                    />
                ) : null}
            </AnimatePresence>

            <motion.aside
                initial={false}
                animate={mobileOpen ? { x: 0 } : { x: 0 }}
                className={cx(
                    'panel dashboard-sidebar-mobile flex shrink-0 flex-col rounded-[2rem] border-white/[0.08] p-5 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.5)] ring-1 ring-black/20 lg:hidden',
                    mobileOpen ? 'translate-x-0' : 'ltr:-translate-x-[120%] rtl:translate-x-[120%]',
                    'transition-transform duration-300',
                )}
            >
                <div className="flex items-center justify-between">
                    <BrandMark compact />
                    <ActionButton variant="ghost" className="h-10 w-10 shrink-0 rounded-2xl px-0 text-[var(--primary)] lg:hidden" onClick={() => setMobileOpen(false)}>
                        <X className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2.2} />
                    </ActionButton>
                </div>
                <div className="mt-8 space-y-1.5">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            end={item.exact}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => cx('sidebar-link', isActive && 'sidebar-link-active')}
                        >
                            <AppIcon name={item.icon} className="h-4 w-4" />
                            <span className="font-semibold">{copyFor(language, item.label)}</span>
                        </NavLink>
                    ))}
                </div>
                <div className="panel-soft mt-auto rounded-[1.6rem] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold">{boot.auth.user?.name ?? 'Guest User'}</p>
                            <p className="body-soft text-xs">{boot.auth.user?.email ?? 'visitor@example.com'}</p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold">
                            {initials(boot.auth.user?.name)}
                        </div>
                    </div>
                    <ActionButton
                        variant="ghost"
                        className="mt-4 w-full justify-between text-left"
                        onClick={() => postLogout(boot.csrfToken, boot.routes.logout)}
                        aria-label={language === 'ar' ? 'تسجيل الخروج' : 'Log out'}
                    >
                        <span className="font-semibold">{language === 'ar' ? 'تسجيل الخروج' : 'Log out'}</span>
                        <LogOut className="h-4 w-4" />
                    </ActionButton>
                </div>
            </motion.aside>

            <div key={direction} className={cx('dashboard-shell', direction === 'rtl' ? 'lg:flex-row-reverse' : 'lg:flex-row')} dir="ltr">
            <aside
                className="panel dashboard-sidebar-desktop hidden shrink-0 flex-col rounded-[2rem] border-white/[0.08] p-5 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04] lg:flex lg:h-[calc(100vh-3rem)]"
                dir={direction}
            >
                <div className="flex items-center justify-between">
                    <BrandMark compact />
                </div>
                <div className="mt-8 space-y-1.5">
                    {navItems.map((item) => (
                        <NavLink
                            key={`desktop-${item.to}`}
                            end={item.exact}
                            to={item.to}
                            className={({ isActive }) => cx('sidebar-link', isActive && 'sidebar-link-active')}
                        >
                            <AppIcon name={item.icon} className="h-4 w-4" />
                            <span className="font-semibold">{copyFor(language, item.label)}</span>
                        </NavLink>
                    ))}
                </div>
                <div className="panel-soft mt-auto rounded-[1.6rem] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold">{boot.auth.user?.name ?? 'Guest User'}</p>
                            <p className="body-soft text-xs">{boot.auth.user?.email ?? 'visitor@example.com'}</p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold">
                            {initials(boot.auth.user?.name)}
                        </div>
                    </div>
                    <ActionButton
                        variant="ghost"
                        className="mt-4 w-full justify-between"
                        onClick={() => postLogout(boot.csrfToken, boot.routes.logout)}
                    >
                        <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log out'}</span>
                        <LogOut className="h-4 w-4" />
                    </ActionButton>
                </div>
            </aside>

            <div className="dashboard-main" dir={direction}>
        <div className="panel-soft flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/[0.08] px-5 py-4 shadow-inner">
                    <div className="flex min-w-0 items-center gap-3">
                        <ActionButton variant="ghost" className="h-11 w-11 shrink-0 rounded-2xl px-0 text-[var(--primary)] lg:hidden" onClick={() => setMobileOpen(true)}>
                            <Menu className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2.2} />
                        </ActionButton>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <LanguageSwitcher />
                        <ThemeSwitcher />
                    </div>
                </div>
                <motion.div variants={stagger} initial="initial" animate="animate" exit="exit">
                    {children}
                </motion.div>
            </div>
            </div>
        </div>
    );
}

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    className,
}: {
    eyebrow?: string;
    title: string;
    description: string;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <motion.div variants={pageTransition} className={cx('mb-10 flex flex-col gap-6 border-b border-white/[0.06] pb-10 xl:flex-row xl:items-end xl:justify-between', className)}>
            <div className="max-w-3xl">
                {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
                <h1 className="page-title mt-4 text-balance">{title}</h1>
                <p className="body-soft mt-4 text-base leading-8">{description}</p>
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </motion.div>
    );
}

export function InsightRow({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    tone?: Tone;
}) {
    return (
        <div className="panel-soft flex items-center justify-between gap-3 rounded-2xl border border-white/[0.04] px-4 py-3 transition-colors hover:border-[rgb(var(--primary-rgb)/0.14)]">
            <span className="body-soft text-sm">{label}</span>
            <Badge tone={tone} text={value} />
        </div>
    );
}

export function AnalysisHeroCard({ analysis }: { analysis: AnalysisResult }) {
    const { language } = useAppContext();

    return (
        <SpotlightCard className="relative overflow-hidden !p-0 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.45)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgb(var(--primary-rgb)/0.12),transparent_60%)]" />
            <div className="relative border-b border-white/[0.06] p-6 sm:p-8 xl:p-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="max-w-2xl flex-1">
                        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            {language === 'ar' ? 'الإشارة المُصنَّفة' : 'Classified sign'}
                        </p>
                        <h3 className="mt-3 text-balance text-4xl font-extrabold sm:text-5xl xl:text-6xl">
                            {copyFor(language, analysis.gestureLabel)}
                        </h3>
                        <p className="body-soft mt-5 text-base leading-relaxed sm:text-lg">
                            {copyFor(language, analysis.summary)}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-3 text-right">
                        <Badge tone={analysis.status === 'processed' ? 'success' : 'warning'} text={analysis.status === 'processed' ? (language === 'ar' ? 'مكتمل' : 'Completed') : language === 'ar' ? 'قيد المراجعة' : 'Needs review'} />
                        <p className="body-soft font-mono text-[0.6875rem] tracking-wider text-[var(--text-muted)]">{formatDate(language, analysis.createdAt)}</p>
                    </div>
                </div>
            </div>

            <div className="relative bg-black/20 p-6 sm:p-8 xl:px-10">
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-8 xl:items-center">
                    <InsightRow label={language === 'ar' ? 'المشاعر' : 'Emotion'} value={copyFor(language, analysis.emotionLabel)} tone="info" />
                    <InsightRow label={language === 'ar' ? 'زمن التحليل' : 'Latency'} value={`${formatNumber(language, analysis.latencyMs)} ms`} tone="warning" />
                    <div className="xl:pl-4">
                        <ConfidenceBar label={language === 'ar' ? 'درجة الثقة' : 'Confidence'} value={analysis.confidence} />
                    </div>
                </div>
            </div>
        </SpotlightCard>
    );
}

export function ToastBanner() {
    const { toast, setToast } = useAppContext();

    return (
        <AnimatePresence>
            {toast ? (
                <motion.div
                    initial={{ opacity: 0, y: -16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.98 }}
                    className="fixed left-1/2 top-5 z-[80] w-[min(92vw,480px)] -translate-x-1/2"
                >
                    <div className="panel-strong flex items-start gap-4 rounded-[1.6rem] p-4">
                        <div className={cx('mt-0.5 rounded-full p-2', toneClass(toast.tone))}>
                            {toast.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : toast.tone === 'error' ? <CircleAlert className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}
                        </div>
                        <p className="flex-1 text-sm font-semibold leading-7">{toast.message}</p>
                        <button type="button" onClick={() => setToast(null)} className="rounded-full p-1 text-[var(--text-muted)] transition hover:text-white">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}

export function LoadingPanel({ title, description }: { title: string; description: string }) {
    return (
        <div className="panel rounded-[1.85rem] border border-white/[0.06] p-6 shadow-inner">
            <div className="flex items-center gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <LoaderCircle className="h-5 w-5 animate-spin text-[var(--primary)]" />
                </div>
                <div>
                    <p className="font-bold">{title}</p>
                    <p className="body-soft mt-1 text-sm">{description}</p>
                </div>
            </div>
        </div>
    );
}

export const motionVariants = {
    pageTransition,
    stagger,
};
