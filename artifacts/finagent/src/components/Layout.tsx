import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useProfile } from "../contexts/ProfileContext";
import {
  LayoutDashboard,
  CreditCard,
  Landmark,
  TrendingDown,
  TrendingUp,
  Users,
  Tags,
  BarChart3,
  Menu,
  X,
  Bot,
  Sun,
  Moon,
  ChevronDown,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useListProfiles } from "@workspace/api-client-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/credit-cards", label: "Cartões", icon: CreditCard },
  { href: "/bank-accounts", label: "Contas", icon: Landmark },
  { href: "/accounts-payable", label: "A Pagar", icon: TrendingDown },
  { href: "/accounts-receivable", label: "A Receber", icon: TrendingUp },
  { href: "/persons", label: "Pessoas", icon: Users },
  { href: "/categories", label: "Categorias", icon: Tags },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/ai-copilot", label: "Copiloto IA", icon: Bot },
  { href: "/settings", label: "Configurações", icon: Settings },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { activeProfileId, setActiveProfileId } = useProfile();

  const { data: profiles } = useListProfiles({ query: { enabled: !!user } });
  const activeProfile = profiles?.find(p => p.id === activeProfileId);

  const isDark = theme.includes("dark");
  const isBlue = theme.includes("blue");

  const toggleDark = () => {
    if (theme === "theme-dark-blue") setTheme("theme-light-blue");
    else if (theme === "theme-dark-green") setTheme("theme-light-green");
    else if (theme === "theme-light-blue") setTheme("theme-dark-blue");
    else setTheme("theme-dark-green");
  };

  const toggleColor = () => {
    if (isDark) setTheme(isBlue ? "theme-dark-green" : "theme-dark-blue");
    else setTheme(isBlue ? "theme-light-green" : "theme-light-blue");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Logo */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground">CO-Finance</span>
          </div>
          <button
            className="lg:hidden text-sidebar-foreground hover:text-sidebar-primary"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile selector */}
        {profiles && profiles.length > 0 && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground text-sm">
                  <div className="w-6 h-6 rounded-full bg-sidebar-primary flex items-center justify-center text-xs text-sidebar-primary-foreground font-bold">
                    {activeProfile?.name?.[0] ?? "?"}
                  </div>
                  <span className="truncate font-medium">{activeProfile?.name ?? "Selecionar"}</span>
                  <ChevronDown className="w-3 h-3 ml-auto shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuRadioGroup
                  value={String(activeProfileId)}
                  onValueChange={v => setActiveProfileId(Number(v))}
                >
                  {profiles.filter(p => p.status !== "archived").map(p => (
                    <DropdownMenuRadioItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profiles")}>
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  Gerenciar perfis
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location === href || location.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                      ${active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom user area */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={logout}
                className="px-2 py-1 text-xs rounded hover:bg-sidebar-accent transition-colors"
                title="Logout"
              >
                Sair
              </button>
              <span className="text-sm text-sidebar-foreground truncate max-w-28">
                {user?.email ?? ""}
              </span>
            </div>
            <button
              onClick={toggleDark}
              className="text-sidebar-foreground hover:text-sidebar-primary transition-colors"
              title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sidebar-foreground/60">Cor:</span>
            <button
              onClick={toggleColor}
              className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border border-sidebar-border hover:border-sidebar-primary transition-all"
              title={isBlue ? "Mudar para tema verde" : "Mudar para tema azul"}
            >
              <span className={`w-3 h-3 rounded-full ${isBlue ? "bg-blue-500" : "bg-blue-300 opacity-40"}`} />
              <span className="text-sidebar-foreground/70">Azul</span>
            </button>
            <button
              onClick={toggleColor}
              className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border border-sidebar-border hover:border-sidebar-primary transition-all"
              title={isBlue ? "Mudar para tema verde" : "Mudar para tema azul"}
            >
              <span className={`w-3 h-3 rounded-full ${!isBlue ? "bg-green-500" : "bg-green-300 opacity-40"}`} />
              <span className="text-sidebar-foreground/70">Verde</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-border bg-background shrink-0">
          <button
            className="text-foreground hover:text-primary transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-bold text-foreground">CO-Finance</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
