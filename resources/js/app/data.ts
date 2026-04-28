import type { FeatureCard, LocalizedText, NavItem, QuickAction, WorkflowStep } from './types';
import { createCopy } from './utils';

export const projectTitle: LocalizedText = createCopy(
    'نظام تعلم عميق متكامل لتصنيف لغة الإشارة والمشاعر',
    'End-to-End Deep Learning System for Sign Language and Emotion Classification',
);

export const projectShortTitle: LocalizedText = createCopy(
    'نظام تصنيف الإشارة والمشاعر',
    'Sign & Emotion Classification System',
);

export const publicNav: NavItem[] = [
    { to: '/', label: createCopy('الرئيسية', 'Home'), icon: 'home', exact: true },
    { to: '/upload', label: createCopy('التحليل', 'Analysis'), icon: 'sparkles' },
    { to: '/history', label: createCopy('السجل', 'History'), icon: 'history' },
];

export const appNav: NavItem[] = [
    { to: '/upload', label: createCopy('الرفع والتحليل', 'Upload & Analysis'), icon: 'sparkles' },
    { to: '/history', label: createCopy('السجل', 'History'), icon: 'history' },
    { to: '/settings', label: createCopy('الإعدادات', 'Settings'), icon: 'settings' },
    { to: '/admin/dashboard', label: createCopy('لوحة الإدارة', 'Admin Panel'), icon: 'shield', adminOnly: true },
];

export const landingHighlights: FeatureCard[] = [
    {
        icon: 'brain',
        tone: 'info',
        title: createCopy('تعلم عميق متكامل', 'End-to-end deep learning'),
        description: createCopy(
            'خط استدلال يربط استخراج الإطارات والمعالم بشبكات عصبية عميقة لتصنيف الإشارة والمشاعر في تدفق واحد.',
            'A unified inference pipeline links frame extraction and landmarks to deep neural networks that classify the sign and emotion in a single flow.',
        ),
    },
    {
        icon: 'shield',
        tone: 'success',
        title: createCopy('بنية تشغيلية موثوقة', 'Reliable runtime architecture'),
        description: createCopy(
            'Laravel يدير الحسابات والجلسات والسجل، وPython يشغّل النماذج العميقة وخدمات المعالجة.',
            'Laravel handles accounts, sessions and history while Python runs the deep models and processing services.',
        ),
    },
    {
        icon: 'globe',
        tone: 'warning',
        title: createCopy('واجهة بحثية ثنائية اللغة', 'Bilingual research-grade UI'),
        description: createCopy(
            'دعم عربي وإنجليزي كامل مع RTL/LTR، مصممة لعرض المخرجات الإحصائية بشكل واضح.',
            'Full Arabic and English support with RTL/LTR, designed to surface statistical outputs clearly.',
        ),
    },
];

export const workflowSteps: WorkflowStep[] = [
    {
        icon: 'upload',
        title: createCopy('استقبال البيانات', 'Data ingestion'),
        description: createCopy(
            'رفع الفيديو أو الصورة، التحقق من النوع والجودة، وتجهيز العينة لمسار التحليل.',
            'Upload video or image, validate format and quality, and queue the sample for the inference pipeline.',
        ),
    },
    {
        icon: 'frames',
        title: createCopy('استخراج الإطارات والمعالم', 'Frame & landmark extraction'),
        description: createCopy(
            'تقسيم العينة إلى إطارات واستخراج معالم اليدين والجسم والوجه كمدخلات للشبكة العصبية.',
            'Decompose the sample into frames and extract hand, body, and facial landmarks as inputs to the neural network.',
        ),
    },
    {
        icon: 'brain',
        title: createCopy('التصنيف بالتعلم العميق', 'Deep learning classification'),
        description: createCopy(
            'نماذج عميقة تتنبأ بالإشارة وتصنّف المشاعر مع تقدير درجة الثقة والتنبؤات البديلة.',
            'Deep models predict the sign and classify emotion, producing confidence scores and alternative predictions.',
        ),
    },
    {
        icon: 'scan',
        title: createCopy('تقرير المخرجات', 'Output report'),
        description: createCopy(
            'النتيجة تُعرض كتقرير تحليلي يتضمّن الملخص، الزمن، الإطارات المُحلّلة، ومؤشرات الجودة.',
            'Results are presented as an analytical report with summary, latency, analyzed frames, and quality indicators.',
        ),
    },
];

export const whyItMatters: FeatureCard[] = [
    {
        icon: 'heart',
        tone: 'success',
        title: createCopy('وصول رقمي أكثر إنصافًا', 'More equitable digital access'),
        description: createCopy(
            'تقليل الحواجز أمام الصمّ وضعاف السمع في التفاعل الرقمي والخدمات التعليمية والصحية.',
            'Reduce barriers for deaf and hard-of-hearing users across digital, educational, and healthcare interactions.',
        ),
    },
    {
        icon: 'users',
        tone: 'info',
        title: createCopy('شمولية قابلة للقياس', 'Measurable inclusion'),
        description: createCopy(
            'تحويل الأبحاث في التعلم العميق إلى أداة عملية يستفيد منها المستخدم والباحث وصانع القرار.',
            'Translate deep learning research into a practical tool benefiting users, researchers, and decision-makers.',
        ),
    },
    {
        icon: 'layers',
        tone: 'warning',
        title: createCopy('بنية مهيّأة للتوسع', 'Architecture ready to scale'),
        description: createCopy(
            'واجهة معيارية يسهل ربطها مع APIs ونماذج جديدة وخدمات استدلال إضافية مستقبلًا.',
            'A modular frontend ready to integrate with APIs, new models, and additional inference services.',
        ),
    },
];

export const quickActions: QuickAction[] = [
    {
        to: '/upload',
        icon: 'upload',
        title: createCopy('استدلال جديد', 'New inference'),
        description: createCopy(
            'ابدأ تحليلًا جديدًا لرفع عينة وتشغيل خط التعلم العميق لتصنيف الإشارة والمشاعر.',
            'Start a new analysis to upload a sample and run the deep learning pipeline for sign and emotion classification.',
        ),
    },
];

export const testimonials: Array<{ quote: LocalizedText; name: string; role: LocalizedText }> = [
    // Testimonials intentionally removed per request.
];

export const settingsLabels: Record<string, LocalizedText> = {
    dark: createCopy('داكن', 'Dark'),
    light: createCopy('فاتح', 'Light'),
    system: createCopy('حسب النظام', 'System'),
    comfortable: createCopy('مريح', 'Comfortable'),
    large: createCopy('كبير', 'Large'),
};
