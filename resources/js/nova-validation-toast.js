Nova.booting(() => {
    const DEDUP_WINDOW_MS = 2000;
    const originalError = Nova.error.bind(Nova);
    const lastToast = { msg: '', at: 0 };

    const KNOWN_ERRORS = {
        formSubmit: 'there was a problem submitting the form',
        // Add more known error strings here as needed
    };

    const normalizeString = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

    let suppressNextToast = false;
    function emitToastOnce(raw) {
        const msg = String(raw || '').trim();
        if (!msg) return;
        const now = Date.now();
        if (msg === lastToast.msg && (now - lastToast.at) < DEDUP_WINDOW_MS) return;
        lastToast.msg = msg;
        lastToast.at = now;
        suppressNextToast = true;
        originalError(msg);
    }

    Nova.error = (msg) => {
        if (suppressNextToast) {
            suppressNextToast = false;
            return;
        }
        const s = normalizeString(msg);
        if (s === normalizeString(KNOWN_ERRORS.formSubmit)) return;
        emitToastOnce(msg);
    };

    function uniq(arr) {
        return Array.from(new Set(arr.map(v => String(v || '').trim()).filter(Boolean)));
    }

    function extractErrorMessages(data) {
        const msgs = (data?.errors && typeof data.errors === 'object')
            ? Object.values(data.errors).reduce((acc, v) => {
                if (Array.isArray(v)) acc.push(...v);
                else if (typeof v === 'string') acc.push(v);
                return acc;
            }, [])
            : [];
        if (typeof data?.message === 'string') msgs.push(data.message);
        return uniq(msgs);
    }

    function showServerErrors(res) {
        const data = res?.data;
        if (!data || typeof data !== 'object') return false;
        const msgs = extractErrorMessages(data);
        if (!msgs.length) return false;
        emitToastOnce(msgs.join('\n'));
        return true;
    }

    function installInterceptor(ax, label = 'unknown') {
        if (!ax || ax.__novaToastInstalled) return;
        ax.interceptors.response.use(
            r => r,
            (error) => {
                try {
                    // Safely access error properties with proper null checks
                    if (error && typeof error === 'object' && error.response) {
                        const res = error.response;
                        if (res && !res.config?.__novaToastProcessed) {
                            res.config = res.config || {};
                            res.config.__novaToastProcessed = true;
                            showServerErrors(res);
                        }
                    }
                } catch (e) {
                    console.warn('Nova Toast: Error in response interceptor', e);
                }
                return Promise.reject(error);
            }
        );
        ax.__novaToastInstalled = true;
    }

    // Eagerly install on Nova.request and window.axios
    try {
        installInterceptor(Nova.request?.(), 'Nova.request() (eager)');
    } catch (e) {
        console.error('Nova Toast: Failed to install interceptor on Nova.request', e);
    }
    try {
        if (window.axios) installInterceptor(window.axios, 'window.axios');
    } catch (e) {
        console.error('Nova Toast: Failed to install interceptor on window.axios', e);
    }

    // Wrap Nova.request to always install interceptor
    if (typeof Nova.request === 'function' && !Nova.__requestWrappedForToast) {
        const origReq = Nova.request.bind(Nova);
        Nova.request = (...args) => {
            try {
                const ax = origReq(...args);
                if (ax && typeof ax === 'object') {
                    installInterceptor(ax, 'Nova.request() (wrapped)');
                }
                return ax;
            } catch (e) {
                console.error('Nova Toast: Error wrapping Nova.request', e);
                return origReq(...args);
            }
        };
        Nova.__requestWrappedForToast = true;
    }

    window.__novaToastPatchLoaded = true;
});