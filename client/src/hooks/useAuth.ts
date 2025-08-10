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
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
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