const configuredBase = import.meta.env.VITE_API_BASE_URL || '/api';
const desktopApiOrigin = (
  import.meta.env.VITE_DESKTOP_API_ORIGIN ||
  import.meta.env.VITE_API_ORIGIN ||
  'https://noteflow-noteflow-fyggh3-aefd78-151-245-32-88.sslip.io'
).replace(/\/$/, '');

const BASE =
  typeof window !== 'undefined' &&
  window.location.protocol === 'file:' &&
  configuredBase.startsWith('/')
    ? `${desktopApiOrigin}${configuredBase}`
    : configuredBase;

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function imageRequest(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Image request failed');
  }
  return options.method === 'DELETE' ? res.json() : res.blob();
}

export const api = {
  // auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  saveOneSignalId: (player_id) => request('/auth/onesignal', { method: 'PATCH', body: { player_id } }),

  // workspaces
  getWorkspaces: () => request('/workspaces'),
  createWorkspace: (body) => request('/workspaces', { method: 'POST', body }),
  updateWorkspace: (id, body) => request(`/workspaces/${id}`, { method: 'PATCH', body }),
  deleteWorkspace: (id) => request(`/workspaces/${id}`, { method: 'DELETE' }),
  inviteMember: (id, email) => request(`/workspaces/${id}/invite`, { method: 'POST', body: { email } }),
  getMembers: (id) => request(`/workspaces/${id}/members`),
  updateWorkspaceMember: (id, userId, role) =>
    request(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeWorkspaceMember: (id, userId) =>
    request(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
  getInvitation: (token) => request(`/invitations/${token}`),

  // power features
  getPowerOverview: (workspaceId) => request(`/productivity/workspace/${workspaceId}/overview`),
  powerSearch: (workspaceId, query, hasScreenshot = false) =>
    request(`/productivity/workspace/${workspaceId}/search?q=${encodeURIComponent(query)}&has_screenshot=${hasScreenshot}`),
  createTask: (body) => request('/productivity/tasks', { method: 'POST', body }),
  updateTask: (id, body) => request(`/productivity/tasks/${id}`, { method: 'PATCH', body }),
  deleteTask: (id) => request(`/productivity/tasks/${id}`, { method: 'DELETE' }),
  getNoteDetails: (noteId) => request(`/productivity/notes/${noteId}/details`),
  addComment: (noteId, body) => request(`/productivity/notes/${noteId}/comments`, { method: 'POST', body: { body } }),
  resolveComment: (id, resolved) => request(`/productivity/comments/${id}`, { method: 'PATCH', body: { resolved } }),
  addAnnotation: (imageId, body) => request(`/productivity/images/${imageId}/annotations`, { method: 'POST', body }),
  deleteAnnotation: (id) => request(`/productivity/annotations/${id}`, { method: 'DELETE' }),
  restoreVersion: (noteId, versionId) => request(`/productivity/notes/${noteId}/restore/${versionId}`, { method: 'POST' }),
  createTemplate: (body) => request('/productivity/templates', { method: 'POST', body }),
  useTemplate: (id) => request(`/productivity/templates/${id}/use`, { method: 'POST' }),
  deleteTemplate: (id) => request(`/productivity/templates/${id}`, { method: 'DELETE' }),
  shareNote: (noteId, body = {}) => request(`/productivity/notes/${noteId}/share`, { method: 'POST', body }),
  revokeShare: (token) => request(`/productivity/shares/${token}`, { method: 'DELETE' }),
  readNotification: (id) => request(`/productivity/notifications/${id}/read`, { method: 'PATCH' }),
  updateMemberPermissions: (workspaceId, userId, permissions) =>
    request(`/productivity/workspace/${workspaceId}/members/${userId}/permissions`, { method: 'PATCH', body: { permissions } }),

  // notes
  getNotes: (workspaceId) => request(`/notes/workspace/${workspaceId}`),
  createNote: (body) => request('/notes', { method: 'POST', body }),
  updateNote: (id, body) => request(`/notes/${id}`, { method: 'PATCH', body }),
  updateNoteSection: (noteId, sectionId, body) =>
    request(`/notes/${noteId}/sections/${sectionId}`, { method: 'PATCH', body }),
  createNoteLink: (noteId, target_id) =>
    request(`/notes/${noteId}/links`, { method: 'POST', body: { target_id } }),
  deleteNoteLink: (noteId, linkId) =>
    request(`/notes/${noteId}/links/${linkId}`, { method: 'DELETE' }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  reorderNotes: (workspaceId, note_ids) =>
    request(`/notes/workspace/${workspaceId}/order`, { method: 'PUT', body: { note_ids } }),
  mergeNotes: (targetId, source_id) =>
    request(`/notes/${targetId}/merge`, { method: 'POST', body: { source_id } }),
  uploadNoteImage: (id, file) =>
    imageRequest(`/notes/${id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    }).then(async (blob) => JSON.parse(await blob.text())),
  getNoteImage: (id) => imageRequest(`/notes/images/${id}`),
  deleteNoteImage: (noteId, imageId) =>
    imageRequest(`/notes/${noteId}/images/${imageId}`, { method: 'DELETE' }),

  // meetings
  getMeetings: (workspaceId) => request(`/meetings/workspace/${workspaceId}`),
  createMeeting: (body) => request('/meetings', { method: 'POST', body }),
  updateMeeting: (id, body) => request(`/meetings/${id}`, { method: 'PATCH', body }),
  deleteMeeting: (id) => request(`/meetings/${id}`, { method: 'DELETE' }),

  // google calendar
  googleConnectUrl: () => request('/google/connect-url'),
  googleStatus: () => request('/google/status'),
  googleDisconnect: () => request('/google/disconnect', { method: 'DELETE' }),

  // ai
  aiGenerateNote: (prompt) => request('/ai/generate-note', { method: 'POST', body: { prompt } }),
  aiImproveNote: (title, content, instruction) =>
    request('/ai/improve-note', { method: 'POST', body: { title, content, instruction } }),
  aiSummarize: (content) => request('/ai/summarize', { method: 'POST', body: { content } }),
  aiMeetingAgenda: (title, description) =>
    request('/ai/meeting-agenda', { method: 'POST', body: { title, description } }),
  aiWorkspaceInsights: (workspace_id, prompt) =>
    request('/ai/workspace-insights', { method: 'POST', body: { workspace_id, prompt } }),
  aiExtractTasks: (content) => request('/ai/extract-tasks', { method: 'POST', body: { content } }),
};
