import { useEffect, useState } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileProvider, useProfile } from "./contexts/ProfileContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

setBaseUrl(basePath || null);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function HomeRedirect() {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <Redirect to="/dashboard" />;
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
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return <ProtectedRouteInner component={Component} />;
}

function AppRoutes() {
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      setAuthTokenGetter(async () => token);
    }
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ProfileProvider>
          <TooltipProvider>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/login" component={LoginPage} />
              <Route path="/register" component={RegisterPage} />
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
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;
