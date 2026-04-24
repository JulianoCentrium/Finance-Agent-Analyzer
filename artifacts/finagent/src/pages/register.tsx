import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);

  // Check if setup is required (no users exist)
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch("/api/auth/setup");
        const data = await response.json();
        setSetupRequired(data.setupRequired);
        // If not first user and setup is required, redirect to login
        if (!data.setupRequired && setLocation) {
          // Already has users, so registration might not be allowed
        }
      } catch (err) {
        console.error("Failed to check setup:", err);
      }
    };
    checkSetup();
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedPasswordConfirm = passwordConfirm.trim();

    // Validation
    if (normalizedPassword !== normalizedPasswordConfirm) {
      setError("As senhas não conferem");
      return;
    }

    if (normalizedPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Falha ao criar conta");
        return;
      }

      const data = await response.json();
      setIsFirstUser(data.isFirstUser);
      login(data.token, data.user);

      // Onboarding is handled inside protected routes based on profile state.
      setLocation("/dashboard");
    } catch (err) {
      setError("Erro ao conectar com o servidor");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-white">Co-Finance</h1>
          <p className="text-slate-400">Agente de Finanças Inteligente</p>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Criar Conta</CardTitle>
            <CardDescription className="text-slate-400">
              {setupRequired 
                ? "Primeira vez? Crie sua conta de administrador" 
                : "Junte-se ao Co-Finance"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
                  {error}
                </div>
              )}

              {setupRequired && (
                <div className="p-3 bg-amber-900/30 border border-amber-700 rounded-lg text-sm text-amber-200">
                  Você é o primeiro usuário. Ao se registrar, se tornará automaticamente o administrador.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Senha</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Confirmar Senha</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email || !password || !passwordConfirm}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? "Criando conta..." : "Criar Conta"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-slate-800 text-slate-400">Já tem conta?</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-600 text-slate-200 hover:bg-slate-700"
                onClick={() => setLocation("/login")}
                disabled={isLoading}
              >
                Fazer Login
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-500">
          © 2026 Co-Finance. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
