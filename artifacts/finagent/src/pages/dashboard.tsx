import { useProfile } from "../contexts/ProfileContext";
import {
  useGetDashboardSummary,
  useGetUpcomingBills,
  useGetRecentTransactions,
  useGetRecentInstallments,
  useGetOpenInstallments,
  type OpenInstallmentItem,
} from "@workspace/api-client-react";
import { formatCurrency, formatCompact, formatDate, currentYearMonth, monthName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
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
  overdue,
  showAvailable,
  icon: Icon,
  loading,
  competence,
  href,
}: {
  title: string;
  total: number;
  used: number;
  usedLabel: string;
  overdue?: number;
  showAvailable?: boolean;
  icon: React.ElementType;
  loading: boolean;
  competence?: string;
  href?: string;
}) {
  const [, navigate] = useLocation();
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const available = total - used;

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
            {overdue !== undefined && overdue > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Em atraso: <span className="font-medium text-destructive">{formatCurrency(overdue)}</span>
              </p>
            )}
            {showAvailable && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Disponível: <span className="font-medium text-emerald-500">{formatCurrency(Math.max(0, available))}</span>
              </p>
            )}
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

function FutureInstallmentsCard({
  total,
  byCard,
  openInstallments,
  loading,
  onCardClick,
}: {
  total: number;
  byCard: Array<{ cardId: number; cardName: string; total: number }>;
  openInstallments: OpenInstallmentItem[];
  loading: boolean;
  onCardClick: (cardId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = byCard.length > 0 || openInstallments.length > 0;

  // Aggregate open installments by card
  const openByCard = useMemo(() => {
    const map = new Map<number, { cardId: number; cardName: string; total: number; count: number }>();
    for (const it of openInstallments) {
      const cur = map.get(it.cardId);
      if (cur) {
        cur.total += it.remainingAmount;
        cur.count += 1;
      } else {
        map.set(it.cardId, {
          cardId: it.cardId,
          cardName: it.cardName,
          total: it.remainingAmount,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [openInstallments]);

  const totalOpen = useMemo(
    () => openInstallments.reduce((s, it) => s + it.remainingAmount, 0),
    [openInstallments],
  );

  const trigger = (
    <Card
      className={hasBreakdown ? "cursor-pointer hover:shadow-md transition-shadow select-none" : ""}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Parcelas (3 meses)</p>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{formatCompact(total)}</p>
            )}
            {!loading && totalOpen > 0 && (
              <p className="text-xs text-muted-foreground">
                Em aberto: <span className="font-medium text-foreground">{formatCompact(totalOpen)}</span>
              </p>
            )}
            {hasBreakdown && (
              <p className="text-xs text-muted-foreground">
                {(byCard.length || openByCard.length)}{" "}
                {(byCard.length || openByCard.length) === 1 ? "cartão" : "cartões"} · clique para ver
              </p>
            )}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!hasBreakdown) return trigger;

  // Index next-3-months totals for quick lookup per card
  const next3ByCard = new Map<number, number>(byCard.map((b) => [b.cardId, b.total] as const));
  const allCardIds = new Set<number>([
    ...byCard.map((b) => b.cardId),
    ...openByCard.map((b) => b.cardId),
  ]);
  const cardOrder: number[] = openByCard.length > 0
    ? openByCard.map((b) => b.cardId)
    : byCard.map((b) => b.cardId);
  const seen = new Set<number>();
  const orderedCardIds: number[] = [
    ...cardOrder.filter((id: number) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return allCardIds.has(id);
    }),
    ...Array.from(allCardIds).filter((id: number) => !seen.has(id)),
  ];

  // Group open installments by card for nested rendering
  const openItemsByCard = new Map<number, OpenInstallmentItem[]>();
  for (const it of openInstallments) {
    const arr = openItemsByCard.get(it.cardId) ?? [];
    arr.push(it);
    openItemsByCard.set(it.cardId, arr);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[26rem] p-3 max-h-[28rem] overflow-y-auto" align="start">
        <div className="flex items-center justify-between px-1 pb-2 border-b border-border mb-2">
          <p className="text-xs font-semibold text-foreground">Parcelamentos por cartão</p>
          {totalOpen > 0 && (
            <p className="text-xs text-muted-foreground">
              Total em aberto: <span className="font-semibold text-foreground">{formatCurrency(totalOpen)}</span>
            </p>
          )}
        </div>
        <div className="space-y-3">
          {orderedCardIds.map((cardId) => {
            const cardName = openByCard.find((b) => b.cardId === cardId)?.cardName
              ?? byCard.find((b) => b.cardId === cardId)?.cardName
              ?? "Cartão";
            const next3 = next3ByCard.get(cardId) ?? 0;
            const cardOpen = openByCard.find((b) => b.cardId === cardId);
            const items = (openItemsByCard.get(cardId) ?? [])
              .slice()
              .sort((a, b) => b.remainingAmount - a.remainingAmount);
            return (
              <div key={cardId} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCardClick(cardId);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted/60 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-foreground truncate">{cardName}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {next3 > 0 && <>3 meses: <span className="text-foreground">{formatCurrency(next3)}</span></>}
                  </span>
                </button>
                {cardOpen && (
                  <div className="px-2 text-[11px] text-muted-foreground">
                    {cardOpen.count} {cardOpen.count === 1 ? "compra em aberto" : "compras em aberto"} ·{" "}
                    saldo restante: <span className="font-semibold text-foreground">{formatCurrency(cardOpen.total)}</span>
                  </div>
                )}
                {items.length > 0 && (
                  <ul className="ml-2 pl-2 border-l border-border space-y-0.5">
                    {items.slice(0, 5).map((it, idx) => (
                      <li
                        key={`${it.cardId}-${it.firstInstallmentDate}-${it.description}-${idx}`}
                        className="text-[11px] text-muted-foreground flex items-baseline justify-between gap-2"
                      >
                        <span className="truncate">
                          <span className="text-foreground">{it.description}</span>{" "}
                          <span className="tabular-nums">
                            {it.currentInstallment}/{it.totalInstallments}
                          </span>
                        </span>
                        <span className="tabular-nums whitespace-nowrap text-foreground">
                          {formatCurrency(it.remainingAmount)}
                        </span>
                      </li>
                    ))}
                    {items.length > 5 && (
                      <li className="text-[10px] text-muted-foreground italic px-1">
                        + {items.length - 5} compra(s)…
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DashboardPage() {
  const { activeProfileId } = useProfile();
  const [, navigate] = useLocation();
  const { year: currentYear, month: currentMonth } = currentYearMonth();
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const competenceLabel = `${monthName(selMonth).slice(0, 3)}/${selYear}`;
  const isCurrentMonth = selYear === currentYear && selMonth === currentMonth;
  const yearOptions = useMemo(() => {
    const opts: number[] = [];
    for (let y = currentYear - 3; y <= currentYear + 1; y++) opts.push(y);
    return opts;
  }, [currentYear]);

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    profileId: activeProfileId!,
    year: selYear,
    month: selMonth,
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

  const { data: openInstallments } = useGetOpenInstallments({
    profileId: activeProfileId!,
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
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {monthName(selMonth)} de {selYear}
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => { setSelYear(currentYear); setSelMonth(currentMonth); }}
                className="ml-2 text-xs text-primary hover:underline"
              >
                voltar para o mês atual
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selYear)} onValueChange={v => setSelYear(Number(v))}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[11px] font-normal">
            Afeta: Despesas, A Pagar, A Receber
          </Badge>
        </div>
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
        <FutureInstallmentsCard
          total={summary?.futureInstallments ?? 0}
          byCard={summary?.futureInstallmentsByCard ?? []}
          openInstallments={openInstallments ?? []}
          loading={loadingSummary}
          onCardClick={(cardId) => navigate(`/credit-cards?cardId=${cardId}&tab=open-installments`)}
        />
      </div>

      {/* KPI Cards — linha 2 (A Pagar, A Receber, Limite) com Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProgressSummaryCard
          title="A Pagar"
          total={summary?.monthTotalPayables ?? 0}
          used={summary?.monthPaidPayables ?? 0}
          usedLabel="Pago"
          overdue={summary?.monthOverduePayables ?? 0}
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
          overdue={summary?.monthOverdueReceivables ?? 0}
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
          showAvailable
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
                    <span className={`ml-2 font-medium tabular-nums ${tx.amount > 0 ? "text-red-400" : "text-green-500"}`}>
                      {tx.amount > 0 ? "-" : "+"}{formatCurrency(Math.abs(tx.amount))}
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
