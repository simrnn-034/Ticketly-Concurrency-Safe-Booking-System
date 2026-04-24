const API = 'http://localhost:3000/api';

const auth = {
  user: null,
  _promise: null,

  async isLoggedIn() {
    if (this.user) return true;
    if (!this._promise) {
      this._promise = api.get('/auth/me')
        .then(res => { this.user = res.user; return true; })
        .catch(() => { this.user = null; return false; })
        .finally(() => { this._promise = null; });
    }
    return this._promise;
  },

  getUser() {       
    return this.user;
  },

  clear() {
    this.user = null;
    this._promise = null;
  }
};

async function request(method, path, body = null) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include", 
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json();

  if (res.status === 401) {
  const hadSession = !!auth.user;
  auth.clear(); 
  const onAuthPage = location.pathname.endsWith('auth.html');
  if (!onAuthPage && hadSession) {
    toast('Session expired. Please sign in again.', 'warning');
    setTimeout(() => window.location.href = 'auth.html', 1200);
  } else if (!onAuthPage) {
    window.location.href = 'auth.html';
  }

  throw new Error('Unauthorized');
}

  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};

async function initNav() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  const loggedIn = await auth.isLoggedIn();
  const user = auth.getUser();

  if (loggedIn && user) {
    const initials = user.name
      ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
      : user.email[0].toUpperCase();

    navRight.innerHTML = `
      <div class="nav-user">
        <div class="nav-avatar">${initials}</div>
        <span style="color:var(--text2); font-size:0.82rem;">
          ${user.name || user.email}
        </span>
      </div>
      ${user.role === 'organizer'
        ? `<a href="organizer.html" class="btn btn-ghost btn-sm">My Events</a>`
        : ''}
      <a href="bookings.html" class="btn btn-outline btn-sm">Bookings</a>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Sign Out</button>
    `;
  } else {
    navRight.innerHTML = `
      <a href="auth.html" class="btn btn-outline btn-sm">Sign In</a>
      <a href="auth.html?tab=register" class="btn btn-primary btn-sm">Get Started</a>
    `;
  }

  const currentPage = location.pathname.split('/').pop();
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

async function logout() {
  try {
    await api.post('/auth/logout'); 
  } catch (_) {}

  auth.clear();
  toast('Signed out successfully', 'success');

  setTimeout(() => window.location.href = 'index.html', 500);
}


async function requireAuth(redirect = true) {
  const loggedIn = await auth.isLoggedIn();

  if (!loggedIn) {
    if (redirect) {
      window.location.href =
        `auth.html?redirect=${encodeURIComponent(location.href)}`;
    }
    return false;
  }
  return true;
}

function toast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;

  container.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'all 0.3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(120%)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});


function formatDate(d) {
  if (!d) return 'TBA';
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCurrency(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function formatDuration(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function statusBadge(status) {
  const map = {
    confirmed: 'badge-green',
    pending: 'badge-orange',
    cancelled: 'badge-red',
    refunded: 'badge-grey',
    published: 'badge-green',
    draft: 'badge-grey',
    completed: 'badge-purple',
  };
  return `<span class="badge ${map[status] || 'badge-grey'}">${status}</span>`;
}

const CAT_COLORS = ['#6c3fc5', '#0891b2', '#059669', '#dc2626', '#d97706', '#7c3aed'];

document.addEventListener('DOMContentLoaded', initNav);