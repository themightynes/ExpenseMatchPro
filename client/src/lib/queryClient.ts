import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Enhanced error handling for authentication issues
    if (res.status === 401) {
      throw new Error(`Authentication required: ${res.status}: ${text}`);
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

// Helper to get Clerk token from window.__clerk (available after ClerkProvider mounts)
async function getClerkToken(): Promise<string | null> {
  try {
    // Access Clerk's session via the global window object
    const clerk = (window as any).__clerk;
    if (clerk?.session) {
      return await clerk.session.getToken();
    }
  } catch (error) {
    console.warn('Failed to get Clerk token:', error);
  }
  return null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Don't send body for GET/HEAD requests
  const isGetOrHead = method === "GET" || method === "HEAD";

  // Get Clerk authentication token
  const token = await getClerkToken();

  const headers: Record<string, string> = {};
  if (data && !isGetOrHead) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data && !isGetOrHead ? JSON.stringify(data) : undefined,
    credentials: "include",
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
    // Get Clerk authentication token
    const token = await getClerkToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

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
