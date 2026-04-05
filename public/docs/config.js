// ClawOps 共通設定・API関数
// ※ このファイルにservice_roleキーを絶対に書かないこと
(function() {
  const SB_URL = 'https://gedxzunoyzmvbqgwjalx.supabase.co';
  const SB_KEY = 'sb_publishable_IzlPureuUqGFLmiytYHeTw_jSQS2SXF';
  const SB_STORAGE_BASE = SB_URL + '/storage/v1/object/public/announcements/';
  const SB_REST = SB_URL + '/rest/v1';
  const SB_FN = SB_URL + '/functions/v1';
  const AUTH_STORAGE_KEY = 'sb-gedxzunoyzmvbqgwjalx-auth-token';

  function getAuthToken() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.access_token && parsed.expires_at * 1000 > Date.now()) {
        return parsed.access_token;
      }
    } catch {}
    return null;
  }

  function requireAuth() {
    const token = getAuthToken();
    if (token) return token;
    // On login page, don't redirect
    if (location.pathname.endsWith('index.html') || location.pathname.endsWith('/docs/')) {
      return SB_KEY; // fallback to anon for login page
    }
    // Redirect to login
    location.href = '/docs/';
    throw new Error('認証が必要です');
  }

  function headers() {
    return { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + requireAuth() };
  }

  async function sbGet(table, params) {
    params = params || '';
    let all = [], offset = 0;
    const PAGE = 1000;
    while (true) {
      const r = await fetch(SB_REST + '/' + table + '?' + params + '&limit=' + PAGE + '&offset=' + offset, { headers: headers() });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      all = all.concat(d);
      if (d.length < PAGE) break;
      offset += PAGE;
    }
    return all;
  }

  async function sbPatch(table, id, idCol, body) {
    const r = await fetch(SB_REST + '/' + table + '?' + idCol + '=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { ...headers(), 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
  }

  async function sbPost(table, body) {
    const r = await fetch(SB_REST + '/' + table, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function sbDelete(table, colOrId, val) {
    var filter = val != null ? colOrId + '=eq.' + encodeURIComponent(val) : 'id=eq.' + encodeURIComponent(colOrId);
    const r = await fetch(SB_REST + '/' + table + '?' + filter, {
      method: 'DELETE',
      headers: headers()
    });
    if (!r.ok) throw new Error(await r.text());
  }

  // Expose globally
  window.CLAWOPS_CONFIG = {
    SUPABASE_URL: SB_URL,
    SUPABASE_ANON_KEY: SB_KEY,
    SUPABASE_REST: SB_REST,
    SUPABASE_FN: SB_FN,
    SUPABASE_STORAGE: SB_STORAGE_BASE,
    getAuthToken: getAuthToken,
    requireAuth: requireAuth,
    headers: headers,
  };

  // Expose API functions globally (for HTML pages)
  window.sbGet = sbGet;
  window.sbPatch = sbPatch;
  window.sbPost = sbPost;
  window.sbDelete = sbDelete;
})();
