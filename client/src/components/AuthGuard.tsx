import { useAuth } from "@/hooks/useAuth";
import { SignIn, UserButton, useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isAuthorized, isLoading, user } = useAuth();
  const { user: clerkUser } = useUser();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show Clerk sign in
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="flex flex-col items-center gap-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
              <CardDescription>
                Sign in to access your expense management dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <SignIn routing="hash" signUpUrl="#" />
            </CardContent>
          </Card>

          <div className="w-full max-w-md p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
              <strong>Note:</strong> Only authorized users can access this system.
              Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated but not authorized
  if (isAuthenticated && !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md border-red-200 dark:border-red-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-400">
              Access Denied
            </CardTitle>
            <CardDescription>
              Your account is not authorized to access this system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>Email:</strong> {clerkUser?.primaryEmailAddress?.emailAddress || user?.email}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                Contact your administrator to request access to the expense management system.
              </p>
            </div>
            <div className="flex justify-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated and authorized - show the app
  return <>{children}</>;
}