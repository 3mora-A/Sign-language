import { motion } from 'framer-motion';
import { Eye, EyeOff, MoveRight, ShieldEllipsis, Sparkles, Star, WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AppIcon,
    Badge,
    ButtonLink,
    ConfidenceBar,
    InputField,
    PageHeader,
    SectionHeading,
    SelectField,
    SpotlightCard,
    StatCard,
    motionVariants,
} from './components';
import { useAppContext } from './context';
import { landingHighlights, testimonials, whyItMatters, workflowSteps } from './data';
import type { Language, LocalizedText } from './types';
import { copyFor, toAppPath, toAppUrl } from './utils';

async function submitForm(
    url: string,
    token: string,
    fields: Record<string, string>,
): Promise<{ message?: string; redirect?: string }> {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value));

    const response = await fetch(toAppUrl(url), {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': token,
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: formData,
    });

    const payload = (await response.json().catch(() => null)) as { message?: string; redirect?: string } | null;

    if (!response.ok) {
        throw new Error(payload?.message ?? 'Something went wrong.');
    }

    return payload ?? {};
}

function AuthShell({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    const { language, boot } = useAppContext();

    return (
        <div className="app-container section-shell">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <motion.div variants={motionVariants.pageTransition} initial="initial" animate="animate" className="panel relative overflow-hidden rounded-[2rem] p-7 md:p-10">
                    <div className="hero-mesh" />
                    <div className="relative z-10">
                        <div className="eyebrow">{language === 'ar' ? 'الوصول إلى النظام' : 'Access the system'}</div>
                        <h1 className="section-title mt-6 max-w-2xl">{title}</h1>
                        <p className="body-soft mt-5 max-w-2xl text-lg leading-8">{subtitle}</p>

                        <div className="mt-10 data-grid">
                            {landingHighlights.map((item) => (
                                <SpotlightCard key={copyFor(language, item.title)} className="min-h-[190px]">
                                    <div className="mb-4 inline-flex rounded-2xl border border-[rgb(var(--primary-rgb)/0.12)] bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent p-3 shadow-inner ring-1 ring-white/[0.04]">
                                        <AppIcon name={item.icon} className="h-5 w-5 text-[var(--primary)]" />
                                    </div>
                                    <h3 className="text-xl font-bold">{copyFor(language, item.title)}</h3>
                                    <p className="body-soft mt-3 leading-7">{copyFor(language, item.description)}</p>
                                </SpotlightCard>
                            ))}
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={motionVariants.pageTransition} initial="initial" animate="animate" className="panel-strong rounded-[2rem] p-7 md:p-8">
                    {children}
                    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/8 pt-6">
                        <Badge tone="info" text={language === 'ar' ? 'ثنائي اللغة' : 'Bilingual'} />
                        <Badge tone="success" text="Laravel Backend" />
                        <Badge tone="warning" text="Python Inference" />
                    </div>
                    <p className="body-muted mt-4 text-sm">
                        {boot.auth.isAuthenticated
                            ? language === 'ar'
                                ? 'لديك جلسة نشطة بالفعل. يمكنك المتابعة إلى لوحة التحكم في أي وقت.'
                                : 'You already have an active session and can continue to the dashboard at any time.'
                            : language === 'ar'
                              ? 'سجّل الدخول للوصول إلى محرّك التحليل وإدارة جلساتك.'
                              : 'Sign in to access the inference engine and manage your analysis sessions.'}
                    </p>
                </motion.div>
            </div>
        </div>
    );
}

export function LandingPage() {
    const { language, boot } = useAppContext();

    return (
        <div className="space-y-0">
            <section className="section-shell">
                <div className="app-container grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
                    <motion.div variants={motionVariants.pageTransition} initial="initial" animate="animate">
                        <div className="eyebrow">
                            <Sparkles className="h-4 w-4" />
                            {language === 'ar' ? 'مشروع تخرّج · تعلم عميق' : 'Graduation Project · Deep Learning'}
                        </div>
                        <h1 className="section-title mt-6 max-w-4xl">
                            {language === 'ar'
                                ? 'نظام تعلم عميق متكامل لتصنيف لغة الإشارة والمشاعر'
                                : 'End-to-End Deep Learning System for Sign Language and Emotion Classification'}
                        </h1>
                        <p className="body-soft mt-6 max-w-3xl text-lg leading-8">
                            {language === 'ar'
                                ? 'نظام بحثي يستقبل الفيديو أو الصورة، ويستخرج الإطارات والمعالم، ثم يشغّل شبكات عصبية عميقة للتعرف على الإشارة وتصنيف المشاعر، ويُخرج تقريرًا واضحًا بالنتيجة ودرجة الثقة والبدائل.'
                                : 'A research-grade system that ingests video or image input, extracts frames and landmarks, runs deep neural networks for sign recognition and emotion classification, and produces a clear report with predictions, confidence, and alternatives.'}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <ButtonLink to={boot.auth.isAuthenticated ? '/upload' : '/register'}>
                                {boot.auth.isAuthenticated ? (language === 'ar' ? 'افتح لوحة التحكم' : 'Open dashboard') : language === 'ar' ? 'ابدأ الآن' : 'Get started'}
                                <MoveRight className="h-4 w-4" />
                            </ButtonLink>
                            <ButtonLink to="/upload" variant="secondary">
                                {language === 'ar' ? 'استكشف مسار التحليل' : 'Explore inference flow'}
                            </ButtonLink>
                        </div>
                    </motion.div>

                    <motion.div variants={motionVariants.pageTransition} initial="initial" animate="animate">
                        <SpotlightCard noHover className="relative flex flex-col justify-center overflow-hidden !p-0 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.45)] min-h-[22rem]">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_-10%,rgb(var(--primary-rgb)/0.12),transparent_52%)]" />
                            <div className="relative z-[1] p-6 sm:p-8 xl:p-10">
                                <div className="eyebrow">{language === 'ar' ? 'مكوّنات النظام' : 'System overview'}</div>
                                <h3 className="mt-5 text-3xl font-extrabold sm:text-4xl">
                                    {language === 'ar' ? 'مسار تحليل متكامل من الإدخال حتى التقرير النهائي' : 'A complete inference pipeline from input to final report'}
                                </h3>
                                <div className="mt-8 grid gap-4">
                                {workflowSteps.slice(0, 3).map((step) => (
                                    <div key={copyFor(language, step.title)} className="group flex items-start gap-4 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 transition hover:border-[rgb(var(--primary-rgb)/0.2)] hover:bg-white/[0.04]">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--primary)] transition group-hover:scale-105 group-hover:bg-[rgb(var(--primary-rgb)/0.1)]">
                                            <AppIcon name={step.icon} className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{copyFor(language, step.title)}</p>
                                            <p className="body-soft mt-1 text-sm">{copyFor(language, step.description)}</p>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </div>
                        </SpotlightCard>
                    </motion.div>
                </div>
            </section>

            <section className="section-shell">
                <div className="app-container">
                    <SectionHeading
                        eyebrow={language === 'ar' ? 'مكوّنات النظام' : 'System Components'}
                        title={language === 'ar' ? 'بنية موحّدة للتعلم العميق' : 'A unified architecture for deep learning'}
                        description={language === 'ar' ? 'تم بناء النظام كحلقات مترابطة: استقبال البيانات، استخراج المعالم، التحليل العميق، ثم عرض النتائج، مع فصل واضح بين Laravel كخدمة تطبيق وPython كخدمة تحليل.' : 'The system is built as connected stages: data ingestion, landmark extraction, deep inference, then result presentation, with a clear separation between Laravel (application service) and Python (inference service).'}
                        align="center"
                    />
                    <div className="mt-12 data-grid">
                        {landingHighlights.map((item) => (
                            <SpotlightCard key={copyFor(language, item.title)} className="min-h-[220px]">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="inline-flex rounded-2xl border border-[rgb(var(--primary-rgb)/0.12)] bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent p-3 shadow-inner ring-1 ring-white/[0.04]">
                                        <AppIcon name={item.icon} className="h-5 w-5 text-[var(--primary)]" />
                                    </div>
                                    <Badge tone={item.tone} text={item.tone.toUpperCase()} />
                                </div>
                                <h3 className="mt-6 text-2xl font-bold">{copyFor(language, item.title)}</h3>
                                <p className="body-soft mt-4 leading-8">{copyFor(language, item.description)}</p>
                            </SpotlightCard>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section-shell">
                <div className="app-container">
                    <SectionHeading
                        eyebrow={language === 'ar' ? 'كيف يعمل النظام' : 'How It Works'}
                        title={language === 'ar' ? 'مسار تحليل متكامل من الإطارات إلى تقرير المخرجات' : 'An end-to-end inference pipeline from frames to the output report'}
                        description={language === 'ar' ? 'كل مرحلة في مسار المعالجة موثّقة ومرئية للمستخدم: من استقبال البيانات، إلى استخراج المعالم، فالشبكة العصبية، وحتى إخراج التقرير النهائي.' : 'Every stage of the pipeline is documented and visible to the user: from data ingestion to landmark extraction, the neural network, and the final output report.'}
                    />
                    <div className="mt-12 grid gap-4 lg:grid-cols-4">
                        {workflowSteps.map((step, index) => (
                            <SpotlightCard key={copyFor(language, step.title)} className="min-h-[250px]">
                                <div className="flex items-center justify-between">
                                    <div className="mb-6 inline-flex rounded-2xl border border-[rgb(var(--primary-rgb)/0.12)] bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent p-3 shadow-inner ring-1 ring-white/[0.04]">
                                        <AppIcon name={step.icon} className="h-5 w-5 text-[var(--primary)]" />
                                    </div>
                                    <span className="text-sm font-bold text-[rgb(var(--primary-rgb)/0.75)]">0{index + 1}</span>
                                </div>
                                <h3 className="text-xl font-bold">{copyFor(language, step.title)}</h3>
                                <p className="body-soft mt-3 leading-8">{copyFor(language, step.description)}</p>
                            </SpotlightCard>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section-shell">
                <div className="app-container">
                    <SectionHeading
                        eyebrow={language === 'ar' ? 'أهمية المشروع' : 'Why It Matters'}
                        title={language === 'ar' ? 'بحث تطبيقي يخدم الشمولية والوصول الرقمي للصمّ وضعاف السمع' : 'Applied research serving digital inclusion and accessibility for deaf and hard-of-hearing users'}
                        description={language === 'ar' ? 'الهدف هو نقل أبحاث التعلم العميق من المختبر إلى أداة عملية تساعد في فهم لغة الإشارة وتفسير المشاعر المصاحبة بطريقة قابلة للقياس.' : 'The goal is to bring deep learning research out of the lab and into a practical tool that helps interpret sign language and the emotions that accompany it in a measurable way.'}
                    />
                    <div className="mt-12 data-grid">
                        {whyItMatters.map((item) => (
                            <SpotlightCard key={copyFor(language, item.title)} className="min-h-[220px]">
                                <div className="mb-6 inline-flex rounded-2xl border border-[rgb(var(--primary-rgb)/0.12)] bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent p-3 shadow-inner ring-1 ring-white/[0.04]">
                                    <AppIcon name={item.icon} className="h-5 w-5 text-[var(--primary)]" />
                                </div>
                                <h3 className="text-xl font-bold">{copyFor(language, item.title)}</h3>
                                <p className="body-soft mt-3 leading-8">{copyFor(language, item.description)}</p>
                            </SpotlightCard>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section-shell">
                <div className="app-container">
                    <SectionHeading
                        eyebrow={language === 'ar' ? 'مرجعيات' : 'References'}
                        title={language === 'ar' ? 'مساحة لاحقة لإضافة أبحاث ومراجع علمية تدعم النظام' : 'A space to later add scientific research and references supporting the system'}
                        description={language === 'ar' ? 'يمكن لاحقًا استبدال هذا القسم باقتباسات من أبحاث في رؤية الحاسوب وتصنيف المشاعر التي بُني عليها التصميم.' : 'This section can later be replaced with citations from computer vision and emotion classification research underpinning the design.'}
                    />
                    <div className="mt-12 grid gap-4 lg:grid-cols-2">
                        {testimonials.map((item) => (
                            <SpotlightCard key={item.name} className="min-h-[220px]">
                                <Star className="h-5 w-5 text-amber-300" />
                                <p className="mt-6 text-lg font-semibold leading-9">“{copyFor(language, item.quote)}”</p>
                                <div className="mt-8">
                                    <p className="font-bold">{item.name}</p>
                                    <p className="body-soft mt-1 text-sm">{copyFor(language, item.role)}</p>
                                </div>
                            </SpotlightCard>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section-shell pt-0">
                <div className="app-container">
                    <motion.div variants={motionVariants.pageTransition} initial="initial" animate="animate" className="panel-strong relative overflow-hidden rounded-[2.4rem] p-8 md:p-10">
                        <div className="hero-mesh" />
                        <div className="relative z-10 max-w-3xl">
                            <div className="eyebrow">
                                <WandSparkles className="h-4 w-4" />
                                {language === 'ar' ? 'جاهز للاستخدام والتوسعة' : 'Ready to use and extend'}
                            </div>
                            <h2 className="section-title mt-6">{language === 'ar' ? 'ابدأ تجربة النظام عمليًا من رفع العينة وحتى تقرير التحليل' : 'Try the system end-to-end from sample upload to the inference report'}</h2>
                            <p className="body-soft mt-6 text-lg leading-8">
                                {language === 'ar'
                                    ? 'سجّل الدخول، توجّه إلى لوحة التحكم، ارفع عينة فيديو أو صورة، ثم استعرض النتائج والسجل التاريخي للتحليلات السابقة.'
                                    : 'Sign in, head to the dashboard, upload a video or image sample, then review the results and the historical log of previous analyses.'}
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <ButtonLink to={boot.auth.isAuthenticated ? '/upload' : '/login'}>
                                    {boot.auth.isAuthenticated ? (language === 'ar' ? 'افتح لوحة التحكم' : 'Open dashboard') : language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                                </ButtonLink>
                                <ButtonLink to="/upload" variant="secondary">
                                    {language === 'ar' ? 'بدء عملية التصنيف' : 'Try inference'}
                                </ButtonLink>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}

export function LoginPage() {
    const { language, boot, setToast } = useAppContext();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({ email: '', password: '', remember: true });

    const title = language === 'ar' ? 'الدخول إلى نظام تصنيف الإشارة والمشاعر' : 'Sign in to the Sign & Emotion Classification system';
    const subtitle =
        language === 'ar'
            ? 'سجّل دخولك للوصول إلى محرّك التحليل، السجل، والإعدادات الخاصة بحسابك.'
            : 'Sign in to access the inference engine, history, and your account settings.';

    return (
        <AuthShell title={title} subtitle={subtitle}>
            <PageHeader
                eyebrow="Login"
                title={language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                description={language === 'ar' ? 'استخدم حسابك الحالي، أو تابع إلى إنشاء حساب جديد إذا كانت هذه أول زيارة.' : 'Use your existing account, or continue to registration if this is your first visit.'}
            />
            <form
                className="space-y-4"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError(null);

                    try {
                        const payload = await submitForm(boot.routes.login, boot.csrfToken, {
                            email: form.email,
                            password: form.password,
                            remember: form.remember ? '1' : '0',
                        });
                        setToast({ tone: 'success', message: payload.message ?? (language === 'ar' ? 'تم تسجيل الدخول.' : 'Signed in successfully.') });
                        const target = toAppPath(payload.redirect) || '/upload';
                        // استخدم إعادة تحميل كاملة لضمان تحديث جلسة Laravel وبيانات boot بدون انتظار إعادة الإقلاع داخل SPA
                        window.location.assign(target);
                    } catch (submissionError) {
                        setError(submissionError instanceof Error ? submissionError.message : language === 'ar' ? 'فشل تسجيل الدخول.' : 'Unable to sign in.');
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <InputField label={language === 'ar' ? 'البريد الإلكتروني' : 'Email address'} icon="user" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" required />
                <label className="block space-y-3">
                    <span className="text-sm font-semibold text-[var(--text-soft)]">{language === 'ar' ? 'كلمة المرور' : 'Password'}</span>
                    <div className="relative">
                        <input
                            className="input-shell ltr:pr-11 rtl:pl-11"
                            type={passwordVisible ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={form.password}
                            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setPasswordVisible((value) => !value)}
                            className="absolute inset-y-0 top-0 my-auto rounded-full text-[var(--text-muted)] transition hover:text-white ltr:right-4 rtl:left-4"
                        >
                            {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </label>
                <div className="flex items-center justify-between gap-4">
                    <label className="inline-flex items-center gap-3 text-sm text-[var(--text-soft)]">
                        <input type="checkbox" checked={form.remember} onChange={(event) => setForm((current) => ({ ...current, remember: event.target.checked }))} className="h-4 w-4 rounded border-white/15 bg-transparent text-[var(--primary)] focus:ring-[rgb(var(--primary-rgb)/0.35)]" />
                        {language === 'ar' ? 'تذكرني' : 'Remember me'}
                    </label>
                    <Link to="/forgot-password" className="text-sm font-semibold text-[var(--primary)] transition hover:text-[var(--primary-strong)]">
                        {language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                    </Link>
                </div>
                {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
                <button disabled={busy} className="button-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold disabled:opacity-60">
                    {busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <ShieldEllipsis className="h-4 w-4" />}
                    {busy ? (language === 'ar' ? 'جارٍ التحقق...' : 'Authenticating...') : language === 'ar' ? 'دخول آمن' : 'Secure sign in'}
                </button>
            </form>
            <p className="body-soft mt-6 text-sm">
                {language === 'ar' ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
                <Link to="/register" className="font-bold text-[var(--primary)]">
                    {language === 'ar' ? 'أنشئ حسابًا جديدًا' : 'Create one'}
                </Link>
            </p>
        </AuthShell>
    );
}

export function RegisterPage() {
    const { language, boot, setToast } = useAppContext();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<{ name: string; email: string; password: string; confirmPassword: string; preferred_language: Language }>({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        preferred_language: language,
    });

    return (
        <AuthShell
            title={language === 'ar' ? 'أنشئ حسابك للوصول إلى نظام التعلم العميق' : 'Create your account to access the deep learning system'}
            subtitle={language === 'ar' ? 'بمجرد إنشاء الحساب، يمكنك رفع العينات وتشغيل مسار التحليل ومراجعة السجل.' : 'Once your account is created, you can upload samples, run the inference pipeline, and review your history.'}
        >
            <PageHeader
                eyebrow="Register"
                title={language === 'ar' ? 'إنشاء حساب جديد' : 'Create account'}
                description={language === 'ar' ? 'املأ المعلومات الأساسية وسنجهز لك مساحة العمل فورًا.' : 'Fill in the essentials and your workspace will be ready instantly.'}
            />
            <form
                className="space-y-4"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError(null);

                    try {
                        const payload = await submitForm(boot.routes.register, boot.csrfToken, {
                            name: form.name,
                            email: form.email,
                            password: form.password,
                            password_confirmation: form.confirmPassword,
                            preferred_language: form.preferred_language,
                        });
                        setToast({ tone: 'success', message: payload.message ?? (language === 'ar' ? 'تم إنشاء الحساب.' : 'Account created.') });
                        const target = toAppPath(payload.redirect) || '/upload';
                        window.location.assign(target);
                    } catch (submissionError) {
                        setError(submissionError instanceof Error ? submissionError.message : language === 'ar' ? 'تعذر إنشاء الحساب.' : 'Unable to create account.');
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <InputField label={language === 'ar' ? 'الاسم الكامل' : 'Full name'} icon="user" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                <InputField label={language === 'ar' ? 'البريد الإلكتروني' : 'Email address'} icon="user" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
                <div className="grid gap-4 md:grid-cols-2">
                    <InputField label={language === 'ar' ? 'كلمة المرور' : 'Password'} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
                    <InputField label={language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} required />
                </div>
                <SelectField label={language === 'ar' ? 'اللغة المفضلة' : 'Preferred language'} value={form.preferred_language} onChange={(event) => setForm((current) => ({ ...current, preferred_language: event.target.value as Language }))}>
                    <option value="ar">{language === 'ar' ? 'العربية' : 'Arabic'}</option>
                    <option value="en">{language === 'ar' ? 'الإنجليزية' : 'English'}</option>
                </SelectField>
                {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
                <button disabled={busy} className="button-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold disabled:opacity-60">
                    {busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Star className="h-4 w-4" />}
                    {busy ? (language === 'ar' ? 'جارٍ إنشاء الحساب...' : 'Creating account...') : language === 'ar' ? 'إنشاء الحساب' : 'Create account'}
                </button>
            </form>
            <p className="body-soft mt-6 text-sm">
                {language === 'ar' ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
                <Link to="/login" className="font-bold text-[var(--primary)]">
                    {language === 'ar' ? 'سجّل الدخول' : 'Sign in'}
                </Link>
            </p>
        </AuthShell>
    );
}

export function ForgotPasswordPage() {
    const { language, setToast } = useAppContext();
    const [email, setEmail] = useState('');

    return (
        <AuthShell
            title={language === 'ar' ? 'استعادة كلمة المرور' : 'Password recovery'}
            subtitle={language === 'ar' ? 'هذه الصفحة جاهزة للربط مع Laravel password broker لتفعيل الاسترجاع.' : 'This screen is ready to connect to Laravel password broker for real recovery.'}
        >
            <PageHeader
                eyebrow="Recovery"
                title={language === 'ar' ? 'استعادة كلمة المرور' : 'Password recovery'}
                description={language === 'ar' ? 'أدخل بريدك الإلكتروني وسنرسل لك خطوات إعادة التعيين عند تفعيل الربط النهائي.' : 'Enter your email and we will send the reset steps once backend wiring is enabled.'}
            />
            <form
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    setToast({
                        tone: 'info',
                        message:
                            language === 'ar'
                                ? 'الواجهة جاهزة. بقي فقط ربط password broker أو endpoint مخصص للإرسال.'
                                : 'The UI is ready. The remaining step is wiring a password broker or custom endpoint.',
                    });
                }}
            >
                <InputField label={language === 'ar' ? 'البريد الإلكتروني' : 'Email address'} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <button className="button-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
                    <MoveRight className="h-4 w-4" />
                    {language === 'ar' ? 'معاينة إرسال رابط الاستعادة' : 'Preview recovery send state'}
                </button>
            </form>
        </AuthShell>
    );
}

export function ResetPasswordPage() {
    const { language, setToast } = useAppContext();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    return (
        <AuthShell
            title={language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset your password'}
            subtitle={language === 'ar' ? 'نموذج واضح لتلقي التوكن وإتمام تحديث كلمة المرور بأمان.' : 'A clean form to receive the token and securely finalize the password update.'}
        >
            <PageHeader
                eyebrow="Reset"
                title={language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset password'}
                description={language === 'ar' ? 'أدخل كلمة المرور الجديدة وأكّدها لإكمال العملية.' : 'Enter your new password and confirm it to complete the process.'}
            />
            <form
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    setToast({
                        tone: password && confirmPassword && password === confirmPassword ? 'success' : 'error',
                        message:
                            password && confirmPassword && password === confirmPassword
                                ? language === 'ar'
                                    ? 'الشكل النهائي جاهز. بقي فقط endpoint التحديث والتوكن.'
                                    : 'The final state is ready. Only the update endpoint and token remain.'
                                : language === 'ar'
                                  ? 'كلمتا المرور غير متطابقتين.'
                                  : 'Passwords do not match.',
                    });
                }}
            >
                <InputField label={language === 'ar' ? 'كلمة المرور الجديدة' : 'New password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <InputField label={language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                <button className="button-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
                    <ShieldEllipsis className="h-4 w-4" />
                    {language === 'ar' ? 'معاينة حالة النجاح' : 'Preview success state'}
                </button>
            </form>
        </AuthShell>
    );
}

export function VerifyEmailPage() {
    const { language } = useAppContext();
    const featureCopy = useMemo<LocalizedText>(
        () => ({
            ar: 'تحقّق من بريدك الإلكتروني لتفعيل حسابك والوصول الكامل إلى نظام التحليل.',
            en: 'Verify your email to activate your account and gain full access to the inference system.',
        }),
        [],
    );

    return (
        <AuthShell
            title={language === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Verify your email'}
            subtitle={language === 'ar' ? 'خطوة أمان أساسية قبل الوصول إلى محرّك التعلم العميق.' : 'A core security step before accessing the deep learning engine.'}
        >
            <PageHeader
                eyebrow="Verify"
                title={language === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Verify your email'}
                description={copyFor(language, featureCopy)}
            />
            <SpotlightCard>
                <div className="w-fit rounded-2xl border border-white/10 bg-white/5 p-4">
                    <ShieldEllipsis className="h-6 w-6 text-[var(--primary)]" />
                </div>
                <h3 className="mt-5 text-2xl font-bold">{language === 'ar' ? 'الحالة الحالية' : 'Current state'}</h3>
                <p className="body-soft mt-4 leading-8">
                    {language === 'ar'
                        ? 'الواجهة تدعم رسائل التأكيد، إعادة الإرسال، وتوضيح الخطوة التالية للمستخدم.'
                        : 'The interface supports verification messages, resend states, and clear next-step guidance.'}
                </p>
                <div className="mt-6">
                    <ConfidenceBar label={language === 'ar' ? 'جاهزية الحساب' : 'Account readiness'} value={97.2} />
                </div>
            </SpotlightCard>
        </AuthShell>
    );
}
