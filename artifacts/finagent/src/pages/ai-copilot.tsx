import { useState, useRef, useEffect } from "react";
// Auth token is stored in localStorage
import { useProfile } from "../contexts/ProfileContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, SendHorizonal, User, Sparkles, ChevronDown, ChevronRight, Code2 } from "lucide-react";

type Row = Record<string, unknown>;

interface Message {
  role: "user" | "assistant";
  content: string;
  rows?: Row[];
  sql?: string;
}

const SUGGESTIONS = [
  "Qual meu saldo?",
  "Quanto gastei este mês?",
  "Próximas parcelas?",
  "Total por categoria?",
  "Quanto vou pagar no próximo mês?",
];

const MONETARY_COLUMN_PATTERN = /(valor|saldo|total|preco|preço|amount|montante|gasto|receita|despesa|limite)/i;
const DATE_COLUMN_PATTERN = /(data|date|vencimento|criado|atualizado|created|updated)/i;
const DEV_MODE_KEY = "finagent.copilot.devMode";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCellValue(columnName: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";

  if (MONETARY_COLUMN_PATTERN.test(columnName)) {
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isNaN(num)) return brlFormatter.format(num);
  }

  if (DATE_COLUMN_PATTERN.test(columnName) && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR");
    }
  }

  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ResultTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const columns = Object.keys(rows[0]);

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Ver dados ({rows.length} {rows.length === 1 ? "linha" : "linhas"})
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded-md border border-border bg-background/50">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {columns.map(col => (
                  <th key={col} className="text-left font-medium px-2 py-1.5 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border/60">
                  {columns.map(col => (
                    <td key={col} className="px-2 py-1.5 whitespace-nowrap">
                      {formatCellValue(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border-t border-dashed border-border/60 pt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Code2 className="w-3 h-3" />
        {open ? "Ocultar SQL" : "Ver SQL (developer)"}
      </button>
      {open && (
        <pre className="mt-2 p-2 rounded-md bg-muted/60 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
          {sql}
        </pre>
      )}
    </div>
  );
}

export default function AiCopilotPage() {
  const { activeProfileId } = useProfile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDevMode(localStorage.getItem(DEV_MODE_KEY) === "true");
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleDevMode = () => {
    setDevMode(prev => {
      const next = !prev;
      localStorage.setItem(DEV_MODE_KEY, String(next));
      return next;
    });
  };

  // Token is stored in localStorage during login

  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeProfileId) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ profileId: activeProfileId, messages: [...messages, userMsg], devMode }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply ?? "Desculpe, não consegui responder.",
        rows: Array.isArray(data.rows) ? data.rows : undefined,
        sql: typeof data.sql === "string" ? data.sql : undefined,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Erro ao conectar com o copiloto. Verifique se a integração com OpenRouter está configurada.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Copiloto IA</h1>
          <p className="text-sm text-muted-foreground">Converse com sua inteligência financeira pessoal</p>
        </div>
        <button
          type="button"
          onClick={toggleDevMode}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            devMode
              ? "bg-primary/10 border-primary/40 text-primary"
              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}
          title="Mostrar a consulta SQL usada para responder"
        >
          Modo developer {devMode ? "ativo" : "off"}
        </button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-8">
              <Bot className="w-16 h-16 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm text-center max-w-xs">
                Olá! Sou seu copiloto financeiro. Posso ajudar a analisar seus gastos, listar contas e muito mais.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    className="text-xs bg-secondary hover:bg-accent text-secondary-foreground px-3 py-1.5 rounded-full transition-colors"
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap
                      ${msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-card border border-border rounded-bl-none"
                      }`}
                  >
                    <div>{msg.content}</div>
                    {msg.role === "assistant" && msg.rows && msg.rows.length > 0 && (
                      <ResultTable rows={msg.rows} />
                    )}
                    {msg.role === "assistant" && devMode && msg.sql && (
                      <SqlBlock sql={msg.sql} />
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="bg-card border border-border rounded-xl rounded-bl-none px-4 py-3 flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </CardContent>

        <div className="px-4 pb-4 pt-2 border-t border-border space-y-2">
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  disabled={loading}
                  className="text-xs bg-secondary hover:bg-accent text-secondary-foreground px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={e => { e.preventDefault(); sendMessage(input); }}
          >
            <Input
              placeholder="Pergunte algo sobre suas finanças..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || loading} size="icon">
              <SendHorizonal className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
