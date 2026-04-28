import type { BootPayload } from './app/types';

declare global {
    interface Window {
        __APP_BOOT__?: BootPayload;
    }
}

export {};
