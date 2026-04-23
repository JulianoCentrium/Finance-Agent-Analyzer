import { useState, useEffect } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, AlertTriangle, RotateCcw, Sparkles, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useGetOpenrouterSettings,
  useUpdateOpenrouterSettings,
  useClearOpenrouterSettings,
  useListFailedQuestions,
  useReviewFailedQuestion,
  useSuggestIntent,
  getListFailedQuestionsQueryKey,
  type FailedQuestionGroup,
  type IntentSuggestion,
} from "@workspace/api-client-react";
import { GraduationCap, CheckCircle2, EyeOff, Undo2, Wand2, Copy, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function callResetApi(profileId: number, scope: "transactions" | "full", token: string | null) {
  const res = await fetch(`${basePath}/api/profiles/${profileId}/data?scope=${scope}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

export default function SettingsPage() {
  const { activeProfileId } = useProfile();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [confirmScope, setConfirmScope] = useState<"transactions" | "full" | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!activeProfileId || !confirmScope) return;
    setLoading(true);
    try {
      const token = await getToken();
      await callResetApi(activeProfileId, confirmScope, token);
      qc.invalidateQueries();
      const label = confirmScope === "full" ? "Todos os dados foram apagados." : "Transações e lançamentos apagados.";
      toast({ title: "Dados reiniciados", description: label });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao reiniciar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      setConfirmScope(null);
    }
  };

  if (!activeProfileId) {
    return <p className="text-muted-foreground">Selecione um perfil.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie as configurações do seu perfil ativo.</p>
      </div>

      <OpenRouterCard />

      <FailedQuestionsCard profileId={activeProfileId} />

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Zona de Perigo
          </CardTitle>
          <CardDescription>
            Ações irreversíveis que afetam os dados do seu perfil. Não podem ser desfeitas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between p-4 rounded-lg border border-border bg-muted/30 gap-4">
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-yellow-500" />
                Reiniciar lançamentos financeiros
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Apaga todas as transações de cartão, faturas, contas a pagar e a receber.
                Mantém cartões, contas bancárias, categorias e pessoas.
              </p>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Transações de cartão</Badge>
                <Badge variant="outline" className="text-xs">Faturas</Badge>
                <Badge variant="outline" className="text-xs">A Pagar</Badge>
                <Badge variant="outline" className="text-xs">A Receber</Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 shrink-0"
              onClick={() => setConfirmScope("transactions")}
            >
              Reiniciar
            </Button>
          </div>

          <div className="flex items-start justify-between p-4 rounded-lg border border-destructive/40 bg-destructive/5 gap-4">
            <div>
              <p className="font-medium text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-destructive" />
                Apagar todos os dados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Remove absolutamente tudo do perfil: cartões, contas bancárias, pessoas, categorias e todos os lançamentos.
                O perfil em si é mantido.
              </p>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Badge variant="destructive" className="text-xs">Tudo acima</Badge>
                <Badge variant="destructive" className="text-xs">Cartões</Badge>
                <Badge variant="destructive" className="text-xs">Contas bancárias</Badge>
                <Badge variant="destructive" className="text-xs">Pessoas</Badge>
                <Badge variant="destructive" className="text-xs">Categorias</Badge>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => setConfirmScope("full")}
            >
              Apagar tudo
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmScope} onOpenChange={open => { if (!open) setConfirmScope(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmScope === "full" ? "Apagar todos os dados?" : "Reiniciar lançamentos?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmScope === "full"
                ? "Esta ação é irreversível. Todos os dados do perfil serão permanentemente removidos: cartões, contas bancárias, pessoas, categorias e todos os lançamentos financeiros."
                : "Esta ação é irreversível. Todas as transações de cartão, faturas, contas a pagar e a receber serão removidas. Cartões, contas bancárias, categorias e pessoas serão mantidos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={loading}
              className={confirmScope === "full" ? "bg-destructive hover:bg-destructive/90" : "bg-yellow-500 hover:bg-yellow-600 text-white"}
            >
              {loading ? "Apagando..." : confirmScope === "full" ? "Sim, apagar tudo" : "Sim, reiniciar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OpenRouterCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading, refetch } = useGetOpenrouterSettings();
  const updateMutation = useUpdateOpenrouterSettings();
  const clearMutation = useClearOpenrouterSettings();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (settings?.model) setModel(settings.model);
  }, [settings?.model]);

  const configured = settings?.configured ?? false;
  const masked = settings?.keyMasked ?? "";

  const handleSave = async () => {
    try {
      const body: { apiKey?: string; model?: string | null } = {};
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      body.model = model.trim() || null;
      await updateMutation.mutateAsync({ data: body });
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["/api/settings/openrouter"] });
      await refetch();
      toast({ title: "Configurações de IA salvas" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    }
  };

  const handleClear = async () => {
    if (!confirm("Remover a chave de API e desativar a IA?")) return;
    try {
      await clearMutation.mutateAsync();
      setApiKey("");
      setModel("");
      qc.invalidateQueries({ queryKey: ["/api/settings/openrouter"] });
      await refetch();
      toast({ title: "Chave removida" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Erro ao remover", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-5 h-5 text-purple-400" />
          Inteligência Artificial — OpenRouter
        </CardTitle>
        <CardDescription>
          Configure uma chave da OpenRouter para habilitar sugestão automática de categorias.
          Quando ausente, o sistema usa apenas regras aprendidas a partir das suas categorizações anteriores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            {configured && (
              <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/30 bg-green-500/5">
                <KeyRound className="w-4 h-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Chave configurada</p>
                  <p className="text-xs text-muted-foreground tabular-nums truncate">{masked}</p>
                </div>
                <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-500">ativa</Badge>
              </div>
            )}

            <div>
              <Label className="text-xs">Chave de API (sk-or-...)</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={configured ? "Deixe em branco para manter a chave atual" : "sk-or-v1-..."}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                A chave fica armazenada apenas no servidor e nunca é exibida em texto claro.
              </p>
            </div>

            <div>
              <Label className="text-xs">Modelo (opcional)</Label>
              <Input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="openai/gpt-4o-mini"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Padrão: openai/gpt-4o-mini. Veja modelos em openrouter.ai/models.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              {configured && (
                <Button variant="outline" size="sm" onClick={handleClear} disabled={clearMutation.isPending}>
                  Remover chave
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending || (!apiKey.trim() && !model.trim() && !configured)}
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FailedQuestionsCard({ profileId }: { profileId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [includeReviewed, setIncludeReviewed] = useState(false);
  const params = { profileId, limit: 50, includeReviewed };
  const { data, isLoading, error, refetch, isFetching } = useListFailedQuestions(
    params,
    { query: { staleTime: 30_000 } },
  );

  const reviewMutation = useReviewFailedQuestion();

  const groups = data ?? [];
  const openCount = groups.filter(g => (g.reviewStatus ?? "open") === "open").length;
  const reviewedCount = groups.length - openCount;

  const handleReview = async (g: FailedQuestionGroup, status: "resolved" | "ignored" | "open") => {
    try {
      await reviewMutation.mutateAsync({
        data: { profileId, normalized: g.normalized, status },
      });
      await qc.invalidateQueries({ queryKey: getListFailedQuestionsQueryKey(params).slice(0, 1) });
      await refetch();
      const label =
        status === "resolved"
          ? "Pergunta marcada como resolvida"
          : status === "ignored"
            ? "Pergunta ignorada"
            : "Pergunta restaurada";
      toast({ title: label });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Não foi possível atualizar", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="w-5 h-5 text-amber-400" />
          Aprendizado do Copiloto
        </CardTitle>
        <CardDescription>
          Perguntas recentes que o copiloto não conseguiu responder, agrupadas por similaridade.
          Marque um grupo como{" "}
          <span className="font-medium">resolvido</span> quando criar o intent correspondente, ou{" "}
          <span className="font-medium">ignorar</span> se for fora de escopo. Os grupos tratados somem
          do painel até você reexibi-los.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Carregando..."
              : includeReviewed
                ? `${groups.length} grupo(s) (${openCount} abertos, ${reviewedCount} tratados)`
                : `${groups.length} grupo(s) em aberto`}
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={includeReviewed}
                onCheckedChange={v => setIncludeReviewed(v === true)}
              />
              Mostrar resolvidos/ignorados
            </label>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive">
            Não foi possível carregar as perguntas falhas.
          </p>
        )}

        {!isLoading && groups.length === 0 && !error && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {includeReviewed
              ? "Nenhuma pergunta falha registrada por enquanto. Tudo certo por aqui!"
              : "Nenhuma pergunta em aberto. Marque a opção acima para ver itens já tratados."}
          </p>
        )}

        {groups.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
            {groups.map((g, i) => (
              <FailedQuestionRow
                key={`${g.normalized}-${i}`}
                group={g}
                onReview={handleReview}
                reviewPending={reviewMutation.isPending}
              />
            ))}
          </ul>
        )}

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            Como adicionar um novo intent?
          </summary>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Escolha uma pergunta recorrente acima e identifique seu padrão.</li>
            <li>
              Edite{" "}
              <code className="font-mono bg-muted px-1 rounded">
                artifacts/api-server/src/ai/known-intents.ts
              </code>{" "}
              e adicione um novo objeto ao array <code className="font-mono">INTENTS</code> com{" "}
              <code className="font-mono">name</code>, <code className="font-mono">patterns</code>{" "}
              (RegExp) e <code className="font-mono">build(profileId, match)</code> retornando o SQL.
            </li>
            <li>
              Sempre filtre por{" "}
              <code className="font-mono bg-muted px-1 rounded">profile_id = ${"{"}profileId{"}"}</code>{" "}
              em todas as tabelas (inclusive em JOINs) — o executor seguro rejeita o contrário.
            </li>
            <li>Escape aspas simples em valores extraídos do texto do usuário.</li>
            <li>Adicione um teste e rode o pipeline antes de publicar.</li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}

interface FailedQuestionRowProps {
  group: FailedQuestionGroup;
  onReview: (g: FailedQuestionGroup, status: "resolved" | "ignored" | "open") => void;
  reviewPending: boolean;
}

function FailedQuestionRow({ group, onReview, reviewPending }: FailedQuestionRowProps) {
  const { toast } = useToast();
  const suggestMutation = useSuggestIntent();
  const [suggestion, setSuggestion] = useState<IntentSuggestion | null>(null);
  const [copied, setCopied] = useState(false);

  const status = (group.reviewStatus ?? "open") as "open" | "resolved" | "ignored";
  const isReviewed = status !== "open";

  const handleSuggest = async () => {
    try {
      const result = await suggestMutation.mutateAsync({
        data: { question: group.sampleQuestion },
      });
      setSuggestion(result);
      setCopied(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Não foi possível sugerir", description: msg, variant: "destructive" });
    }
  };

  const handleCopy = async () => {
    if (!suggestion) return;
    try {
      await navigator.clipboard.writeText(suggestion.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Snippet copiado" });
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  return (
    <li className={`p-3 space-y-1 ${isReviewed ? "bg-muted/40 opacity-70" : "bg-muted/20"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug">"{group.sampleQuestion}"</p>
        <div className="flex items-center gap-1 shrink-0">
          {status === "resolved" && (
            <Badge className="text-[10px] bg-green-500/15 text-green-600 border border-green-500/30">
              Resolvido
            </Badge>
          )}
          {status === "ignored" && (
            <Badge className="text-[10px] bg-zinc-500/15 text-zinc-500 border border-zinc-500/30">
              Ignorado
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {group.occurrences}x
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-mono truncate">{group.normalized}</span>
        <span className="tabular-nums shrink-0 ml-2">
          {new Date(group.lastAttemptAt).toLocaleString("pt-BR")}
        </span>
      </div>
      {group.lastError && (
        <p className="text-[10px] text-muted-foreground italic truncate">
          Último erro: {group.lastError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={handleSuggest}
            disabled={suggestMutation.isPending}
          >
            <Wand2 className="w-3 h-3" />
            {suggestMutation.isPending ? "Gerando..." : suggestion ? "Gerar de novo" : "Sugerir intent"}
          </Button>
          {suggestion && (
            <Badge variant="outline" className="text-[10px]">
              {suggestion.source === "llm" ? "via IA" : "heurística"}
            </Badge>
          )}
          {suggestion && suggestion.matchedSample && (
            <Badge
              variant="outline"
              className="text-[10px] gap-1 border-green-500/40 text-green-600 bg-green-500/10"
              title="O servidor validou que este regex casa com a pergunta original"
            >
              <Check className="w-3 h-3" />
              regex confirmada
            </Badge>
          )}
          {suggestion && !suggestion.matchedSample && (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-500/40 text-amber-600 bg-amber-500/10"
              title="O regex sugerido não casou com a pergunta original — revise antes de salvar"
            >
              não validada
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isReviewed ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onReview(group, "open")}
              disabled={reviewPending}
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Reabrir
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs border-green-500/40 text-green-600 hover:bg-green-500/10"
                onClick={() => onReview(group, "resolved")}
                disabled={reviewPending}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Resolvido
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => onReview(group, "ignored")}
                disabled={reviewPending}
              >
                <EyeOff className="w-3 h-3 mr-1" />
                Ignorar
              </Button>
            </>
          )}
        </div>
      </div>
      {suggestion && (
        <div className="mt-2 rounded-md border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-muted-foreground">name:</span>
              <span className="font-medium">{suggestion.intentName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <pre className="text-[10px] font-mono p-2 overflow-x-auto whitespace-pre leading-snug">
{suggestion.snippet}
          </pre>
          <p className="text-[10px] text-muted-foreground px-2 pb-2">
            Cole em <code className="font-mono bg-muted px-1 rounded">artifacts/api-server/src/ai/known-intents.ts</code>{" "}
            dentro do array <code className="font-mono">INTENTS</code> e implemente o SQL.
          </p>
        </div>
      )}
    </li>
  );
}
