import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  isAuthorized: boolean;
}

interface AuthStatus {
  authenticated: boolean;
  user: User | null;
}

export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/status'],
    retry: 1, // Retry once on failure
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: true, // Always check on mount
  });

  const logout = () => {
    window.location.href = '/auth/logout';
  };

  return {
    user: data?.user || null,
    isLoading,
    isAuthenticated: data?.authenticated || false,
    isAuthorized: data?.user?.isAuthorized || false,
    error,
    refetch,
    logout,
  };
}