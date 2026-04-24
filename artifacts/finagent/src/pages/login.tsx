import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSetupInfo, setShowSetupInfo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Falha ao fazer login");
        return;
      }

      const data = await response.json();
      login(data.token, data.user);
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
            <CardTitle className="text-white">Login</CardTitle>
            <CardDescription className="text-slate-400">Entre com sua conta para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
                  {error}
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

              <Button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? "Conectando..." : "Entrar"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-slate-800 text-slate-400">Novo por aqui?</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-600 text-slate-200 hover:bg-slate-700"
                onClick={() => setLocation("/register")}
                disabled={isLoading}
              >
                Criar conta
              </Button>
            </form>

            <div className="mt-6 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <button
                type="button"
                onClick={() => setShowSetupInfo(!showSetupInfo)}
                className="text-blue-300 text-sm font-medium hover:text-blue-200 w-full text-left"
              >
                {showSetupInfo ? "▼ " : "▶ "}Primeira vez aqui?
              </button>
              {showSetupInfo && (
                <p className="text-sm text-slate-300 mt-2">
                  Na sua primeira vez, você pode se registrar e se tornará automaticamente o administrador.
                  Depois poderá convidar outros usuários.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-500">
          © 2026 Co-Finance. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
