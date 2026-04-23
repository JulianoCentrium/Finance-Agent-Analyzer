import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider, useProfile } from "./contexts/ProfileContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";

import NotFound from "@/pages/not-found";
import OnboardingPage from "@/pages/onboarding";
import ProfileSelectPage from "@/pages/profile-select";
import DashboardPage from "@/pages/dashboard";
import CreditCardsPage from "@/pages/credit-cards";
import BankAccountsPage from "@/pages/bank-accounts";
import AccountsPayablePage from "@/pages/accounts-payable";
import AccountsReceivablePage from "@/pages/accounts-receivable";
import PersonsPage from "@/pages/persons";
import CategoriesPage from "@/pages/categories";
import ReportsPage from "@/pages/reports";
import AiCopilotPage from "@/pages/ai-copilot";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// The generated API client already includes /api prefix in all paths (from OpenAPI spec servers.url).
// setBaseUrl should only be used when the API is at a different origin (e.g. mobile apps).
// For web, the Replit proxy routes /api/* directly to the API server.
setBaseUrl(basePath || null);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ApiTokenSetter() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(async () => {
      return (await getToken()) ?? null;
    });
  }, [getToken]);
  return null;
}

function ProtectedRouteInner({ component: Component }: { component: React.ComponentType }) {
  const { needsOnboarding, needsProfileSelection, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando...
        </div>
      </div>
    );
  }

  if (needsOnboarding) return <OnboardingPage />;
  if (needsProfileSelection) return <ProfileSelectPage />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <ProtectedRouteInner component={Component} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ApiTokenSetter />
        <ThemeProvider>
          <ProfileProvider>
            <TooltipProvider>
              <Switch>
                <Route path="/" component={HomeRedirect} />
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
                <Route path="/credit-cards"><ProtectedRoute component={CreditCardsPage} /></Route>
                <Route path="/bank-accounts"><ProtectedRoute component={BankAccountsPage} /></Route>
                <Route path="/accounts-payable"><ProtectedRoute component={AccountsPayablePage} /></Route>
                <Route path="/accounts-receivable"><ProtectedRoute component={AccountsReceivablePage} /></Route>
                <Route path="/persons"><ProtectedRoute component={PersonsPage} /></Route>
                <Route path="/categories"><ProtectedRoute component={CategoriesPage} /></Route>
                <Route path="/reports"><ProtectedRoute component={ReportsPage} /></Route>
                <Route path="/ai-copilot"><ProtectedRoute component={AiCopilotPage} /></Route>
                <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
                <Route path="/profiles"><ProtectedRoute component={ProfileSelectPage} /></Route>
                <Route component={NotFound} />
              </Switch>
              <Toaster />
            </TooltipProvider>
          </ProfileProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
