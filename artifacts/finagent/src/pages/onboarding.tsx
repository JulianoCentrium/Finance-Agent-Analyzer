import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";

export default function OnboardingPage() {
  const { createProfile, isCreating } = useProfile();
  const [name, setName] = useState("Família");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("O nome do perfil não pode ser vazio.");
      return;
    }
    try {
      await createProfile(trimmed);
    } catch {
      setError("Não foi possível criar o perfil. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-primary-foreground">
                <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
              </svg>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">CO-Finance</h1>
          </div>
          <h2 className="text-2xl font-semibold">Bem-vindo!</h2>
          <p className="text-muted-foreground text-base">
            Vamos criar seu primeiro perfil financeiro.<br />
            Você pode usar um nome como <strong>Família</strong>, <strong>Pessoal</strong> ou qualquer outro.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="profile-name" className="text-sm font-medium text-foreground">
              Nome do perfil
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              placeholder="Ex: Família Silva, Pessoal..."
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              autoFocus
              disabled={isCreating}
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Criando perfil...
              </>
            ) : (
              "Criar perfil e começar"
            )}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Você pode criar múltiplos perfis depois (ex: pessoal + familiar).
          </p>
        </form>
      </div>
    </div>
  );
}
