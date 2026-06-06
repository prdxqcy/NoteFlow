const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

export const api = {
  // auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  saveOneSignalId: (player_id) => request('/auth/onesignal', { method: 'PATCH', body: { player_id } }),

  // workspaces
  getWorkspaces: () => request('/workspaces'),
  createWorkspace: (body) => request('/workspaces', { method: 'POST', body }),
  deleteWorkspace: (id) => request(`/workspaces/${id}`, { method: 'DELETE' }),
  inviteMember: (id, email) => request(`/workspaces/${id}/invite`, { method: 'POST', body: { email } }),
  getMembers: (id) => request(`/workspaces/${id}/members`),
  getInvitation: (token) => request(`/invitations/${token}`),

  // notes
  getNotes: (workspaceId) => request(`/notes/workspace/${workspaceId}`),
  createNote: (body) => request('/notes', { method: 'POST', body }),
  updateNote: (id, body) => request(`/notes/${id}`, { method: 'PATCH', body }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

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
};
