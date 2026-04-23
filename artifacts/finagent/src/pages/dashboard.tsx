import { useProfile } from "../contexts/ProfileContext";
import {
  useGetDashboardSummary,
  useGetUpcomingBills,
  useGetRecentTransactions,
  useGetCategoryBreakdown,
} from "@workspace/api-client-react";
import { formatCurrency, formatCompact, formatDate, statusLabel, currentYearMonth, monthName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingDown,
  Wallet,
  CreditCard,
  Clock,
  TrendingUp,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLocation } from "wouter";

const CHART_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316"];

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

export default function DashboardPage() {
  const { activeProfileId } = useProfile();
  const { year, month } = currentYearMonth();

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

  const { data: breakdown, isLoading: loadingBreakdown } = useGetCategoryBreakdown({
    profileId: activeProfileId!,
    year,
    month,
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

      {/* KPI Cards — linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Cartões (Uso/Limite)"
          value={formatCompact(summary?.cardsTotalUsed ?? 0)}
          icon={CreditCard}
          loading={loadingSummary}
          sub={summary ? `de ${formatCompact(summary.cardsTotalLimit)}` : undefined}
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

      {/* KPI Cards — linha 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        <SummaryCard
          title="A Pagar"
          value={formatCompact(summary?.monthPaidPayables ?? 0)}
          icon={TrendingDown}
          loading={loadingSummary}
          color="text-yellow-500"
          sub={summary ? `de ${formatCurrency(summary.monthTotalPayables)}` : undefined}
          href="/accounts-payable"
        />
        <SummaryCard
          title="A Receber"
          value={formatCompact(summary?.monthReceivedReceivables ?? 0)}
          icon={TrendingUp}
          loading={loadingSummary}
          color="text-blue-500"
          sub={summary ? `de ${formatCurrency(summary.monthTotalReceivables)}` : undefined}
          href="/accounts-receivable"
        />
      </div>

      {/* Charts + lists */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Category breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBreakdown ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : breakdown && breakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={breakdown} dataKey="total" nameKey="categoryName" cx="50%" cy="50%" outerRadius={80}>
                      {breakdown.map((entry, i) => (
                        <Cell key={entry.categoryName} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {breakdown.slice(0, 5).map((item, i) => (
                    <div key={item.categoryName} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: item.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="text-foreground truncate max-w-28">{item.categoryName}</span>
                      </div>
                      <span className="text-muted-foreground">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
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
