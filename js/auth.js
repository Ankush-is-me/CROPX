/* js/auth.js
   Handles login/register/logout against the Vercel serverless auth API,
   session caching for the UI, and the Login/Register view markup.
   No password is ever stored or checked in this file — the browser only
   ever talks to /api/auth/* and receives a signed session cookie back.
*/
window.CROPX = window.CROPX || {};

CROPX.auth = (function () {
  const USER_KEY = 'cropx_user';

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) { return null; }
  }

  function setUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function isLoggedIn() { return Boolean(currentUser()); }

  async function refreshSession() {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (!r.ok) { setUser(null); return null; }
      const data = await r.json();
      if (data.authenticated) { setUser(data.user); return data.user; }
      setUser(null);
      return null;
    } catch (e) {
      // Network unavailable — keep whatever cached user we already have
      // so the demo doesn't break offline mid-presentation.
      return currentUser();
    }
  }

  async function login(email, password) {
    const r = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not sign in.');
    setUser(data.user);
    if (data.token) localStorage.setItem('cropx_token', data.token);
    return data.user;
  }

  async function register(name, email, password) {
    const r = await fetch('/api/auth/register', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not create your account.');
    setUser(data.user);
    if (data.token) localStorage.setItem('cropx_token', data.token);
    return data.user;
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
    setUser(null);
    localStorage.removeItem('cropx_token');
  }

  function authHeader() {
    const token = localStorage.getItem('cropx_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /* ---------------- Views ---------------- */

  function loginView() {
    return `
    <div class="auth-shell view-enter">
      <div class="auth-card">
        <span class="brand-mark" style="color:var(--green);">
          <svg viewBox="0 0 40 40" width="34" height="34"><path d="M20 4 C10 10 8 20 8 26 C8 33 13.5 37 20 37 C26.5 37 32 33 32 26 C32 20 30 10 20 4 Z" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>
        </span>
        <h1>Welcome back</h1>
        <p class="muted" style="margin-bottom:1.5rem;">Sign in to manage your farm and use CROPX AI.</p>
        <div class="form-error-banner" id="loginError"></div>
        <form id="loginForm" novalidate>
          <div class="field"><label for="loginEmail">Email</label><input type="email" id="loginEmail" autocomplete="email" required/></div>
          <div class="field"><label for="loginPassword">Password</label><input type="password" id="loginPassword" autocomplete="current-password" required/></div>
          <button class="btn btn-primary btn-block" type="submit" id="loginSubmit">Log in</button>
        </form>
        <div class="demo-hint">🧪 <strong>Presentation demo account:</strong><br/>demo@cropx.app · CropXDemo123</div>
        <p class="auth-switch">New to CROPX? <a href="#/register">Create an account</a></p>
      </div>
    </div>`;
  }

  function registerView() {
    return `
    <div class="auth-shell view-enter">
      <div class="auth-card">
        <span class="brand-mark" style="color:var(--green);">
          <svg viewBox="0 0 40 40" width="34" height="34"><path d="M20 4 C10 10 8 20 8 26 C8 33 13.5 37 20 37 C26.5 37 32 33 32 26 C32 20 30 10 20 4 Z" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>
        </span>
        <h1>Create your account</h1>
        <p class="muted" style="margin-bottom:1.5rem;">Set up CROPX for your farm in under a minute.</p>
        <div class="form-error-banner" id="registerError"></div>
        <form id="registerForm" novalidate>
          <div class="field"><label for="regName">Full name</label><input type="text" id="regName" autocomplete="name" required/></div>
          <div class="field"><label for="regEmail">Email</label><input type="email" id="regEmail" autocomplete="email" required/></div>
          <div class="field">
            <label for="regPassword">Password</label>
            <input type="password" id="regPassword" autocomplete="new-password" minlength="8" required/>
            <div class="field-hint">At least 8 characters.</div>
          </div>
          <button class="btn btn-primary btn-block" type="submit" id="registerSubmit">Create account</button>
        </form>
        <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>
      </div>
    </div>`;
  }

  function bindLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('loginError');
      const btn = document.getElementById('loginSubmit');
      errBox.classList.remove('show');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        await login(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value);
        CROPX.app.toast('Welcome back to CROPX!', 'success');
        CROPX.app.navigate('/dashboard');
      } catch (err) {
        errBox.textContent = err.message; errBox.classList.add('show');
      } finally {
        btn.disabled = false; btn.textContent = 'Log in';
      }
    });
  }

  function bindRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('registerError');
      const btn = document.getElementById('registerSubmit');
      errBox.classList.remove('show');
      btn.disabled = true; btn.textContent = 'Creating account…';
      try {
        await register(
          document.getElementById('regName').value.trim(),
          document.getElementById('regEmail').value.trim(),
          document.getElementById('regPassword').value
        );
        CROPX.app.toast('Account created — welcome to CROPX!', 'success');
        CROPX.app.navigate('/dashboard');
      } catch (err) {
        errBox.textContent = err.message; errBox.classList.add('show');
      } finally {
        btn.disabled = false; btn.textContent = 'Create account';
      }
    });
  }

  return { currentUser, setUser, isLoggedIn, refreshSession, login, register, logout, authHeader, loginView, registerView, bindLoginForm, bindRegisterForm };
})();
