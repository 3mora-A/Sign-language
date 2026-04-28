import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Braces, Clapperboard, FileJson2, Frame, Layers, Sparkles, Trash2, UploadCloud, Video } from 'lucide-react';
import { ButtonLink, Badge, LoadingPanel, PageHeader, ProgressTimeline, SpotlightCard, AnalysisHeroCard } from './components';
import { useAppContext } from './context';
import { copyFor, cx, formatDate, formatNumber, formatPercent, toAppUrl } from './utils';
import type { AnalysisResult } from './types';

export function UploadPage() {
    const { language, boot, latestAnalysis, setLatestAnalysis, setToast } = useAppContext();
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [activeStep, setActiveStep] = useState(0);
    const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);

    const steps = useMemo(
        () => [
            {
                label: language === 'ar' ? 'استقبال العينة' : 'Sample received',
                description: language === 'ar' ? 'التحقق من نوع العينة وحجمها وإدخالها في مسار التحليل.' : 'Validating sample type and size, then queuing it for the inference pipeline.',
            },
            {
                label: language === 'ar' ? 'استخراج الإطارات' : 'Frames extracted',
                description: language === 'ar' ? 'تقسيم العينة إلى إطارات وتجهيزها لمراحل المعالجة اللاحقة.' : 'Decomposing the sample into frames and preparing them for downstream processing.',
            },
            {
                label: language === 'ar' ? 'اكتشاف المعالم' : 'Landmarks detected',
                description: language === 'ar' ? 'استخراج معالم اليد والوجه والجسم كمدخلات للشبكة العصبية.' : 'Extracting hand, face, and body landmarks as inputs to the neural network.',
            },
            {
                label: language === 'ar' ? 'تصنيف الإشارة' : 'Sign classified',
                description: language === 'ar' ? 'تشغيل النموذج العميق لتحديد الإشارة الأقرب من بين الفئات.' : 'Running the deep model to determine the most likely sign class.',
            },
            {
                label: language === 'ar' ? 'تصنيف المشاعر' : 'Emotion classified',
                description: language === 'ar' ? 'تصنيف الحالة الشعورية المصاحبة للمشهد.' : 'Classifying the emotional state associated with the scene.',
            },
            {
                label: language === 'ar' ? 'إخراج التقرير' : 'Report generated',
                description: language === 'ar' ? 'تجميع الملخص ودرجة الثقة والتنبؤات البديلة في تقرير المخرجات.' : 'Composing the summary, confidence score, and alternative predictions into the output report.',
            },
        ],
        [language],
    );

    useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return;
        }

        const nextUrl = URL.createObjectURL(file);
        setPreviewUrl(nextUrl);
        return () => URL.revokeObjectURL(nextUrl);
    }, [file]);

    useEffect(() => {
        if (!busy) {
            return undefined;
        }

        const interval = window.setInterval(() => {
            setActiveStep((current) => Math.min(current + 1, steps.length - 1));
            setProgress((current) => Math.min(current + 13, 92));
        }, 820);

        return () => window.clearInterval(interval);
    }, [busy, steps.length]);

    async function submitAnalysis() {
        if (!file) {
            return;
        }

        setBusy(true);
        setError(null);
        setProgress(8);
        setActiveStep(0);

        const formData = new FormData();
        formData.append('media', file);

        try {
            const response = await fetch(toAppUrl(boot.routes.upload), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': boot.csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: formData,
            });

            const payload = (await response.json().catch(() => null)) as { message?: string; analysis?: Parameters<typeof setLatestAnalysis>[0] } | null;

            if (!response.ok || !payload?.analysis) {
                throw new Error(payload?.message ?? (language === 'ar' ? 'فشل تشغيل التحليل.' : 'Inference run failed.'));
            }

            setProgress(100);
            setActiveStep(steps.length);
            setLatestAnalysis(payload.analysis);
            setCurrentAnalysis(payload.analysis);
            setToast({ tone: 'success', message: payload.message ?? (language === 'ar' ? 'اكتمل التحليل بنجاح.' : 'Inference completed successfully.') });
        } catch (submissionError) {
            setError(submissionError instanceof Error ? submissionError.message : language === 'ar' ? 'حدث خطأ غير متوقع.' : 'Unexpected error.');
            setToast({ tone: 'error', message: submissionError instanceof Error ? submissionError.message : language === 'ar' ? 'تعذّر إكمال التحليل.' : 'Could not complete the inference.' });
        } finally {
            setBusy(false);
        }
    }

    function clearSample() {
        setFile(null);
        setError(null);
        setCurrentAnalysis(null);
        setProgress(0);
        setActiveStep(0);
    }

    return (
        <div className="space-y-5">
            <PageHeader
                className="!mb-4 !gap-3 border-b border-white/[0.06] !pb-4 xl:flex-row xl:items-start xl:justify-between"
                eyebrow={language === 'ar' ? 'وحدة التحليل' : 'Inference Module'}
                title={language === 'ar' ? 'رفع العينات وتشغيل التحليل وعرض التقرير في مكان واحد' : 'Upload samples, run inference, and view the report in one place'}
                description={language === 'ar' ? 'ارفع عينة فيديو أو صورة لتشغيل مسار التعلم العميق المسؤول عن استخراج المعالم وتصنيف الإشارة والمشاعر، ثم استعرض التقرير فور اكتمال التحليل.' : 'Upload a video or image sample to run the deep learning pipeline for landmark extraction and sign and emotion classification, then review the report as soon as inference completes.'}
            />

            <section className="grid min-h-0 gap-4 xl:grid-cols-2 xl:items-stretch xl:gap-5">
                <SpotlightCard className="relative flex h-full min-h-0 flex-col overflow-hidden !p-0 shadow-[0_18px_56px_-20px_rgba(0,0,0,0.45)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgb(var(--primary-rgb)/0.14),transparent_55%)]" />
                    <InferenceStepHeader
                        icon={<Sparkles className="h-5 w-5 text-[var(--primary)]" />}
                        eyebrow={language === 'ar' ? 'إدخال العينة' : 'Sample ingest'}
                        title={language === 'ar' ? 'منطقة الرفع والسحب' : 'Drag & drop zone'}
                        stepBadge={language === 'ar' ? 'الخطوة ١' : 'Step 1'}
                        stepTone="info"
                    />

                    <div className="relative flex flex-1 flex-col gap-4 px-5 pb-5 pt-4 sm:px-6">
                        <div
                            className={cx(
                                'group relative flex min-h-[220px] flex-1 overflow-hidden rounded-[1.35rem] border-2 border-dashed transition-all duration-200 items-center justify-center',
                                dragActive ? 'scale-[1.008] border-[rgb(var(--primary-rgb)/0.55)] bg-[rgb(var(--primary-rgb)/0.09)] shadow-[0_0_0_6px_rgb(var(--primary-rgb)/0.05)]' : 'border-white/14 bg-black/22 hover:border-[rgb(var(--primary-rgb)/0.26)] hover:bg-black/[0.26]',
                            )}
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDragActive(true);
                            }}
                            onDragLeave={(event) => {
                                event.preventDefault();
                                setDragActive(false);
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                setDragActive(false);
                                setFile(event.dataTransfer.files[0] ?? null);
                            }}
                        >
                            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:24px_24px] opacity-[0.28]" />
                            <div className="relative flex min-h-[200px] flex-col items-center justify-center px-4 py-8 text-center">
                                <div
                                    className={cx(
                                        'mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgb(var(--primary-rgb)/0.2)] bg-gradient-to-br from-[rgb(var(--primary-rgb)/0.18)] to-white/[0.03]',
                                        dragActive && 'scale-105',
                                    )}
                                >
                                    <UploadCloud className={`h-8 w-8 ${dragActive ? 'text-[var(--primary-strong)]' : 'text-[var(--primary)]'}`} />
                                </div>
                                <h3 className="text-balance text-lg font-bold sm:text-xl">{language === 'ar' ? 'اسحب العينة هنا أو اخترها يدويًا' : 'Drop your sample here or choose manually'}</h3>
                                <p className="body-soft mt-2 max-w-md text-sm leading-relaxed">
                                    {language === 'ar' ? 'يدعم الفيديو والصور. بعد الرفع ستظهر المعاينة في العمود المجاور.' : 'Supports video and images. Preview opens in the column beside.'}
                                </p>
                                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                                    {(['MP4', 'MOV', 'JPG', 'PNG'] as const).map((fmt) => (
                                        <span key={fmt} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-soft)]">{fmt}</span>
                                    ))}
                                </div>
                                <label className="button-primary mt-6 inline-flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
                                    <Video className="h-4 w-4 shrink-0" />
                                    {language === 'ar' ? 'اختر من الجهاز' : 'Browse device'}
                                    <input type="file" className="hidden" accept="image/*,video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                                </label>
                            </div>
                        </div>


                        {file ? (
                            <div className="rounded-[1.35rem] border border-[rgb(var(--primary-rgb)/0.18)] bg-black/35 p-4 shadow-inner backdrop-blur-sm">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold">{file.name}</p>
                                        <p className="body-soft text-xs">{`${(file.size / 1024 / 1024).toFixed(2)} MB`}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge
                                            tone="info"
                                            text={
                                                file.type.startsWith('image')
                                                    ? language === 'ar'
                                                        ? 'صورة'
                                                        : 'Image'
                                                    : language === 'ar'
                                                      ? 'فيديو'
                                                      : 'Video'
                                            }
                                        />
                                        <button
                                            type="button"
                                            aria-label={language === 'ar' ? 'إزالة العينة' : 'Remove sample'}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] transition hover:border-rose-500/35 hover:bg-rose-500/10"
                                            onClick={clearSample}
                                            disabled={busy}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="button-primary mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold disabled:opacity-60"
                                    onClick={submitAnalysis}
                                    disabled={busy}
                                >
                                    {busy ? (
                                        <>
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                                            {language === 'ar' ? 'جارٍ التشغيل...' : 'Running...'}
                                        </>
                                    ) : language === 'ar' ? (
                                        'بدء التحليل'
                                    ) : (
                                        'Run inference'
                                    )}
                                </button>
                                {error ? <div className="mt-3 rounded-xl border border-rose-400/22 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
                            </div>
                        ) : null}
                    </div>
                </SpotlightCard>

                <div className="flex min-h-0 flex-col gap-4 xl:h-full">
                    <SpotlightCard className="relative flex h-full min-h-0 flex-1 flex-col !p-0 overflow-hidden shadow-[0_18px_56px_-20px_rgba(0,0,0,0.45)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_-10%,rgb(var(--primary-rgb)/0.12),transparent_52%)]" />
                        <InferenceStepHeader
                            icon={<Video className="h-5 w-5 text-[var(--primary)]" />}
                            eyebrow={language === 'ar' ? 'معاينة' : 'Preview'}
                            title={language === 'ar' ? 'مساحة العرض' : 'Display viewport'}
                            stepBadge={language === 'ar' ? 'الخطوة ٢' : 'Step 2'}
                            stepTone={previewUrl ? 'success' : 'info'}
                        />

                        {previewUrl && file ? (
                            <MediaPreviewViewport previewUrl={previewUrl} file={file} />
                        ) : (
                            <EmptyPreviewPlaceholder language={language} />
                        )}
                    </SpotlightCard>

                    {busy ? (
                        <div className="space-y-3">
                            <LoadingPanel
                                title={language === 'ar' ? 'مسار التحليل يعمل' : 'Inference running'}
                                description={language === 'ar' ? 'مراحل التحليل تتقدّم حتى تقرير المخرجات.' : 'Pipeline stages advance until output is ready.'}
                            />
                            <SpotlightCard className="!p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-lg font-bold">{language === 'ar' ? 'المراحل' : 'Stages'}</h3>
                                    <Badge tone="warning" text={`${progress}%`} />
                                </div>
                                <div className="mt-4">
                                    <ProgressTimeline steps={steps} activeIndex={activeStep} />
                                </div>
                            </SpotlightCard>
                        </div>
                    ) : null}
                </div>
            </section>

            <ResultsSection analysis={currentAnalysis} showHeader={true} showDetails={false} />
        </div>
    );
}

function InferenceStepHeader({
    icon,
    eyebrow,
    title,
    stepBadge,
    stepTone,
}: {
    icon: ReactNode;
    eyebrow: string;
    title: string;
    stepBadge: string;
    stepTone: 'info' | 'success';
}) {
    return (
        <div className="relative z-[1] shrink-0 border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgb(var(--primary-rgb)/0.2)] bg-[rgb(var(--primary-rgb)/0.06)]">{icon}</span>
                    <div className="min-w-0">
                        <p className="truncate text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{eyebrow}</p>
                        <p className="mt-1 truncate text-base font-bold sm:text-[1.05rem]">{title}</p>
                    </div>
                </div>
                <Badge tone={stepTone === 'success' ? 'success' : 'info'} text={stepBadge} />
            </div>
        </div>
    );
}

function MediaPreviewViewport({ previewUrl, file }: { previewUrl: string; file: File }) {
    const [aspect, setAspect] = useState<'unknown' | 'portrait' | 'landscape'>('unknown');
    const isImage = file.type.startsWith('image');

    useEffect(() => {
        setAspect('unknown');
    }, [previewUrl]);

    return (
        <div className="relative min-h-[13rem] flex-1 xl:min-h-0">
            <div className="absolute inset-0 overflow-hidden rounded-b-[1.55rem] border-t border-[rgb(var(--primary-rgb)/0.12)] bg-[#0a0a0a]">
                {/* خلفية ناعمة وشبكة خفيفة */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgb(var(--primary-rgb)/0.06),transparent_60%)]" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[length:32px_32px]" />

                <div className="relative z-[1] flex h-full w-full items-center justify-center">
                    {/* حاوية تلتف حول حجم المحتوى الفعلي (Shrink-wrap) */}
                    <div className="relative flex h-full w-full items-center justify-center transition-all duration-500">
                        
                        {/* إطار الوسائط */}
                        <div className="relative z-10 flex h-full w-full items-center justify-center bg-black">
                            {isImage ? (
                                <img
                                    src={previewUrl}
                                    alt={file.name}
                                    loading="lazy"
                                    draggable={false}
                                    onLoad={(event) => {
                                        const el = event.currentTarget;
                                        if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                                            setAspect(el.naturalHeight > el.naturalWidth ? 'portrait' : 'landscape');
                                        }
                                    }}
                                    className="block h-full w-full object-contain"
                                />
                            ) : (
                                <video
                                    src={previewUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    onLoadedMetadata={(event) => {
                                        const v = event.currentTarget;
                                        if (v.videoWidth > 0 && v.videoHeight > 0) {
                                            setAspect(v.videoHeight > v.videoWidth ? 'portrait' : 'landscape');
                                        }
                                    }}
                                    className="block h-full w-full bg-black object-contain outline-none"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyPreviewPlaceholder({ language }: { language: 'ar' | 'en' }) {
    return (
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 sm:px-6">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.55rem] border border-dashed border-white/15 bg-black/15 shadow-inner">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:22px_22px]" />
                <div className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_50%_-10%,rgb(var(--primary-rgb)/0.09),transparent_62%)]" />
                <span className="pointer-events-none absolute left-5 top-5 h-8 w-8 border-l-2 border-t-2 border-[rgb(var(--primary-rgb)/0.35)]" />
                <span className="pointer-events-none absolute right-5 top-5 h-8 w-8 border-r-2 border-t-2 border-[rgb(var(--primary-rgb)/0.35)]" />
                <span className="pointer-events-none absolute bottom-5 left-5 h-8 w-8 border-b-2 border-l-2 border-[rgb(var(--primary-rgb)/0.35)]" />
                <span className="pointer-events-none absolute bottom-5 right-5 h-8 w-8 border-b-2 border-r-2 border-[rgb(var(--primary-rgb)/0.35)]" />

                <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[rgb(var(--primary-rgb)/0.22)] bg-gradient-to-br from-[rgb(var(--primary-rgb)/0.14)] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-4 ring-black/20">
                        <UploadCloud className="h-7 w-7 text-[rgb(var(--primary-rgb)/0.9)]" strokeWidth={2} />
                    </span>
                    <div className="mt-5">
                        <Badge tone="info" text={language === 'ar' ? 'الخطوة ٢' : 'Step 2'} />
                    </div>
                    <h3 className="mt-4 max-w-md text-lg font-extrabold leading-snug tracking-tight sm:text-xl">
                        {language === 'ar' ? 'في انتظار العينة' : 'Waiting for a sample'}
                    </h3>
                    <p className="body-soft mt-2 max-w-md text-sm leading-relaxed">
                        {language === 'ar'
                            ? 'بعد اختيار ملف ستظهر المعاينة هنا.'
                            : 'Once you pick a file, a preview appears here.'}
                    </p>
                    <p className="body-soft mt-6 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">
                        {language === 'ar'
                            ? 'استخدم عمود الخطوة ١: السحب أو «اختر من الجهاز».'
                            : 'Use Step 1: drag & drop or «Browse device».'}
                    </p>
                </div>
            </div>
        </div>
    );
}

export function ResultsSection({ analysis, showHeader = false, showHero = true, showDetails = true }: { analysis?: AnalysisResult | null, showHeader?: boolean, showHero?: boolean, showDetails?: boolean }) {
    const { language } = useAppContext();

    if (!analysis) {
        return null;
    }

    return (
        <div className={cx("mt-6", showHeader ? "border-t border-white/[0.06] pt-6" : "")}>
            {showHeader && (
                <div className="mb-5 flex flex-wrap items-center gap-3">
                    <Badge tone="success" text={language === 'ar' ? 'تقرير التحليل' : 'Inference report'} />
                    <h2 className="text-2xl font-extrabold sm:text-[1.75rem]">
                        {language === 'ar' ? 'مخرجات التحليل' : 'Inference output'}
                    </h2>
                </div>
            )}

            <div className="space-y-6">
                {showHero && <AnalysisHeroCard analysis={analysis} />}

                {showDetails && (
                    <div className="grid min-h-0 gap-6 xl:items-stretch">
                    <SpotlightCard className="relative flex min-h-[22rem] flex-col !p-0 overflow-hidden shadow-[0_18px_56px_-20px_rgba(0,0,0,0.45)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_-10%,rgb(var(--primary-rgb)/0.12),transparent_52%)]" />
                        <div className="relative z-[1] shrink-0 border-b border-white/[0.06] px-5 py-4 sm:px-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{language === 'ar' ? 'معاينة' : 'Preview'}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <h3 className="truncate text-base font-bold sm:text-[1.05rem]">{language === 'ar' ? 'العينة المعالجة' : 'Processed sample'}</h3>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 text-right">
                                    <p className="body-soft hidden text-xs sm:block">{analysis.fileName}</p>
                                    <Badge tone="info" text={analysis.mediaType === 'image' ? (language === 'ar' ? 'صورة' : 'Image') : (language === 'ar' ? 'فيديو' : 'Video')} />
                                </div>
                            </div>
                        </div>

                        {analysis.previewUrl ? (
                            <MediaPreviewViewport
                                previewUrl={analysis.previewUrl}
                                file={new File([], analysis.fileName, { type: analysis.mediaType === 'image' ? 'image/jpeg' : 'video/mp4' })}
                            />
                        ) : (
                            <EmptyPreviewPlaceholder language={language} />
                        )}
                    </SpotlightCard>
                </div>
                )}
            </div>
        </div>
    );
}

export function ResultsPage() {
    return <UploadPage />;
}
