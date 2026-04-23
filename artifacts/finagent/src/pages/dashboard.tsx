import { useProfile } from "../contexts/ProfileContext";
import {
  useGetDashboardSummary,
  useGetUpcomingBills,
  useGetRecentTransactions,
  useGetRecentInstallments,
} from "@workspace/api-client-react";
import { formatCurrency, formatCompact, formatDate, currentYearMonth, monthName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  TrendingDown,
  Wallet,
  CreditCard,
  Clock,
  TrendingUp,
  Layers,
} from "lucide-react";
import { useLocation } from "wouter";

function SummaryCard({
  title,
  value,
  icon: Icon,
  loading,
  color = "text-foreground",
  sub,
  href,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  loading: boolean;
  color?: string;
  sub?: string;
  href?: string;
}) {
  const [, navigate] = useLocation();
  return (
    <Card
      className={href ? "cursor-pointer hover:shadow-md transition-shadow select-none" : ""}
      onClick={href ? () => navigate(href) : undefined}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressSummaryCard({
  title,
  total,
  used,
  usedLabel,
  icon: Icon,
  loading,
  competence,
  href,
}: {
  title: string;
  total: number;
  used: number;
  usedLabel: string;
  icon: React.ElementType;
  loading: boolean;
  competence?: string;
  href?: string;
}) {
  const [, navigate] = useLocation();
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <Card
      className={href ? "cursor-pointer hover:shadow-md transition-shadow select-none" : ""}
      onClick={href ? () => navigate(href) : undefined}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
        {loading ? (
          <>
            <Skeleton className="h-9 w-40 mb-2" />
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-2 w-full" />
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {usedLabel}: <span className="font-medium text-foreground">{formatCurrency(used)}</span>
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Progress value={percent} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{percent}%</span>
            </div>
            {competence && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Competência: <span className="text-foreground">{competence}</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { activeProfileId } = useProfile();
  const [, navigate] = useLocation();
  const { year, month } = currentYearMonth();
  const competenceLabel = `${monthName(month).slice(0, 3)}/${year}`;

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    profileId: activeProfileId!,
    year,
    month,
  }, { query: { enabled: !!activeProfileId } });

  const { data: upcoming, isLoading: loadingUpcoming } = useGetUpcomingBills({
    profileId: activeProfileId!,
  }, { query: { enabled: !!activeProfileId } });

  const { data: recent, isLoading: loadingRecent } = useGetRecentTransactions({
    profileId: activeProfileId!,
    limit: 10,
  }, { query: { enabled: !!activeProfileId } });

  const { data: recentInstallments, isLoading: loadingInstallments } = useGetRecentInstallments({
    profileId: activeProfileId!,
    limit: 10,
  }, { query: { enabled: !!activeProfileId } });

  if (!activeProfileId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Nenhum perfil selecionado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          {monthName(month)} de {year}
        </p>
      </div>

      {/* KPI Cards — linha 1 (Saldo, Despesas, Parcelas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Saldo Total"
          value={formatCompact(summary?.totalBalance ?? 0)}
          icon={Wallet}
          loading={loadingSummary}
          color={summary && summary.totalBalance >= 0 ? "text-green-500" : "text-red-500"}
          href="/bank-accounts"
        />
        <SummaryCard
          title="Despesas do Mês"
          value={formatCompact(summary?.monthExpenses ?? 0)}
          icon={TrendingDown}
          loading={loadingSummary}
          color="text-red-500"
          href="/credit-cards"
        />
        <SummaryCard
          title="Parcelas (3 meses)"
          value={formatCompact(summary?.futureInstallments ?? 0)}
          icon={Clock}
          loading={loadingSummary}
          href="/reports"
        />
      </div>

      {/* KPI Cards — linha 2 (A Pagar, A Receber, Limite) com Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProgressSummaryCard
          title="A Pagar"
          total={summary?.monthTotalPayables ?? 0}
          used={summary?.monthPaidPayables ?? 0}
          usedLabel="Pago"
          icon={TrendingDown}
          loading={loadingSummary}
          competence={competenceLabel}
          href="/accounts-payable"
        />
        <ProgressSummaryCard
          title="A Receber"
          total={summary?.monthTotalReceivables ?? 0}
          used={summary?.monthReceivedReceivables ?? 0}
          usedLabel="Recebido"
          icon={TrendingUp}
          loading={loadingSummary}
          competence={competenceLabel}
          href="/accounts-receivable"
        />
        <ProgressSummaryCard
          title="Limite de Cartão"
          total={summary?.cardsTotalLimit ?? 0}
          used={summary?.cardsTotalUsed ?? 0}
          usedLabel="Usado"
          icon={CreditCard}
          loading={loadingSummary}
          href="/credit-cards"
        />
      </div>

      {/* Charts + lists */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Últimas Parcelas */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Últimas Parcelas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInstallments ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentInstallments && recentInstallments.length > 0 ? (
              <div className="space-y-2">
                {recentInstallments.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate("/credit-cards")}
                    className="w-full text-left p-2 rounded hover:bg-muted/50 transition-colors group"
                  >
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">
                      {item.description}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Parcela {item.currentInstallment}/{item.totalInstallments} · {formatCurrency(Math.abs(item.amount))}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.cardName ?? "Cartão"} · {item.categoryName ?? "Sem categoria"}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma parcela próxima do fim
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming bills */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Próximos Vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUpcoming ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : upcoming && upcoming.length > 0 ? (
              <div className="space-y-2">
                {upcoming.slice(0, 6).map(item => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.dueDate)} · {item.daysUntilDue === 0 ? "Hoje" : `${item.daysUntilDue}d`}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className={`font-medium ${item.type === "receivable" ? "text-green-500" : "text-red-400"}`}>
                        {item.type === "receivable" ? "+" : "-"}{formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum vencimento próximo</p>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Últimas Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : recent && recent.length > 0 ? (
              <div className="space-y-2">
                {recent.slice(0, 8).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.date)} · {tx.sourceName ?? "Cartão"}
                      </p>
                    </div>
                    <span className={`ml-2 font-medium ${tx.amount < 0 ? "text-red-400" : "text-green-500"}`}>
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma transação</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
