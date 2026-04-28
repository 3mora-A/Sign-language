import { AnimatePresence } from 'framer-motion';
import {
    Component,
    Suspense,
    lazy,
    useEffect,
    useMemo,
    useState,
    type ErrorInfo,
    type ReactNode,
} from 'react';
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useLocation,
} from 'react-router-dom';
import {
    AnimatedBackground,
    ButtonLink,
    DashboardFrame,
    EmptyState,
    Footer,
    LoadingPanel,
    Navbar,
    ToastBanner,
} from './components';
import { useAppContext } from './context';

/* ──────────────────────────────────────────────────────────────
 * Lazy-loaded modules
 * ───────────────────────────────────────────────────────────── */

const loadPublicPages = () => import('./public-pages');
const loadWorkspacePages = () => import('./workspace-pages');
const loadAnalysisPages = () => import('./analysis-pages');

const LandingPage = lazy(() =>
    loadPublicPages().then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
    loadPublicPages().then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
    loadPublicPages().then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
    loadPublicPages().then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
    loadPublicPages().then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
    loadPublicPages().then((m) => ({ default: m.VerifyEmailPage })),
);

const HistoryPage = lazy(() =>
    loadWorkspacePages().then((m) => ({ default: m.HistoryPage })),
);
const SettingsPage = lazy(() =>
    loadWorkspacePages().then((m) => ({ default: m.SettingsPage })),
);
const AdminDashboardPage = lazy(() =>
    loadWorkspacePages().then((m) => ({ default: m.AdminDashboardPage })),
);

const UploadPage = lazy(() =>
    loadAnalysisPages().then((m) => ({ default: m.UploadPage })),
);
const ResultsPage = lazy(() =>
    loadAnalysisPages().then((m) => ({ default: m.ResultsPage })),
);

type WindowWithIdleCallback = Window &
    typeof globalThis & {
        requestIdleCallback?: (
            callback: IdleRequestCallback,
            options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
    };

/* ──────────────────────────────────────────────────────────────
 * Error boundary — bilingual, recoverable, polished
 * ───────────────────────────────────────────────────────────── */

interface BoundaryState {
    error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): BoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        if (typeof console !== 'undefined') {
            console.error('App render failure', error, info);
        }
    }

    private handleRetry = () => {
        this.setState({ error: null });
    };

    private handleReload = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        const lang = (document?.documentElement?.lang as 'ar' | 'en') || 'en';
        const isAr = lang === 'ar';

        return (
            <div className="app-shell">
                <AnimatedBackground />
                <div className="relative z-10">
                    <div className="app-container section-shell">
                        <div className="panel rounded-[2rem] p-8 sm:p-12">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-300">
                                    {isAr ? 'خطأ في الواجهة' : 'App Error'}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">
                                    {isAr ? 'الحدث محصور هنا' : 'Contained safely'}
                                </span>
                            </div>

                            <h1 className="section-title mt-5">
                                {isAr
                                    ? 'تعذّر عرض الواجهة في هذه اللحظة'
                                    : 'The interface failed to render'}
                            </h1>

                            <p className="body-soft mt-4 max-w-3xl leading-8">
                                {isAr
                                    ? 'حدث خطأ غير متوقع أثناء عرض الصفحة. تستطيع المحاولة مرة أخرى بدون فقد حالة التطبيق، أو إعادة تحميل الصفحة بالكامل.'
                                    : 'An unexpected error occurred while rendering this page. You can retry without losing the app state, or fully reload.'}
                            </p>

                            <pre
                                dir="ltr"
                                className="panel-soft mt-5 max-h-48 overflow-auto rounded-2xl p-4 text-xs leading-6 text-[var(--text-muted)]"
                            >
                                {this.state.error.message}
                            </pre>

                            <div className="mt-6 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={this.handleRetry}
                                    className="button-primary inline-flex rounded-2xl px-5 py-3 text-sm font-bold"
                                >
                                    {isAr ? 'إعادة المحاولة' : 'Try again'}
                                </button>
                                <button
                                    type="button"
                                    onClick={this.handleReload}
                                    className="button-secondary inline-flex rounded-2xl px-5 py-3 text-sm font-bold"
                                >
                                    {isAr ? 'إعادة تحميل الصفحة' : 'Reload page'}
                                </button>
                                <a
                                    href="/"
                                    className="button-secondary inline-flex rounded-2xl px-5 py-3 text-sm font-bold"
                                >
                                    {isAr ? 'العودة للرئيسية' : 'Back home'}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

/* ──────────────────────────────────────────────────────────────
 * Helpers: scroll restoration, document title, layouts
 * ───────────────────────────────────────────────────────────── */

const ROUTE_TITLES: Record<string, { ar: string; en: string }> = {
    '/': { ar: 'الرئيسية', en: 'Home' },
    '/login': { ar: 'تسجيل الدخول', en: 'Sign in' },
    '/register': { ar: 'إنشاء حساب', en: 'Create account' },
    '/forgot-password': { ar: 'استعادة كلمة المرور', en: 'Forgot password' },
    '/reset-password': { ar: 'إعادة تعيين كلمة المرور', en: 'Reset password' },
    '/verify-email': { ar: 'تأكيد البريد الإلكتروني', en: 'Verify email' },
    '/upload': { ar: 'الرفع والتحليل', en: 'Upload & Analysis' },
    '/results': { ar: 'النتائج', en: 'Results' },
    '/history': { ar: 'السجل', en: 'History' },
    '/settings': { ar: 'الإعدادات', en: 'Settings' },
    '/admin/dashboard': { ar: 'لوحة الإدارة', en: 'Admin' },
};

function ScrollAndTitle({ appName = 'AI Sign Platform' }: { appName?: string }) {
    const location = useLocation();
    const { language } = useAppContext();

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [location.pathname]);

    useEffect(() => {
        const entry = ROUTE_TITLES[location.pathname];
        const title = entry ? entry[language] : null;
        document.title = title ? `${title} · ${appName}` : appName;
    }, [location.pathname, language, appName]);

    return null;
}

function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="app-shell">
            <AnimatedBackground />
            <div className="relative z-10">
                <Navbar />
                <main>{children}</main>
                <Footer />
            </div>
        </div>
    );
}

function AppLayout({ children }: { children: ReactNode }) {
    return (
        <div className="app-shell">
            <AnimatedBackground />
            <div className="relative z-10">
                <DashboardFrame>{children}</DashboardFrame>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
 * Auth gates
 * ───────────────────────────────────────────────────────────── */

function RequireAuth({
    children,
    adminOnly = false,
}: {
    children: ReactNode;
    adminOnly?: boolean;
}) {
    const { boot } = useAppContext();
    const location = useLocation();

    if (!boot.auth.isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (adminOnly && !boot.auth.isAdmin) {
        return <Navigate to="/upload" replace />;
    }

    return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
    const { boot } = useAppContext();

    if (!boot.auth.isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <Navigate
            to={boot.auth.isAdmin ? '/admin/dashboard' : '/upload'}
            replace
        />
    );
}

/* ──────────────────────────────────────────────────────────────
 * 404 + Suspense fallback
 * ───────────────────────────────────────────────────────────── */

function MissingPage() {
    const { language } = useAppContext();
    const isAr = language === 'ar';

    return (
        <PublicLayout>
            <div className="app-container section-shell">
                <div className="panel relative overflow-hidden rounded-[2rem] p-8 sm:p-14">
                    <div className="pointer-events-none absolute -end-10 -top-10 h-56 w-56 rounded-full bg-[var(--primary)]/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-16 -start-10 h-72 w-72 rounded-full bg-[var(--primary)]/10 blur-3xl" />

                    <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
                        <div>
                            <div className="eyebrow">404</div>
                            <h1 className="section-title mt-4">
                                {isAr
                                    ? 'الصفحة غير موجودة'
                                    : 'This page could not be found'}
                            </h1>
                            <p className="body-soft mt-4 max-w-2xl leading-8">
                                {isAr
                                    ? 'ربما تم نقل المسار أو لم يتم تفعيله بعد داخل هذه النسخة من المنصة. اقترح بعض الوجهات السريعة بالأسفل.'
                                    : 'The route may have moved or has not been activated yet in this version. Try one of the quick destinations below.'}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                <ButtonLink to="/">
                                    {isAr ? 'العودة للرئيسية' : 'Back home'}
                                </ButtonLink>
                                <ButtonLink to="/upload" variant="secondary">
                                    {isAr ? 'الرفع والتحليل' : 'Upload & Analysis'}
                                </ButtonLink>
                            </div>
                        </div>

                        <div
                            aria-hidden
                            className="text-center text-[10rem] font-black leading-none text-[var(--primary)]/15 sm:text-[14rem]"
                        >
                            404
                        </div>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}

function RouteFallback() {
    const { language } = useAppContext();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(true), 220);
        return () => window.clearTimeout(timer);
    }, []);

    if (!visible) {
        return null;
    }

    return (
        <div className="app-container section-shell">
            <LoadingPanel
                title={language === 'ar' ? 'جارٍ فتح الصفحة' : 'Opening page'}
                description={
                    language === 'ar'
                        ? 'يتم تجهيز الشاشة التالية الآن.'
                        : 'Preparing the next screen now.'
                }
            />
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
 * Declarative route table
 * ───────────────────────────────────────────────────────────── */

type RouteScope = 'public' | 'guest' | 'protected' | 'admin';

interface RouteDef {
    path: string;
    element: ReactNode;
    scope: RouteScope;
}

const routeTable: RouteDef[] = [
    { path: '/', scope: 'public', element: <LandingPage /> },

    { path: '/login', scope: 'guest', element: <LoginPage /> },
    { path: '/register', scope: 'guest', element: <RegisterPage /> },
    { path: '/forgot-password', scope: 'guest', element: <ForgotPasswordPage /> },
    { path: '/reset-password', scope: 'guest', element: <ResetPasswordPage /> },
    { path: '/verify-email', scope: 'guest', element: <VerifyEmailPage /> },

    { path: '/upload', scope: 'protected', element: <UploadPage /> },
    { path: '/results', scope: 'protected', element: <ResultsPage /> },
    { path: '/history', scope: 'protected', element: <HistoryPage /> },
    { path: '/settings', scope: 'protected', element: <SettingsPage /> },

    { path: '/admin/dashboard', scope: 'admin', element: <AdminDashboardPage /> },
];

function wrapElement(def: RouteDef): ReactNode {
    const suspended = <Suspense fallback={<RouteFallback />}>{def.element}</Suspense>;

    switch (def.scope) {
        case 'public':
            return <PublicLayout>{suspended}</PublicLayout>;
        case 'guest':
            return (
                <GuestOnly>
                    <PublicLayout>{suspended}</PublicLayout>
                </GuestOnly>
            );
        case 'protected':
            return (
                <RequireAuth>
                    <AppLayout>{suspended}</AppLayout>
                </RequireAuth>
            );
        case 'admin':
            return (
                <RequireAuth adminOnly>
                    <AppLayout>{suspended}</AppLayout>
                </RequireAuth>
            );
    }
}

function AppRoutes() {
    const location = useLocation();

    const renderedRoutes = useMemo(
        () =>
            routeTable.map((def) => (
                <Route key={def.path} path={def.path} element={wrapElement(def)} />
            )),
        [],
    );

    return (
        <>
            <ScrollAndTitle />
            <AnimatePresence mode="wait" initial={false}>
                <Routes location={location} key={location.pathname}>
                    {renderedRoutes}
                    <Route path="*" element={<MissingPage />} />
                </Routes>
            </AnimatePresence>
        </>
    );
}

/* ──────────────────────────────────────────────────────────────
 * App shell + smart preloading
 * ───────────────────────────────────────────────────────────── */

export function App() {
    return (
        <AppErrorBoundary>
            <BrowserRouter>
                <PreloadStrategy />
                <AppRoutes />
                <ToastBanner />
            </BrowserRouter>
        </AppErrorBoundary>
    );
}

function PreloadStrategy() {
    const { boot } = useAppContext();
    const isAuthed = boot.auth.isAuthenticated;
    const isAdmin = boot.auth.isAdmin;

    useEffect(() => {
        const idleWindow = window as WindowWithIdleCallback;

        const warm = () => {
            if (isAuthed) {
                void loadWorkspacePages();
                void loadAnalysisPages();
                if (isAdmin) {
                    void loadWorkspacePages();
                }
            } else {
                void loadPublicPages();
            }
        };

        if (typeof idleWindow.requestIdleCallback === 'function') {
            const handle = idleWindow.requestIdleCallback(warm, { timeout: 1200 });
            return () => idleWindow.cancelIdleCallback?.(handle);
        }

        const timer = window.setTimeout(warm, 300);
        return () => window.clearTimeout(timer);
    }, [isAuthed, isAdmin]);

    return null;
}