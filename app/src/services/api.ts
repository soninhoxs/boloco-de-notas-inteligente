const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE}/auth/csrf`, {
    ...fetchDefaults,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'failed to fetch csrf token');
  }
  const data = await response.json();
  csrfToken = data.csrf_token as string;
  return csrfToken;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface AuthResponse {
  user?: User;
  tokens?: TokenPair;
  mfa_required?: boolean;
  mfa_token?: string;
  email_verification_required?: boolean;
  verification_token?: string;
  verify_url?: string;
  message?: string;
}

type RegisterResponse = AuthResponse & { user: User };

interface User {
  id: string;
  email: string;
  display_name: string;
  email_verified?: boolean;
  pending_email?: string;
  mfa_enabled?: boolean;
  ai_consent_granted?: boolean;
  ai_consent_at?: string;
  settings: UserSettings;
  created_at: string;
  updated_at: string;
}

interface UserSettings {
  theme: string;
  language: string;
  ai_enabled: boolean;
  ai_provider: string;
  ai_model?: string;
  preferences?: Record<string, unknown>;
}

interface NoteMetadata {
  attachments?: Array<{
    id: string;
    name: string;
    kind: string;
    file_key?: string;
    url?: string;
  }>;
  ai_provider?: string;
  ai_model?: string;
}

interface Note {
  id: string;
  user_id: string;
  content: string;
  category: 'idea' | 'task' | 'reflection' | 'gratitude' | 'reminder';
  location?: {
    latitude: number;
    longitude: number;
    state: string;
    city: string;
    label?: string;
    task?: string;
  };
  metadata?: NoteMetadata;
  ai_suggestions?: Array<{
    type: string;
    content: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface NotesPage {
  notes: Note[];
  next_cursor?: string;
  has_more: boolean;
  total: number;
}

interface AIJob {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
}

interface AIJobResult {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  suggestions?: Array<{
    type: string;
    content: string;
  }>;
  error?: string;
  processed_at?: string;
}

class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const fetchDefaults: RequestInit = {
  credentials: 'include',
};

async function tryRefreshSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      ...fetchDefaults,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authenticated = true,
  needsCsrf = true
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const method = (options.method || 'GET').toUpperCase();
  const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  const csrfHeaders: Record<string, string> = {};
  if (isMutating && needsCsrf) {
    const token = await ensureCsrfToken();
    csrfHeaders['X-CSRF-Token'] = token;
  }

  const buildInit = (): RequestInit => ({
    ...fetchDefaults,
    ...options,
    headers: isFormData
      ? { ...csrfHeaders, ...options.headers }
      : {
          'Content-Type': 'application/json',
          ...csrfHeaders,
          ...options.headers,
        },
  });

  let response = await fetch(`${API_BASE}${endpoint}`, buildInit());

  if (authenticated && response.status === 401) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await fetch(`${API_BASE}${endpoint}`, buildInit());
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.error || 'Request failed', error);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  initCsrf: () => ensureCsrfToken(),

  auth: {
    register: async (
      email: string,
      password: string,
      displayName: string,
      consent?: {
        consent_version: string;
        consent_privacy: boolean;
        consent_terms: boolean;
      }
    ): Promise<RegisterResponse> =>
      apiRequest<RegisterResponse>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            display_name: displayName,
            consent_version: consent?.consent_version,
            consent_privacy: consent?.consent_privacy,
            consent_terms: consent?.consent_terms,
          }),
        },
        false,
        true
      ),

    login: async (email: string, password: string): Promise<AuthResponse> =>
      apiRequest<AuthResponse>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
        false,
        true
      ),

    mfaLogin: async (mfaToken: string, code: string): Promise<AuthResponse> =>
      apiRequest<AuthResponse>(
        '/auth/mfa/login',
        {
          method: 'POST',
          body: JSON.stringify({ mfa_token: mfaToken, code }),
        },
        false,
        true
      ),

    verifyEmail: async (token: string): Promise<{ message: string }> =>
      fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, {
        credentials: 'include',
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new ApiError(r.status, data.error || 'verification failed');
        return data;
      }),

    verifyEmailChange: async (token: string): Promise<{ message: string }> =>
      fetch(`${API_BASE}/auth/verify-email-change?token=${encodeURIComponent(token)}`, {
        credentials: 'include',
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new ApiError(r.status, data.error || 'verification failed');
        return data;
      }),

    resendVerification: async (email: string): Promise<{ message: string; verification_token?: string; verify_url?: string }> =>
      apiRequest('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }, false, true),

    recordAIConsent: async (consentVersion: string): Promise<void> => {
      await apiRequest('/auth/ai-consent', {
        method: 'POST',
        body: JSON.stringify({ consent_version: consentVersion, consent_ai: true }),
      });
    },

    mfaSetup: (): Promise<{ secret: string; otpauth_url: string }> =>
      apiRequest('/auth/mfa/setup', { method: 'POST', body: '{}' }),

    mfaEnable: (code: string): Promise<void> =>
      apiRequest('/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    mfaDisable: (code: string, password?: string): Promise<void> =>
      apiRequest('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code, password }),
      }),

    logout: async (): Promise<void> => {
      try {
        await apiRequest('/auth/logout', { method: 'POST', body: '{}' });
      } catch {
        // limpa cookies no servidor quando possível
      } finally {
        csrfToken = null;
      }
    },

    exchangeOAuthCode: async (code: string): Promise<void> => {
      await apiRequest('/auth/oauth/exchange', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }, false, true);
    },
  },

  users: {
    getProfile: (): Promise<User> => apiRequest('/users/me'),

    updateProfile: (data: { display_name?: string }): Promise<User> =>
      apiRequest('/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    requestEmailChange: (email: string): Promise<{ message: string; verification_token?: string; verify_url?: string }> =>
      apiRequest('/users/me/email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    updateSettings: (settings: Partial<UserSettings>): Promise<User> =>
      apiRequest('/users/me/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),

    exportData: async (): Promise<Blob> => {
      await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/users/me/export`, {
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken || '' },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.error || 'export failed');
      }
      return response.blob();
    },

    deleteAccount: (): Promise<void> =>
      apiRequest('/users/me', { method: 'DELETE' }),
  },

  notes: {
    list: (params?: { cursor?: string; limit?: number; category?: string; search?: string }): Promise<NotesPage> => {
      const searchParams = new URLSearchParams();
      if (params?.cursor) searchParams.set('cursor', params.cursor);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.category) searchParams.set('category', params.category);
      if (params?.search) searchParams.set('search', params.search);

      const query = searchParams.toString();
      return apiRequest(`/notes${query ? `?${query}` : ''}`);
    },

    create: (data: {
      content: string;
      category: string;
      location?: Note['location'];
      metadata?: Note['metadata'];
    }): Promise<Note> =>
      apiRequest('/notes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string): Promise<Note> => apiRequest(`/notes/${id}`),

    update: (
      id: string,
      data: {
        content?: string;
        category?: string;
        location?: Note['location'];
        metadata?: Note['metadata'];
      }
    ): Promise<Note> =>
      apiRequest(`/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string): Promise<void> =>
      apiRequest(`/notes/${id}`, { method: 'DELETE' }),

    search: (query: string, limit?: number): Promise<{ notes: Note[] }> => {
      const params = new URLSearchParams({ q: query });
      if (limit) params.set('limit', String(limit));
      return apiRequest(`/notes/search?${params}`);
    },

    stats: (): Promise<{
      total_notes: number;
      by_category: Record<string, number>;
      this_week: number;
      this_month: number;
      ai_requests: number;
      last_note_at?: string;
    }> => apiRequest('/notes/stats'),
  },

  ai: {
    requestSuggestions: (noteId: string, provider?: string, model?: string): Promise<AIJob> =>
      apiRequest('/ai/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          note_id: noteId,
          ...(provider && { provider }),
          ...(model && { model }),
        }),
      }),

    getJobStatus: (jobId: string): Promise<AIJob> => apiRequest(`/ai/jobs/${jobId}`),

    getJobResult: (jobId: string): Promise<AIJobResult> => apiRequest(`/ai/jobs/${jobId}/result`),

    pollForResult: async (jobId: string, maxAttempts = 30, intervalMs = 2000): Promise<AIJobResult> => {
      for (let i = 0; i < maxAttempts; i++) {
        const result = await api.ai.getJobResult(jobId);
        if (result.status === 'completed' || result.status === 'failed') {
          return result;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      throw new ApiError(408, 'Timeout waiting for AI suggestions');
    },
  },

  storage: {
    upload: async (file: File): Promise<{ key: string; url: string; size: number; mime_type: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      await ensureCsrfToken();

      let response = await fetch(`${API_BASE}/storage/upload`, {
        ...fetchDefaults,
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
        body: formData,
      });

      if (response.status === 401) {
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          response = await fetch(`${API_BASE}/storage/upload`, {
            ...fetchDefaults,
            method: 'POST',
            body: formData,
          });
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.error || 'Upload failed');
      }

      return response.json();
    },

    getUploadUrl: (filename: string): Promise<{ upload_url: string; key: string; expires_in: number }> =>
      apiRequest('/storage/upload-url', {
        method: 'POST',
        body: JSON.stringify({ filename }),
      }),

    getDownloadUrl: (key: string): Promise<{ download_url: string; expires_in: number }> =>
      apiRequest(`/storage/download-url?key=${encodeURIComponent(key)}`),

    delete: (key: string): Promise<void> =>
      apiRequest(`/storage/?key=${encodeURIComponent(key)}`, { method: 'DELETE' }),
  },
};

export { ApiError };
export type { User, UserSettings, Note, NotesPage, AIJob, AIJobResult, TokenPair, AuthResponse, RegisterResponse, NoteMetadata };
