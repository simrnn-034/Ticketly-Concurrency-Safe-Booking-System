  // redirect if already logged in
  if (auth.isLoggedIn()) window.location.href = 'index.html';

  function switchTab(tab) {
    document.getElementById('login-tab').classList.toggle('active', tab === 'login');
    document.getElementById('register-tab').classList.toggle('active', tab === 'register');
    document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    clearError();
  }

  function showError(msg) {
    const el = document.getElementById('auth-error');
    el.style.display = 'block';
    el.textContent = msg;
  }

  function clearError() {
    document.getElementById('auth-error').style.display = 'none';
  }

  async function login() {
    clearError();
    const btn = document.getElementById('login-btn');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) { showError('Please fill in all fields'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in...';

    try {
      const data = await api.post('/auth/login', { email, password });
      auth.save(data.data.token, data.data.user);
      toast('Welcome back!', 'success');

      const redirect = new URLSearchParams(location.search).get('redirect') || 'index.html';
      setTimeout(() => window.location.href = redirect, 500);
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  }

  async function register() {
    clearError();
    const btn = document.getElementById('register-btn');
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    if (!name || !email || !password) { showError('Please fill in all required fields'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account...';

    try {
      const data = await api.post('/auth/register', { name, email, phone, password, role });
      auth.save(data.data.token, data.data.user);
      toast('Account created!', 'success');
      setTimeout(() => window.location.href = 'index.html', 500);
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  }

  // enter key support
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (document.getElementById('login-form').style.display !== 'none') login();
    else register();
  });
