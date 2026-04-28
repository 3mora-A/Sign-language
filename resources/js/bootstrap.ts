import axios from 'axios';

declare global {
    interface Window {
        axios: typeof axios;
    }
}

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const csrfToken = document
    .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
    ?.getAttribute('content');

if (csrfToken) {
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
}

export {};
