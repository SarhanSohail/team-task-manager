// Central API module — all requests go through here
const API_BASE = '/api';

/**
 * Core request function with auto JWT injection
 */
async function apiRequest(method, endpoint, body = null) {
  const token = localStorage.getItem('ttm_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body && method !== 'GET') options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}

// ===== AUTH =====
const login = (email, password) => apiRequest('POST', '/auth/login', { email, password });
const register = (name, email, password, role) => apiRequest('POST', '/auth/register', { name, email, password, role });
const getMe = () => apiRequest('GET', '/auth/me');

// ===== USERS =====
const getUsers = () => apiRequest('GET', '/users');
const updateUserRole = (id, role) => apiRequest('PUT', `/users/${id}/role`, { role });

// ===== PROJECTS =====
const getProjects = () => apiRequest('GET', '/projects');
const createProject = (data) => apiRequest('POST', '/projects', data);
const getProject = (id) => apiRequest('GET', `/projects/${id}`);
const updateProject = (id, data) => apiRequest('PUT', `/projects/${id}`, data);
const deleteProject = (id) => apiRequest('DELETE', `/projects/${id}`);
const addProjectMember = (projectId, userId) => apiRequest('POST', `/projects/${projectId}/members`, { userId });
const removeProjectMember = (projectId, userId) => apiRequest('DELETE', `/projects/${projectId}/members/${userId}`);

// ===== TASKS =====
const getTasks = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.project) params.set('project', filters.project);
  if (filters.status) params.set('status', filters.status);
  if (filters.assignee) params.set('assignee', filters.assignee);
  if (filters.mine) params.set('mine', 'true');
  const qs = params.toString();
  return apiRequest('GET', `/tasks${qs ? '?' + qs : ''}`);
};
const createTask = (data) => apiRequest('POST', '/tasks', data);
const getTask = (id) => apiRequest('GET', `/tasks/${id}`);
const updateTask = (id, data) => apiRequest('PUT', `/tasks/${id}`, data);
const deleteTask = (id) => apiRequest('DELETE', `/tasks/${id}`);
const updateTaskStatus = (id, status) => apiRequest('PATCH', `/tasks/${id}/status`, { status });
