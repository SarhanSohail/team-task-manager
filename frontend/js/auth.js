// Auth helpers — token management, user info, page protection

const TOKEN_KEY = 'ttm_token';

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Decode JWT payload (without verification — for client display only)
 */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  return decodeToken(token);
}

function isLoggedIn() {
  const token = getToken();
  if (!token) return false;
  const user = decodeToken(token);
  if (!user) return false;
  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  return user.exp && user.exp > now;
}

function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

/**
 * Call at top of protected pages — redirects to login if not authenticated.
 */
function protectPage() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/**
 * Redirect logged-in users away from auth page
 */
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = '/dashboard.html';
  }
}

function logout() {
  removeToken();
  window.location.href = '/index.html';
}

/**
 * Get initials from a name string
 */
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Check if a task is overdue
 */
function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < today;
}

/**
 * Show an alert message in a container element
 */
function showAlert(containerId, message, type = 'error') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${type === 'error' ? '⚠️' : '✅'} ${message}</div>`;
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}
