import { useAuthStore } from "@/store/authStore";

function normalizeApiBaseUrl(value?: string) {
  const fallback = "http://localhost:4000/api";
  const rawValue = value?.trim() || fallback;
  const appOrigin = typeof window === "undefined" ? "http://localhost" : window.location.origin;

  try {
    const url = new URL(rawValue, appOrigin);
    url.pathname = url.pathname.replace(/\/+$/, "");

    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/api";
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return rawValue.replace(/\/+$/, "");
  }
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

type Primitive = string | number | boolean | null | undefined;

type RequestOptions = {
  params?: Record<string, Primitive>;
  headers?: Record<string, string>;
  _retry?: boolean;
};

export type ApiSuccessResponse<T> = {
  data: T;
};

export class ApiError<T = { message?: string }> extends Error {
  response?: {
    status: number;
    data?: T;
  };
  config?: RequestOptions & { url: string; method: string; body?: unknown };

  constructor(message: string, status?: number, data?: T) {
    super(message);
    this.name = "ApiError";
    if (status) {
      this.response = { status, data };
    }
  }
}

function buildUrl(path: string, params?: Record<string, Primitive>) {
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(normalizedPath, `${API_BASE_URL}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

function processQueue(error: unknown, token?: string) {
  failedQueue.forEach((promise) => {
    if (error || !token) {
      promise.reject(error);
      return;
    }

    promise.resolve(token);
  });

  failedQueue = [];
}

async function refreshAccessToken() {
  const response = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new ApiError(
      (payload as { message?: string } | undefined)?.message || "Failed to refresh access token",
      response.status,
      payload as { message?: string } | undefined
    );
  }

  const newToken = (payload as { data?: { accessToken?: string } } | undefined)?.data?.accessToken;
  if (!newToken) {
    throw new ApiError("Refresh response did not include access token", response.status);
  }

  useAuthStore.getState().setAccessToken(newToken);
  return newToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ApiSuccessResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = useAuthStore.getState().accessToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, options.params), {
    method,
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await parseJson(response);

  if (response.status === 401 && !options._retry && path !== "/auth/refresh") {
    if (isRefreshing) {
      const queuedToken = await new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });

      return request<T>(method, path, body, {
        ...options,
        _retry: true,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${queuedToken}`,
        },
      });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);

      return request<T>(method, path, body, {
        ...options,
        _retry: true,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    } catch (error) {
      processQueue(error);
      useAuthStore.getState().logout();
      throw error;
    } finally {
      isRefreshing = false;
    }
  }

  if (!response.ok) {
    const message =
      (payload as { message?: string } | undefined)?.message ||
      `Request failed with status ${response.status}`;
    const error = new ApiError(message, response.status, payload as { message?: string } | undefined);
    error.config = { ...options, url: path, method, body };
    throw error;
  }

  return {
    data: payload as T,
  };
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>("POST", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>("PATCH", path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions) {
    return request<T>("DELETE", path, undefined, options);
  },
};
