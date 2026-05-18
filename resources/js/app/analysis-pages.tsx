import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Clapperboard, Sparkles, Trash2, UploadCloud, Video } from 'lucide-react';
import { Badge, LoadingPanel, PageHeader, ProgressTimeline, SpotlightCard, AnalysisHeroCard } from './components';
import { useAppContext } from './context';
import { copyFor, cx, toAppUrl } from './utils';
import type { AnalysisResult, Language } from './types';

type UploadResponsePayload = {
    message?: string;
    analysis?: AnalysisResult | null;
};

function fileSignature(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
}

function isImageFile(file: Pick<File, 'name' | 'type'>): boolean {
    return file.type.startsWith('image') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
}

function mediaLabel(language: Language, file: Pick<File, 'name' | 'type'>): string {
    return isImageFile(file) ? (language === 'ar' ? 'صورة' : 'Image') : (language === 'ar' ? 'فيديو' : 'Video');
}

function uniqueFiles(files: File[]): File[] {
    const known = new Set<string>();

    return files.filter((file) => {
        const signature = fileSignature(file);
        if (known.has(signature)) {
            return false;
        }

        known.add(signature);
        return true;
    });
}

function buildBatchMessage(language: Language, successCount: number, failedCount: number): string {
    const total = successCount + failedCount;

    if (total === 0) {
        return language === 'ar' ? 'لا توجد ملفات لتحليلها.' : 'There are no files to analyze.';
    }

    if (failedCount === 0) {
        return language === 'ar'
            ? `تم تحليل ${successCount} ${successCount === 1 ? 'ملف' : 'ملفات'} بنجاح.`
            : `Successfully analyzed ${successCount} ${successCount === 1 ? 'file' : 'files'}.`;
    }

    if (successCount === 0) {
        return language === 'ar'
            ? `تعذر تحليل ${failedCount} ${failedCount === 1 ? 'ملف' : 'ملفات'} من هذه الدفعة.`
            : `Could not analyze ${failedCount} ${failedCount === 1 ? 'file' : 'files'} from this batch.`;
    }

    return language === 'ar'
        ? `اكتمل تحليل ${successCount} ${successCount === 1 ? 'ملف' : 'ملفات'}، وتعذر تحليل ${failedCount} ${failedCount === 1 ? 'ملف' : 'ملفات'}.`
        : `Analyzed ${successCount} ${successCount === 1 ? 'file' : 'files'}, while ${failedCount} ${failedCount === 1 ? 'file was' : 'files were'} not completed.`;
}

function buildClientFailureAnalysis(file: File, language: Language, message?: string): AnalysisResult {
    const fallbackSummary =
        language === 'ar'
            ? message ?? 'تعذر إكمال تحليل هذا الملف. يرجى المحاولة مرة أخرى.'
            : message ?? 'This file could not be analyzed. Please try again.';

    return {
        id: `${fileSignature(file)}-failed`,
        status: 'failed',
        fileName: file.name,
        mediaType: isImageFile(file) ? 'image' : 'video',
        previewUrl: undefined,
        createdAt: new Date().toISOString(),
        framesAnalyzed: 0,
        latencyMs: 0,
        confidence: 0,
        gestureKey: 'unknown',
        gestureLabel: { ar: 'غير متوفر', en: 'Unavailable' },
        emotionKey: 'unknown',
        emotionLabel: { ar: 'غير متوفر', en: 'Unavailable' },
        summary: {
            ar: language === 'ar' ? fallbackSummary : 'تعذر إكمال تحليل هذا الملف. يرجى المحاولة مرة أخرى.',
            en: language === 'en' ? fallbackSummary : 'This file could not be analyzed. Please try again.',
        },
        alternatives: [],
    };
}

export function UploadPage() {
    const { language, boot, addHistoryItem, setLatestAnalysis, setToast } = useAppContext();
    const [files, setFiles] = useState<File[]>([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [activeStep, setActiveStep] = useState(0);
    const [currentAnalyses, setCurrentAnalyses] = useState<AnalysisResult[]>([]);
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | string | null>(null);
    const [currentFileName, setCurrentFileName] = useState<string | null>(null);

    const steps = useMemo(
        () => [
            {
                label: language === 'ar' ? 'استقبال العينة' : 'Sample received',
                description:
                    language === 'ar'
                        ? 'التحقق من نوع العينة وحجمها ثم إدخالها إلى مسار التحليل.'
                        : 'Validating the sample type and size, then passing it into the inference pipeline.',
            },
            {
                label: language === 'ar' ? 'استخراج الإطارات' : 'Frames extracted',
                description:
                    language === 'ar'
                        ? 'تقسيم العينة إلى إطارات وتجهيزها لمراحل المعالجة اللاحقة.'
                        : 'Splitting the sample into frames and preparing it for downstream processing.',
            },
            {
                label: language === 'ar' ? 'تجهيز الخصائص' : 'Features prepared',
                description:
                    language === 'ar'
                        ? 'تهيئة الخصائص المرئية المطلوبة لتغذية نموذج المشاعر.'
                        : 'Preparing the visual features required by the emotion model.',
            },
            {
                label: language === 'ar' ? 'تصنيف المشاعر' : 'Emotion classified',
                description:
                    language === 'ar'
                        ? 'تشغيل نموذج المشاعر لتحديد الحالة الشعورية الأقرب.'
                        : 'Running the emotion model to determine the most likely state.',
            },
            {
                label: language === 'ar' ? 'معايرة الثقة' : 'Confidence calibrated',
                description:
                    language === 'ar'
                        ? 'احتساب درجة الثقة النهائية اعتمادًا على نتيجة كل فيديو.'
                        : 'Calculating the final confidence score for each analyzed video.',
            },
            {
                label: language === 'ar' ? 'إخراج التقرير' : 'Report generated',
                description:
                    language === 'ar'
                        ? 'تجميع الملخص ودرجة الثقة والنتائج البديلة ضمن التقرير.'
                        : 'Composing the summary, confidence score, and alternative predictions into the final report.',
            },
        ],
        [language],
    );

    const selectedFile = files[selectedFileIndex] ?? null;
    const selectedAnalysis = useMemo(() => {
        const matched = currentAnalyses.find((analysis) => String(analysis.id) === String(selectedAnalysisId));
        return matched ?? currentAnalyses[0] ?? null;
    }, [currentAnalyses, selectedAnalysisId]);

    useEffect(() => {
        if (!files.length) {
            setSelectedFileIndex(0);
            return;
        }

        setSelectedFileIndex((current) => Math.min(current, files.length - 1));
    }, [files.length]);

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }

        const nextUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(nextUrl);
        return () => URL.revokeObjectURL(nextUrl);
    }, [selectedFile]);

    useEffect(() => {
        if (!busy) {
            return undefined;
        }

        const interval = window.setInterval(() => {
            setActiveStep((current) => {
                if (current >= steps.length - 1) {
                    return 0;
                }

                return current + 1;
            });
        }, 820);

        return () => window.clearInterval(interval);
    }, [busy, steps.length]);

    function resetBatchOutput() {
        setCurrentAnalyses([]);
        setSelectedAnalysisId(null);
        setCurrentFileName(null);
        setError(null);
        setProgress(0);
        setActiveStep(0);
    }

    function mergeQueuedFiles(incomingFiles: File[]) {
        if (!incomingFiles.length || busy) {
            return;
        }

        setFiles((current) => uniqueFiles([...current, ...incomingFiles]));
        resetBatchOutput();
    }

    function clearQueue() {
        if (busy) {
            return;
        }

        setFiles([]);
        setPreviewUrl(null);
        resetBatchOutput();
    }

    function removeQueuedFile(index: number) {
        if (busy) {
            return;
        }

        setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
        resetBatchOutput();
    }

    function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
        mergeQueuedFiles(Array.from(event.target.files ?? []));
        event.currentTarget.value = '';
    }

    function focusQueuedFile(fileName: string) {
        const nextIndex = files.findIndex((file) => file.name === fileName);
        if (nextIndex >= 0) {
            setSelectedFileIndex(nextIndex);
        }
    }

    function syncHistoryWithBatch(analyses: AnalysisResult[]) {
        if (!analyses.length) {
            return;
        }

        const latestCandidate =
            [...analyses].reverse().find((analysis) => analysis.status === 'processed')
            ?? analyses[analyses.length - 1];

        analyses.forEach((analysis) => {
            if (String(analysis.id) !== String(latestCandidate.id)) {
                addHistoryItem(analysis);
            }
        });

        setLatestAnalysis(latestCandidate);
        setSelectedAnalysisId(latestCandidate.id);
    }

    async function submitAnalysis() {
        if (!files.length || busy) {
            return;
        }

        setBusy(true);
        resetBatchOutput();
        setProgress(4);
        setActiveStep(0);

        const analyses: AnalysisResult[] = [];

        try {
            for (let index = 0; index < files.length; index += 1) {
                const queuedFile = files[index];
                setCurrentFileName(queuedFile.name);
                setSelectedFileIndex(index);
                setActiveStep(0);

                const formData = new FormData();
                formData.append('media', queuedFile);

                let nextAnalysis: AnalysisResult;

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

                    const payload = (await response.json().catch(() => null)) as UploadResponsePayload | null;
                    nextAnalysis = payload?.analysis ?? buildClientFailureAnalysis(queuedFile, language, payload?.message);

                    if (!response.ok && !payload?.analysis) {
                        nextAnalysis = buildClientFailureAnalysis(queuedFile, language, payload?.message);
                    }
                } catch (submissionError) {
                    nextAnalysis = buildClientFailureAnalysis(
                        queuedFile,
                        language,
                        submissionError instanceof Error ? submissionError.message : undefined,
                    );
                }

                analyses.push(nextAnalysis);
                setCurrentAnalyses([...analyses]);
                setSelectedAnalysisId((current) => current ?? nextAnalysis.id);
                setProgress(Math.max(8, Math.round(((index + 1) / files.length) * 100)));
            }

            setActiveStep(steps.length);
            syncHistoryWithBatch(analyses);

            const failedCount = analyses.filter((analysis) => analysis.status !== 'processed').length;
            const successCount = analyses.length - failedCount;
            const message = buildBatchMessage(language, successCount, failedCount);

            setError(successCount === 0 ? message : null);
            setToast({
                tone: failedCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error',
                message,
            });
        } finally {
            setBusy(false);
            setCurrentFileName(null);
        }
    }

    return (
        <div className="space-y-5">
            <PageHeader
                className="!mb-4 !gap-3 border-b border-white/[0.06] !pb-4 xl:flex-row xl:items-start xl:justify-between"
                eyebrow={language === 'ar' ? 'وحدة التحليل' : 'Inference Module'}
                title={language === 'ar' ? 'رفع عدة عينات وتشغيل التحليل وعرض التقارير في مكان واحد' : 'Upload multiple samples, run inference, and review every report in one place'}
                description={language === 'ar' ? 'يمكنك اختيار أكثر من فيديو أو صورة في دفعة واحدة. سيجري النظام التحليل لكل ملف على حدة ثم يجمع النتائج لك داخل الصفحة نفسها.' : 'You can choose multiple video or image samples in a single batch. The system analyzes each file individually, then gathers every result for review in the same page.'}
            />

            <section className="grid min-h-0 gap-4 xl:grid-cols-2 xl:items-stretch xl:gap-5">
                <SpotlightCard className="relative flex h-full min-h-0 flex-col overflow-hidden !p-0 shadow-[0_18px_56px_-20px_rgba(0,0,0,0.45)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgb(var(--primary-rgb)/0.14),transparent_55%)]" />
                    <InferenceStepHeader
                        icon={<Sparkles className="h-5 w-5 text-[var(--primary)]" />}
                        eyebrow={language === 'ar' ? 'إدخال العينات' : 'Batch ingest'}
                        title={language === 'ar' ? 'منطقة الرفع والسحب' : 'Drag, drop, and queue'}
                        stepBadge={language === 'ar' ? 'الخطوة ١' : 'Step 1'}
                        stepTone="info"
                    />

                    <div className="relative flex flex-1 flex-col gap-4 px-5 pb-5 pt-4 sm:px-6">
                        <div
                            className={cx(
                                'group relative flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-[1.35rem] border-2 border-dashed transition-all duration-200',
                                dragActive
                                    ? 'scale-[1.008] border-[rgb(var(--primary-rgb)/0.55)] bg-[rgb(var(--primary-rgb)/0.09)] shadow-[0_0_0_6px_rgb(var(--primary-rgb)/0.05)]'
                                    : 'border-white/14 bg-black/22 hover:border-[rgb(var(--primary-rgb)/0.26)] hover:bg-black/[0.26]',
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
                                mergeQueuedFiles(Array.from(event.dataTransfer.files));
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
                                <h3 className="text-balance text-lg font-bold sm:text-xl">{language === 'ar' ? 'اسحب ملفاتك هنا أو اخترها دفعة واحدة من الجهاز' : 'Drop your files here or choose them in one batch'}</h3>
                                <p className="body-soft mt-2 max-w-md text-sm leading-relaxed">
                                    {language === 'ar' ? 'يدعم الفيديو والصور، ويمكنك اختيار عدة ملفات معًا. ستظهر قائمة الدفعة أسفل هذه المنطقة فور إضافتها.' : 'Supports video and images, and lets you pick multiple files at once. The queued batch appears below as soon as files are added.'}
                                </p>
                                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                                    {(['MP4', 'MOV', 'AVI', 'JPG', 'PNG'] as const).map((fmt) => (
                                        <span key={fmt} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-soft)]">{fmt}</span>
                                    ))}
                                </div>
                                <label className="button-primary mt-6 inline-flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
                                    <Video className="h-4 w-4 shrink-0" />
                                    {language === 'ar' ? 'اختر من الجهاز' : 'Browse device'}
                                    <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileInputChange} />
                                </label>
                            </div>
                        </div>

                        {files.length ? (
                            <div className="rounded-[1.35rem] border border-[rgb(var(--primary-rgb)/0.18)] bg-black/35 p-4 shadow-inner backdrop-blur-sm">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold">
                                            {language === 'ar'
                                                ? `${files.length} ${files.length === 1 ? 'ملف جاهز للتحليل' : 'ملفات جاهزة للتحليل'}`
                                                : `${files.length} ${files.length === 1 ? 'file ready for analysis' : 'files ready for analysis'}`}
                                        </p>
                                        <p className="body-soft mt-1 text-xs">
                                            {language === 'ar'
                                                ? 'اختر أي ملف من القائمة لمعاينته أو احذفه من الدفعة قبل تشغيل التحليل.'
                                                : 'Select any queued file to preview it, or remove it before starting the batch.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold transition hover:border-rose-500/35 hover:bg-rose-500/10 disabled:opacity-50"
                                        onClick={clearQueue}
                                        disabled={busy}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        {language === 'ar' ? 'مسح الكل' : 'Clear all'}
                                    </button>
                                </div>

                                <div className="mt-4 space-y-2">
                                    {files.map((queuedFile, index) => {
                                        const active = index === selectedFileIndex;

                                        return (
                                            <div
                                                key={fileSignature(queuedFile)}
                                                className={cx(
                                                    'flex items-center gap-2 rounded-[1.2rem] border p-2.5 transition',
                                                    active
                                                        ? 'border-[rgb(var(--primary-rgb)/0.38)] bg-[rgb(var(--primary-rgb)/0.08)]'
                                                        : 'border-white/10 bg-white/[0.02]',
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                                    onClick={() => setSelectedFileIndex(index)}
                                                >
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--primary)]">
                                                        <Clapperboard className="h-4 w-4" />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold">{queuedFile.name}</p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                                                            <span>{mediaLabel(language, queuedFile)}</span>
                                                            <span>{`${(queuedFile.size / 1024 / 1024).toFixed(2)} MB`}</span>
                                                            {active ? <span>{language === 'ar' ? 'قيد المعاينة' : 'Previewing'}</span> : null}
                                                        </div>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={language === 'ar' ? 'إزالة الملف من الدفعة' : 'Remove file from batch'}
                                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] transition hover:border-rose-500/35 hover:bg-rose-500/10 disabled:opacity-50"
                                                    onClick={() => removeQueuedFile(index)}
                                                    disabled={busy}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    className="button-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold disabled:opacity-60"
                                    onClick={submitAnalysis}
                                    disabled={busy}
                                >
                                    {busy ? (
                                        <>
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                                            {language === 'ar' ? 'جارٍ تشغيل التحليل على الدفعة...' : 'Running analysis for the batch...'}
                                        </>
                                    ) : language === 'ar' ? (
                                        `بدء تحليل ${files.length} ${files.length === 1 ? 'ملف' : 'ملفات'}`
                                    ) : (
                                        `Run analysis for ${files.length} ${files.length === 1 ? 'file' : 'files'}`
                                    )}
                                </button>

                                {busy && currentFileName ? (
                                    <p className="body-soft mt-3 text-xs">
                                        {language === 'ar' ? `الملف الحالي: ${currentFileName}` : `Current file: ${currentFileName}`}
                                    </p>
                                ) : null}

                                {error ? <div className="mt-3 rounded-xl border border-rose-400/22 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
                            </div>
                        ) : null}
                    </div>
                </SpotlightCard>

                <div className="flex min-h-0 flex-col gap-4 xl:h-full">
                    <SpotlightCard className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden !p-0 shadow-[0_18px_56px_-20px_rgba(0,0,0,0.45)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_-10%,rgb(var(--primary-rgb)/0.12),transparent_52%)]" />
                        <InferenceStepHeader
                            icon={<Video className="h-5 w-5 text-[var(--primary)]" />}
                            eyebrow={language === 'ar' ? 'معاينة' : 'Preview'}
                            title={language === 'ar' ? 'مساحة العرض' : 'Display viewport'}
                            stepBadge={language === 'ar' ? 'الخطوة ٢' : 'Step 2'}
                            stepTone={previewUrl ? 'success' : 'info'}
                        />

                        {previewUrl && selectedFile ? (
                            <MediaPreviewViewport previewUrl={previewUrl} file={selectedFile} />
                        ) : (
                            <EmptyPreviewPlaceholder language={language} />
                        )}
                    </SpotlightCard>

                    {busy ? (
                        <div className="space-y-3">
                            <LoadingPanel
                                title={language === 'ar' ? 'مسار التحليل يعمل' : 'Inference running'}
                                description={currentFileName
                                    ? language === 'ar'
                                        ? `يجري الآن تحليل الملف "${currentFileName}" ضمن هذه الدفعة.`
                                        : `The file "${currentFileName}" is being analyzed within this batch.`
                                    : language === 'ar'
                                      ? 'مراحل التحليل تتقدم حتى اكتمال جميع الملفات.'
                                      : 'Pipeline stages advance until every file is complete.'}
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

            <BatchResultsSection
                analyses={currentAnalyses}
                selectedAnalysisId={selectedAnalysisId}
                onSelectAnalysis={(analysis) => {
                    setSelectedAnalysisId(analysis.id);
                    focusQueuedFile(analysis.fileName);
                }}
            />

            <ResultsSection analysis={selectedAnalysis} showHeader={false} />
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
    const isImage = file.type.startsWith('image');

    return (
        <div className="relative min-h-[13rem] flex-1 xl:min-h-0">
            <div className="absolute inset-0 overflow-hidden rounded-b-[1.55rem] border-t border-[rgb(var(--primary-rgb)/0.12)] bg-[#0a0a0a]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgb(var(--primary-rgb)/0.06),transparent_60%)]" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[length:32px_32px]" />

                <div className="relative z-[1] flex h-full w-full items-center justify-center">
                    <div className="relative flex h-full w-full items-center justify-center transition-all duration-500">
                        <div className="relative z-10 flex h-full w-full items-center justify-center bg-black">
                            {isImage ? (
                                <img
                                    src={previewUrl}
                                    alt={file.name}
                                    loading="lazy"
                                    draggable={false}
                                    className="block h-full w-full object-contain"
                                />
                            ) : (
                                <video
                                    src={previewUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
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
                        {language === 'ar' ? 'في انتظار الملفات' : 'Waiting for files'}
                    </h3>
                    <p className="body-soft mt-2 max-w-md text-sm leading-relaxed">
                        {language === 'ar'
                            ? 'بعد اختيار ملف أو أكثر ستظهر معاينة الملف المحدد هنا.'
                            : 'Once you choose one or more files, the selected file preview appears here.'}
                    </p>
                    <p className="body-soft mt-6 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">
                        {language === 'ar'
                            ? 'استخدم عمود الخطوة ١ للسحب أو لاختيار عدة ملفات من الجهاز.'
                            : 'Use Step 1 to drag files or choose multiple files from your device.'}
                    </p>
                </div>
            </div>
        </div>
    );
}

function BatchResultsSection({
    analyses,
    selectedAnalysisId,
    onSelectAnalysis,
}: {
    analyses: AnalysisResult[];
    selectedAnalysisId: number | string | null;
    onSelectAnalysis: (analysis: AnalysisResult) => void;
}) {
    const { language } = useAppContext();

    if (!analyses.length) {
        return null;
    }

    const failedCount = analyses.filter((analysis) => analysis.status !== 'processed').length;
    const successCount = analyses.length - failedCount;

    return (
        <div className="space-y-4 border-t border-white/[0.06] pt-6">
            <div className="flex flex-wrap items-center gap-3">
                <Badge tone={failedCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error'} text={language === 'ar' ? 'تقارير الدفعة' : 'Batch reports'} />
                <h2 className="text-2xl font-extrabold sm:text-[1.75rem]">
                    {language === 'ar' ? 'نتائج الملفات المرفوعة' : 'Uploaded batch results'}
                </h2>
            </div>
            <p className="body-soft text-sm">{buildBatchMessage(language, successCount, failedCount)}</p>

            <div className="grid gap-3 lg:grid-cols-2">
                {analyses.map((analysis) => {
                    const active = String(selectedAnalysisId) === String(analysis.id);

                    return (
                        <button
                            key={analysis.id}
                            type="button"
                            onClick={() => onSelectAnalysis(analysis)}
                            className={cx(
                                'rounded-[1.35rem] border p-4 text-left transition',
                                active
                                    ? 'border-[rgb(var(--primary-rgb)/0.38)] bg-[rgb(var(--primary-rgb)/0.08)] shadow-[0_0_0_4px_rgb(var(--primary-rgb)/0.05)]'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold">{analysis.fileName}</p>
                                    <p className="body-soft mt-1 line-clamp-2 text-xs leading-6">{copyFor(language, analysis.summary)}</p>
                                </div>
                                <Badge
                                    tone={analysis.status === 'processed' ? 'success' : 'error'}
                                    text={analysis.status === 'processed' ? (language === 'ar' ? 'مكتمل' : 'Completed') : (language === 'ar' ? 'فشل' : 'Failed')}
                                />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                <span>{analysis.mediaType === 'image' ? (language === 'ar' ? 'صورة' : 'Image') : (language === 'ar' ? 'فيديو' : 'Video')}</span>
                                <span aria-hidden>•</span>
                                <span>{analysis.confidence.toFixed(1)}%</span>
                                <span aria-hidden>•</span>
                                <span>{analysis.latencyMs} ms</span>
                            </div>
                        </button>
                    );
                })}
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
        <div className={cx('mt-6', showHeader ? 'border-t border-white/[0.06] pt-6' : '')}>
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
                        <SpotlightCard className="relative flex min-h-[22rem] flex-col overflow-hidden !p-0 shadow-[0_18px_56px_-20px_rgba(0,0,0,0.45)]">
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
