import { useQuery } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/clerk-react";

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
  const { signOut } = useClerk();

  // Query our backend to get authorization status and synced user data
  const { data, isLoading: queryLoading, error, refetch } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/status'],
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

  return {
    user: data?.user || null,
    isLoading,
    isAuthenticated: clerkLoaded && isSignedIn && data?.authenticated || false,
    isAuthorized: data?.user?.isAuthorized || false,
    error,
    refetch,
    logout,
  };
}