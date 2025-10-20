Nova.booting(() => {
  const DEDUP_WINDOW_MS = 2000; // prevent showing identical toast in a tight window
  const GENERIC = 'there was a problem submitting the form';

  const KNOWN_ERRORS = {
    formSubmit: 'there was a problem submitting the form',
    // Add more known error strings here as needed
  };

  const normalize = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

  const originalError = typeof Nova.error === 'function' ? Nova.error.bind(Nova) : (msg) => console.error(msg);

  // Dedupe + re-entrancy state
  const lastToast = { msg: '', at: 0 };
  let suppressNextToast = false;

  // Most recent extracted messages from a server validation/response error
  const LAST = { msgs: [], at: 0, emittedAt: 0 };

  function unique(arr) {
    return Array.from(new Set(arr.map((v) => String(v || '').trim()).filter(Boolean)));
  }

  // Rich, defensive message extraction
  function extractMessages(data) {
    const out = [];
    const push = (v) => {
      if (v == null) return;
      if (Array.isArray(v)) { v.forEach(push); return; }
      if (typeof v === 'string') out.push(v);
    };
    const collectErrorsObject = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const v of Object.values(obj)) push(v);
    };

    if (data && typeof data === 'object') {
      // Laravel-style
      if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) collectErrorsObject(data.errors);
      if (Array.isArray(data.errors)) push(data.errors);

      // Common fields
      push(data.message);
      push(data.error);
      push(data.detail);
      push(data.title);

      // Nested envelope
      if (data.data && typeof data.data === 'object') {
        const inner = data.data;
        if (inner.errors && typeof inner.errors === 'object' && !Array.isArray(inner.errors)) collectErrorsObject(inner.errors);
        if (Array.isArray(inner.errors)) push(inner.errors);
        push(inner.message);
        push(inner.error);
      }
    }

    // Filter boilerplate placeholders
    const blacklist = [normalize(GENERIC), 'the given data was invalid.', 'unprocessable content', 'unprocessable entity'];
    return unique(out.filter((m) => {
      const nm = normalize(m);
      return !blacklist.some((b) => nm === b || (b && nm.includes(b)));
    }));
  }

  // Single-shot toast emitter with dedupe + re-entrancy guard
  function emitToastOnce(raw) {
    const msg = String(raw || '').trim();
    if (!msg) return;
    const now = Date.now();
    if (msg === lastToast.msg && (now - lastToast.at) < DEDUP_WINDOW_MS) return;
    lastToast.msg = msg;
    lastToast.at = now;
    LAST.emittedAt = now;
    suppressNextToast = true; // prevent our own call from echoing back through Nova.error
    originalError(msg);
  }

  // Nova.error wrapper: replace generic with field messages when we have them; otherwise, dedupe+emit
  function wrapNovaError() {
    if (Nova.__nvErrWrapped || typeof Nova.error !== 'function') return;

    Nova.error = (msg) => {
      if (suppressNextToast) { // one-shot suppression for our own emit
        suppressNextToast = false;
        return;
      }

      const s = normalize(msg);
      const isGeneric = s && (s === normalize(GENERIC) || s.includes('problem submitting the form') || s.includes('submitting the form'));

      if (isGeneric) {
        // If we captured real field messages very recently, replace the generic with them.
        if (LAST.msgs.length && Date.now() - LAST.at < 6000) {
          if (LAST.emittedAt && Date.now() - LAST.emittedAt <= 1500) return; // avoid echoing our own recent emit
          LAST.emittedAt = Date.now();
          return emitToastOnce(LAST.msgs.join('\n'));
        }
      }

      // Non-generic (or no recent LAST): just apply dedupe
      return emitToastOnce(String(msg ?? ''));
    };

    Nova.__nvErrWrapped = true;
  }

  // Attach a single axios response interceptor to an instance
  function attachAxiosInterceptor(instance) {
    try {
      const ax = instance || (typeof Nova.request === 'function' ? Nova.request() : (window.axios || null));
      if (!ax || ax.__nvToast) return;
      if (!ax.interceptors || !ax.interceptors.response || typeof ax.interceptors.response.use !== 'function') return;

      ax.interceptors.response.use(
        (r) => r,
        (err) => {
          try {
            const res = err && err.response;
            if (res && res.data) {
              // Per-response processed guard to avoid double handling of the same response
              if (!res.config) res.config = {};
              if (!res.config.__novaToastProcessed) {
                res.config.__novaToastProcessed = true;

                const msgs = extractMessages(res.data);
                if (msgs.length) {
                  LAST.msgs = msgs;
                  LAST.at = Date.now();
                  emitToastOnce(msgs.join('\n'));
                }
              }
            }
          } catch (_) { /* ignore */ }
          return Promise.reject(err);
        }
      );

      ax.__nvToast = true;
    } catch (_) { /* ignore */ }
  }

  // Ensure we always attach to the axios instance Nova really uses
  function wrapNovaRequest() {
    if (Nova.__nvReqWrapped || typeof Nova.request !== 'function') return;
    const orig = Nova.request.bind(Nova);
    Nova.request = (...args) => {
      const ax = orig(...args);
      try { attachAxiosInterceptor(ax); } catch (_) { /* ignore */ }
      return ax;
    };
    Nova.__nvReqWrapped = true;
  }

  // Eager installs on present instances
  try { attachAxiosInterceptor(); } catch (_) { /* ignore */ }

  // Also patch future axios instances created via window.axios.create
  try {
    if (window.axios && typeof window.axios.create === 'function' && !window.axios.__nvCreateWrapped) {
      const origCreate = window.axios.create.bind(window.axios);
      window.axios.create = (...args) => {
        const inst = origCreate(...args);
        try { attachAxiosInterceptor(inst); } catch (_) { /* ignore */ }
        return inst;
      };
      window.axios.__nvCreateWrapped = true;
    }
  } catch (_) { /* ignore */ }

  // Always ensure Nova.request() returns are patched going forward
  wrapNovaRequest();

  // Wrap Nova.error last so our emit/dedupe behavior is authoritative
  wrapNovaError();

  window.__novaToastPatchLoaded = true;
});