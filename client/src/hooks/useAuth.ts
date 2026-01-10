import { useQuery } from "@tanstack/react-query";
import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";

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
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut, getToken } = useClerkAuth();

  // Query our backend to get authorization status and synced user data
  const { data, isLoading: queryLoading, error, refetch } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/status'],
    queryFn: async () => {
      // Get Clerk session token to authenticate the request
      const token = await getToken();

      console.log('[useAuth] Fetching auth status with token:', token ? 'Token exists' : 'NO TOKEN');

      const res = await fetch('/api/auth/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      console.log('[useAuth] Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[useAuth] Auth status check failed:', res.status, errorText);
        throw new Error(`Auth status check failed: ${res.status}: ${errorText}`);
      }

      const responseData = await res.json();
      console.log('[useAuth] Auth response:', responseData);
      return responseData;
    },
    retry: 1,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: clerkLoaded && isSignedIn, // Only fetch if Clerk is loaded and user is signed in
  });

  const logout = async () => {
    await signOut();
    window.location.href = '/';
  };

  // Combine Clerk loading state with our backend query loading
  const isLoading = !clerkLoaded || (isSignedIn && queryLoading);

  const authStatus = {
    user: data?.user || null,
    isLoading,
    isAuthenticated: clerkLoaded && isSignedIn && data?.authenticated === true,
    isAuthorized: data?.user?.isAuthorized === true,
    error,
    refetch,
    logout,
  };

  console.log('[useAuth] State:', {
    clerkLoaded,
    isSignedIn,
    queryLoading,
    hasData: !!data,
    dataAuthenticated: data?.authenticated,
    dataUser: data?.user,
    userAuthorized: data?.user?.isAuthorized,
    resultIsAuthenticated: authStatus.isAuthenticated,
    resultIsAuthorized: authStatus.isAuthorized,
    error: error?.message
  });

  return authStatus;
}