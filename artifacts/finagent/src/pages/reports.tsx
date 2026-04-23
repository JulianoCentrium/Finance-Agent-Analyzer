import { useState, useMemo } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { useGetCashFlow, useGetCategoryBreakdown, useGetInstallmentPurchasesReport, useListCategories, useListCommitmentTypes } from "@workspace/api-client-react";
import { formatCurrency, formatDate, monthName, currentYearMonth } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const CHART_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316","#ec4899","#14b8a6"];

export default function ReportsPage() {
  const { activeProfileId } = useProfile();
  const { year, month } = currentYearMonth();
  const [selYear, setSelYear] = useState(year);
  const [selMonth, setSelMonth] = useState(month);

  const { data: cashFlow, isLoading: loadingCashFlow } = useGetCashFlow(
    { profileId: activeProfileId! },
    { query: { enabled: !!activeProfileId } }
  );

  const { data: breakdown, isLoading: loadingBreakdown } = useGetCategoryBreakdown(
    { profileId: activeProfileId!, year: selYear, month: selMonth },
    { query: { enabled: !!activeProfileId } }
  );

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [year - 2, year - 1, year];

  // Installment report range: default = current month .. +11 months
  const today = new Date();
  const defaultFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const futureDate = new Date(today.getFullYear(), today.getMonth() + 11, 1);
  const defaultTo = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-01`;
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [drilldownMonth, setDrilldownMonth] = useState<string | null>(null);
  const [filterCategoryIds, setFilterCategoryIds] = useState<number[]>([]);
  const [filterCommitmentTypeIds, setFilterCommitmentTypeIds] = useState<number[]>([]);

  const { data: categories } = useListCategories(
    { profileId: activeProfileId! },
    { query: { enabled: !!activeProfileId } }
  );

  const { data: commitmentTypes } = useListCommitmentTypes(
    { profileId: activeProfileId! },
    { query: { enabled: !!activeProfileId } }
  );

  const { data: installmentReport, isLoading: loadingInstallment } = useGetInstallmentPurchasesReport(
    {
      profileId: activeProfileId!,
      from: fromDate,
      to: toDate,
      categoryId: filterCategoryIds.length > 0 ? filterCategoryIds : undefined,
      commitmentTypeId: filterCommitmentTypeIds.length > 0 ? filterCommitmentTypeIds : undefined,
    },
    { query: { enabled: !!activeProfileId } }
  );

  const installmentChartData = useMemo(() => {
    if (!installmentReport?.months) return [];
    return installmentReport.months.map(m => ({
      name: m.month.slice(0, 7),
      "Cartão de Crédito": m.creditCard,
      "Contas a Pagar": m.accountsPayable,
      monthKey: m.month,
    }));
  }, [installmentReport]);

  const drilldownItems = useMemo(() => {
    if (!drilldownMonth || !installmentReport?.items) return [];
    const ym = drilldownMonth.slice(0, 7);
    return installmentReport.items.filter(it => it.date.slice(0, 7) === ym);
  }, [drilldownMonth, installmentReport]);

  const cashFlowChartData = cashFlow?.map((item, idx, arr) => {
    // Junction point: last non-future entry connects both lines
    const isJunction = !item.isFuture && idx < arr.length - 1 && arr[idx + 1]?.isFuture;
    return {
      name: item.isFuture
        ? `${String(item.month).padStart(2, "0")}/${item.year}★`
        : `${String(item.month).padStart(2, "0")}/${item.year}`,
      "Contas a Receber": item.income,
      "Contas a Pagar": item.expenses,
      // Solid line covers past + current (junction included in dashed too so they connect)
      SaldoReal: !item.isFuture ? item.balance : isJunction ? item.balance : null,
      // Dashed line covers current junction + future
      SaldoPrev: item.isFuture ? item.balance : isJunction ? item.balance : null,
      isFuture: item.isFuture,
    };
  }) ?? [];

  if (!activeProfileId) return <p className="text-muted-foreground">Selecione um perfil.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatórios</h1>

      {/* Cash Flow 11 months */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">Fluxo de Caixa — 5 meses antes + atual + 5 meses à frente</CardTitle>
            <span className="text-xs text-muted-foreground">★ projetado</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCashFlow ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cashFlowChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v).replace("R$", "")} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Receitas" fill="#10b981" radius={[2, 2, 0, 0]}>
                  {cashFlowChartData.map((entry, i) => (
                    <Cell key={i} fill="#10b981" fillOpacity={entry.isFuture ? 0.4 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="Despesas" fill="#ef4444" radius={[2, 2, 0, 0]}>
                  {cashFlowChartData.map((entry, i) => (
                    <Cell key={i} fill="#ef4444" fillOpacity={entry.isFuture ? 0.4 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Balance Line */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">Saldo Mensal</CardTitle>
            <span className="text-xs text-muted-foreground">★ projetado (tracejado)</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCashFlow ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cashFlowChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v).replace("R$", "")} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line
                  type="monotone"
                  dataKey="SaldoReal"
                  name="Saldo Realizado"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="SaldoPrev"
                  name="Saldo Projetado"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: "white", strokeWidth: 2 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Installment Purchases Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-sm">Compras Parceladas — Comprometimento Mensal</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Parcelas futuras de cartão de crédito + lançamentos parcelados em contas a pagar.
              </p>
            </div>
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <Label className="text-xs">Categoria</Label>
                <MultiSelectFilter
                  className="w-36"
                  options={categories?.map(c => ({ id: c.id, name: c.name })) ?? []}
                  selected={filterCategoryIds}
                  onChange={ids => {
                    setFilterCategoryIds(ids);
                    setDrilldownMonth(null);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Tipo de Compromisso</Label>
                <MultiSelectFilter
                  className="w-44"
                  options={commitmentTypes?.map(ct => ({ id: ct.id, name: ct.name })) ?? []}
                  selected={filterCommitmentTypeIds}
                  onChange={ids => {
                    setFilterCommitmentTypeIds(ids);
                    setDrilldownMonth(null);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">De</Label>
                <Input type="month" value={fromDate.slice(0, 7)} onChange={e => setFromDate(`${e.target.value}-01`)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="month" value={toDate.slice(0, 7)} onChange={e => setToDate(`${e.target.value}-01`)} className="h-8 text-xs" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingInstallment ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : installmentChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={installmentChartData}
                  onClick={(e: { activePayload?: { payload: { monthKey: string } }[] }) => {
                    const p = e?.activePayload?.[0]?.payload;
                    if (p?.monthKey) setDrilldownMonth(p.monthKey);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v).replace("R$", "")} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Legend />
                  <Bar dataKey="Cartão de Crédito" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Contas a Pagar" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Clique em uma barra para ver os detalhes do mês.
              </p>

              {drilldownMonth && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      Detalhamento — {drilldownMonth.slice(0, 7)}
                    </h3>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setDrilldownMonth(null)}
                    >
                      Fechar
                    </button>
                  </div>
                  {drilldownItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem itens neste mês.</p>
                  ) : (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {drilldownItems.map(item => (
                        <div key={`${item.source}-${item.id}`} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/40">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
                            {item.source === "credit_card" ? "Cartão" : "A Pagar"}
                          </Badge>
                          <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{item.description}</span>
                            {item.source === "accounts_payable" && item.categoryName && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0 font-normal">
                                {item.categoryName}
                              </Badge>
                            )}
                            {item.source === "accounts_payable" && item.commitmentTypeName && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0 font-normal">
                                {item.commitmentTypeName}
                              </Badge>
                            )}
                          </div>
                          {item.installmentNumber && item.totalInstallments && (
                            <span className="text-muted-foreground text-[10px] tabular-nums">
                              {item.installmentNumber}/{item.totalInstallments}
                            </span>
                          )}
                          <span className="text-muted-foreground tabular-nums w-20 text-right">{formatDate(item.date)}</span>
                          <span className="font-semibold tabular-nums w-24 text-right">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">
              Nenhuma compra parcelada no período selecionado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type MultiSelectFilterProps = {
  options: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
  className?: string;
};

function MultiSelectFilter({ options, selected, onChange, className }: MultiSelectFilterProps) {
  const label = selected.length === 0
    ? "Todos"
    : selected.length === 1
      ? options.find(o => o.id === selected[0])?.name ?? "1 selecionado"
      : `${selected.length} selecionados`;

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 text-xs justify-between font-normal ${className ?? ""}`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 ml-1 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
          <span className="text-xs text-muted-foreground">
            {selected.length} de {options.length}
          </span>
          {selected.length > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Limpar
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma opção</p>
          ) : (
            options.map(opt => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/40 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(opt.id)}
                  onCheckedChange={() => toggle(opt.id)}
                />
                <span className="truncate">{opt.name}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
