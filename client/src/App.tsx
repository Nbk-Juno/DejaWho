import { Switch, Route, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle } from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { IosInstallBanner } from "@/components/ios-install-banner";
import Home from "@/pages/home";
import Record from "@/pages/record";
import SearchPage from "@/pages/search";
import SignIn from "@/pages/sign-in";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/record" component={Record} />
      <Route path="/search" component={SearchPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => signOut()}
      data-testid="button-sign-out"
      title="Sign out"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  );
}

function InviteOnlyScreen() {
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Invite only</h1>
          <p className="text-muted-foreground">
            <strong>{user?.email}</strong> isn't on the invite list yet. Reach out to the
            operator to request access.
          </p>
        </div>
        <Button onClick={() => signOut()} data-testid="button-back-to-sign-in">
          Sign out
        </Button>
      </div>
    </div>
  );
}

function AuthenticatedShell() {
  const { data, isLoading, error } = useQuery<{ id: string; email: string }>({
    queryKey: ["/api/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("403")) {
      return <InviteOnlyScreen />;
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 text-center">
        <div className="space-y-4">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
          <p className="text-muted-foreground">Couldn't reach the server. Try again in a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-50 flex items-center gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
      <Router />
      <IosInstallBanner />
    </div>
  );
}

function AppContent() {
  const { session, loading } = useAuth();
  const [location] = useLocation();

  if (location === "/reset-password") {
    return (
      <div className="relative min-h-screen">
        <div className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-50">
          <ThemeToggle />
        </div>
        <ResetPassword />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-50">
          <ThemeToggle />
        </div>
        <SignIn />
      </div>
    );
  }

  return <AuthenticatedShell />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="dejawho-theme">
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
