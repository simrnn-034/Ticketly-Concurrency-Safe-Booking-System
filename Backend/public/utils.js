const API = 'http://localhost:3000/api';

// ─── AUTH ───
const auth = {
  getToken: () => localStorage.getItem('tg_token'),
  getUser: () => JSON.parse(localStorage.getItem('tg_user') || 'null'),
  isLoggedIn: () => !!localStorage.getItem('tg_token'),
  save: (token, user) => {
    localStorage.setItem('tg_token', token);
    localStorage.setItem('tg_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('tg_token');
    localStorage.removeItem('tg_user');
  }
};

// ─── API HELPER ───
async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.getToken()) headers['Authorization'] = `Bearer ${auth.getToken()}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};

// ─── TOAST ───
function toast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = '0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ─── NAV ───
function initNav() {
  const user = auth.getUser();
  const navAuth = document.querySelector('.nav-auth');
  const navInfo = document.getElementById('nav-user-info');

  if (!navAuth) return;

  if (auth.isLoggedIn() && user) {
    if (navInfo) { navInfo.style.display = 'block'; navInfo.textContent = user.name || user.email; }
    navAuth.innerHTML = `
      <a href="bookings.html" class="btn btn-outline btn-sm">My Bookings</a>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
    `;
  } else {
    navAuth.innerHTML = `<a href="auth.html" class="btn btn-gold btn-sm">Sign In</a>`;
  }
}

async function logout() {
  try {
    await api.post('/auth/logout');
  } catch (_) {}
  auth.clear();
  window.location.href = 'index.html';
}

// ─── FORMAT HELPERS ───
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function statusBadge(status) {
  const map = {
    confirmed: 'badge-green',
    pending: 'badge-blue',
    cancelled: 'badge-red',
    refunded: 'badge-muted',
  };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status}</span>`;
}

// ─── MODAL ───
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ─── REQUIRE AUTH ───
function requireAuth() {
  if (!auth.isLoggedIn()) {
    window.location.href = 'auth.html';
    return false;
  }
  return true;
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', initNav);
