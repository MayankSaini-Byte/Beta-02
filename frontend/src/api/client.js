import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Gateway routing: when the app is served from the sandbox preview, every API
// call must carry XTransformPort so the gateway forwards it to the Express API.
// Locally (vite proxy / Express single-origin) the param is simply ignored.
const API_PORT = window.__KS_API_PORT || '';
if (API_PORT) {
  api.interceptors.request.use((cfg) => {
    cfg.params = { ...(cfg.params || {}), XTransformPort: API_PORT };
    return cfg;
  });
}

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('ks_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config && err.config.url;
    if (err.response && err.response.status === 401 && url && !url.includes('/auth/')) {
      localStorage.removeItem('ks_token');
      localStorage.removeItem('ks_user');
      if (!String(window.location.hash).includes('/login')) window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const ok = document.execCommand('copy');
  field.remove();
  if (!ok) throw new Error('Clipboard access is unavailable');
}

export async function downloadInventoryCsv() {
  const { data } = await api.get('/pantry/export', { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kitchensync-inventory.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const errMsg = (e) => (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || 'Something went wrong';

export const inr = (n) => `\u20B9${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export default api;
