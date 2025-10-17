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
        console.debug('Nova Toast: Nova.error called with:', msg);
        if (suppressNextToast) {
            console.debug('Nova Toast: Suppressing toast (our own emit)');
            suppressNextToast = false;
            return;
        }
        const s = normalizeString(msg);
        const knownFormSubmit = normalizeString(KNOWN_ERRORS.formSubmit);
        console.debug('Nova Toast: Comparing:', s, 'vs', knownFormSubmit);
        if (s === knownFormSubmit) {
            console.debug('Nova Toast: Suppressing known form submit error');
            return;
        }
        console.debug('Nova Toast: Emitting toast for message:', msg);
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
        
        // Validate that ax has the required interceptors structure
        if (!ax.interceptors || !ax.interceptors.response || typeof ax.interceptors.response.use !== 'function') {
            console.warn(`Nova Toast: Cannot install interceptor on ${label} - missing interceptors.response.use`);
            return;
        }

        try {
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
        } catch (e) {
            console.error(`Nova Toast: Failed to install interceptor on ${label}`, e);
        }
    }

    // Eagerly install on Nova.request and window.axios
    try {
        const novaAxios = Nova.request?.();
        if (novaAxios) {
            console.debug('Nova Toast: Attempting eager install on Nova.request()', novaAxios);
            installInterceptor(novaAxios, 'Nova.request() (eager)');
        }
    } catch (e) {
        console.error('Nova Toast: Failed to install interceptor on Nova.request', e);
    }
    try {
        if (window.axios) {
            console.debug('Nova Toast: Installing on window.axios', window.axios);
            installInterceptor(window.axios, 'window.axios');
        }
    } catch (e) {
        console.error('Nova Toast: Failed to install interceptor on window.axios', e);
    }

    // Wrap Nova.request to always install interceptor
    if (typeof Nova.request === 'function' && !Nova.__requestWrappedForToast) {
        const origReq = Nova.request.bind(Nova);
        Nova.request = (...args) => {
            try {
                const ax = origReq(...args);
                // More defensive check for axios instance
                if (ax && typeof ax === 'object' && ax.interceptors && ax.interceptors.response) {
                    installInterceptor(ax, 'Nova.request() (wrapped)');
                } else if (ax) {
                    console.debug('Nova Toast: Nova.request() returned object without interceptors', ax);
                }
                return ax;
            } catch (e) {
                console.error('Nova Toast: Error wrapping Nova.request', e);
                // Return original request to prevent breaking Nova
                try {
                    return origReq(...args);
                } catch (fallbackError) {
                    console.error('Nova Toast: Fallback also failed', fallbackError);
                    throw e; // Re-throw original error
                }
            }
        };
        Nova.__requestWrappedForToast = true;
    }

    // Additional fallback: Hook into Nova's global error handling more directly
    // Listen for any axios instances that get created and try to intercept them
    const originalAxiosCreate = window.axios?.create;
    if (originalAxiosCreate) {
        window.axios.create = function(...args) {
            const instance = originalAxiosCreate.apply(this, args);
            console.debug('Nova Toast: New axios instance created, installing interceptor', instance);
            installInterceptor(instance, 'axios.create()');
            return instance;
        };
    }

    // Try to hook into any existing Nova store or global state
    if (window.Nova && window.Nova.store) {
        console.debug('Nova Toast: Found Nova.store, attempting to hook into state changes');
    }

    window.__novaToastPatchLoaded = true;
    console.debug('Nova Toast: Package loaded successfully');
});