import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './bootstrap';
import { AppProvider } from './app/context';
import { App } from './app/App';

const container = document.getElementById('app');

if (!container) {
    throw new Error('Missing #app mount point');
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Root render failure', error, info);
    }

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        return (
            <div style={{ minHeight: '100vh', padding: '32px', background: '#04111b', color: '#eef5ff', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ maxWidth: '860px', margin: '0 auto', border: '1px solid rgba(125,211,252,0.26)', borderRadius: '24px', padding: '24px', background: 'rgba(11,34,52,0.92)' }}>
                    <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '999px', border: '1px solid rgba(110,231,249,0.18)', color: '#9be7f8', fontSize: '12px', fontWeight: 700 }}>
                        Root Error
                    </div>
                    <h1 style={{ marginTop: '16px', fontSize: '32px', fontWeight: 800 }}>The application failed before the first screen rendered.</h1>
                    <p style={{ marginTop: '16px', lineHeight: 1.8 }}>{this.state.error.message}</p>
                </div>
            </div>
        );
    }
}

createRoot(container).render(
    <React.StrictMode>
        <RootErrorBoundary>
            <AppProvider>
                <App />
            </AppProvider>
        </RootErrorBoundary>
    </React.StrictMode>,
);
