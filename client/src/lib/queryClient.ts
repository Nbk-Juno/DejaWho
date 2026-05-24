import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;
  const text = (await res.text()) || res.statusText;
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // not JSON — keep raw text as the message
  }
  const message = parsed?.error || parsed?.message || text;
  throw new ApiError(message, res.status, parsed?.code, parsed);
}

function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = { ...(await authHeaders()) };
  const isFormData = data instanceof FormData;
  if (data !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(apiUrl(url), {
    method,
    headers,
    body: data === undefined ? undefined : isFormData ? data : JSON.stringify(data),
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = await authHeaders();
    const res = await fetch(apiUrl(queryKey.join("/") as string), { headers });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
