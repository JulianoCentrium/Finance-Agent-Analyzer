import { useState, useMemo, useEffect } from "react";
import { useProfile } from "../contexts/ProfileContext";
import {
  useListCreditCards,
  useCreateCreditCard,
  useUpdateCreditCard,
  useDeleteCreditCard,
  useListInvoices,
  useListCardTransactions,
  useImportCardTransactions,
  useCreateCardTransaction,
  useUpdateCardTransaction,
  useDeleteCardTransaction,
  useGenerateCardTransactionInstallments,
  useSetCardTransactionInstallment,
  useUpdateInvoice,
  useListCategories,
  useCreateCategory,
  useSuggestCategory,
  useGetOpenInstallments,
  type CreditCard as CreditCardType,
  type CardTransaction,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate, monthName, currentYearMonth } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryPicker } from "@/components/ui/category-picker";
import { CreditCard, Plus, Upload, Pencil, Trash2, Lock, LockOpen, ChevronDown, ChevronUp, Layers, Ban, Undo2, ListOrdered } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";

interface CardFormData {
  name: string;
  lastFour: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  brand: string;
  color: string;
  isActive: boolean;
}

interface TxFormData {
  date: string;
  description: string;
  amount: number;
  categoryId: number | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
}

function CardForm({ initial, onSave, onCancel }: {
  initial?: CreditCardType | null;
  onSave: (data: CardFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CardFormData>({
    name: initial?.name ?? "",
    lastFour: initial?.lastFour ?? "",
    creditLimit: initial?.creditLimit ?? 0,
    closingDay: initial?.closingDay ?? 1,
    dueDay: initial?.dueDay ?? 10,
    brand: initial?.brand ?? "",
    color: initial?.color ?? "#3b82f6",
    isActive: initial?.isActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome do Cartão</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Nubank Principal" />
        </div>
        <div>
          <Label>Últimos 4 dígitos</Label>
          <Input maxLength={4} value={form.lastFour} onChange={e => setForm(f => ({ ...f, lastFour: e.target.value }))} placeholder="1234" />
        </div>
        <div>
          <Label>Bandeira</Label>
          <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Visa, Mastercard..." />
        </div>
        <div>
          <Label>Limite (R$)</Label>
          <CurrencyInput value={form.creditLimit} onChange={v => setForm(f => ({ ...f, creditLimit: v }))} />
        </div>
        <div>
          <Label>Cor</Label>
          <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
        </div>
        <div>
          <Label>Dia de Fechamento</Label>
          <Input type="number" min={1} max={31} value={form.closingDay} onChange={e => setForm(f => ({ ...f, closingDay: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Dia de Vencimento</Label>
          <Input type="number" min={1} max={31} value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name}>Salvar</Button>
      </div>
    </div>
  );
}

function TransactionForm({ initial, invoiceId, cardId, profileId, categories, onSave, onCancel, onCreateCategory }: {
  initial?: TxFormData | null;
  invoiceId: number;
  cardId: number;
  profileId: number;
  categories: { id: number; name: string }[];
  onSave: (data: TxFormData) => void;
  onCancel: () => void;
  onCreateCategory?: (name: string) => Promise<number>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<TxFormData>({
    date: initial?.date ?? today,
    description: initial?.description ?? "",
    amount: initial?.amount ?? 0,
    categoryId: initial?.categoryId ?? null,
    installmentNumber: initial?.installmentNumber ?? null,
    totalInstallments: initial?.totalInstallments ?? null,
  });
  const [isInstallment, setIsInstallment] = useState(!!(initial?.totalInstallments && initial.totalInstallments > 1));
  const [debouncedDesc, setDebouncedDesc] = useState(form.description);
  const [userTouchedCategory, setUserTouchedCategory] = useState(!!initial?.categoryId);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDesc(form.description), 400);
    return () => clearTimeout(t);
  }, [form.description]);
  const shouldSuggest = !userTouchedCategory && !form.categoryId && debouncedDesc.trim().length >= 3;
  const { data: suggestion } = useSuggestCategory(
    { profileId, description: debouncedDesc },
    { query: { enabled: shouldSuggest } }
  );
  useEffect(() => {
    if (shouldSuggest && suggestion?.categoryId && !form.categoryId) {
      setForm(f => ({ ...f, categoryId: suggestion.categoryId }));
    }
  }, [suggestion, shouldSuggest]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Data</Label>
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <CurrencyInput allowNegative value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
        </div>
        <div className="col-span-2">
          <Label>Descrição</Label>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Netflix" />
        </div>
        <div className="col-span-2">
          <Label>Categoria</Label>
          <CategoryPicker
            categories={categories}
            value={form.categoryId}
            onChange={v => { setUserTouchedCategory(true); setForm(f => ({ ...f, categoryId: v })); }}
            placeholder="Sem categoria"
            onCreate={onCreateCategory ? async name => {
              const id = await onCreateCategory(name);
              setUserTouchedCategory(true);
              return id;
            } : undefined}
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="isInstallment" checked={isInstallment} onChange={e => {
            setIsInstallment(e.target.checked);
            if (!e.target.checked) setForm(f => ({ ...f, installmentNumber: null, totalInstallments: null }));
          }} />
          <Label htmlFor="isInstallment">É parcelado?</Label>
        </div>
        {isInstallment && (
          <>
            <div>
              <Label>Parcela nº</Label>
              <Input type="number" min={1} value={form.installmentNumber ?? ""} onChange={e => setForm(f => ({ ...f, installmentNumber: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Total de parcelas</Label>
              <Input type="number" min={2} value={form.totalInstallments ?? ""} onChange={e => setForm(f => ({ ...f, totalInstallments: Number(e.target.value) }))} />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={
            !form.description ||
            !form.date ||
            (isInstallment && (
              !form.installmentNumber ||
              !form.totalInstallments ||
              form.installmentNumber < 1 ||
              form.totalInstallments < form.installmentNumber
            ))
          }
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function ImportModal({ card, onClose }: { card: CreditCardType; onClose: () => void }) {
  const { activeProfileId } = useProfile();
  const { toast } = useToast();
  const importMutation = useImportCardTransactions();
  const qc = useQueryClient();
  const { year, month } = currentYearMonth();
  const [selYear, setSelYear] = useState(year);
  const [selMonth, setSelMonth] = useState(month);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file || !activeProfileId) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async e => {
      const content = btoa(e.target?.result as string);
      try {
        const result = await importMutation.mutateAsync({
          data: {
            cardId: card.id,
            profileId: activeProfileId,
            year: selYear,
            month: selMonth,
            fileContent: content,
            fileType: file.name.toLowerCase().endsWith(".ofx") ? "ofx" : "csv",
            fileName: file.name,
          },
        });
        toast({ title: "Importação concluída", description: `${result.importedRecords} transações importadas.` });
        qc.invalidateQueries();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        toast({ title: "Erro na importação", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [year - 2, year - 1, year, year + 1];

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Importar Fatura — {card.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Mês</Label>
            <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")} - {monthName(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Select value={String(selYear)} onValueChange={v => setSelYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Arquivo CSV ou OFX</Label>
          <Input type="file" accept=".csv,.ofx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? "Importando..." : "Importar"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function CategoryCell({ tx, categories, onUpdate, onCreateCategory }: {
  tx: CardTransaction;
  categories: { id: number; name: string }[];
  onUpdate: (categoryId: number | null) => void;
  onCreateCategory?: (name: string) => Promise<number>;
}) {
  return (
    <CategoryPicker
      categories={categories}
      value={tx.categoryId ?? null}
      onChange={onUpdate}
      placeholder="—"
      triggerClassName="flex h-7 w-32 items-center justify-between rounded-sm border-0 bg-transparent px-1 py-0 text-xs shadow-none hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
      onCreate={onCreateCategory}
    />
  );
}

function CardDetail({ card }: { card: CreditCardType }) {
  const { activeProfileId } = useProfile();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { year, month } = currentYearMonth();
  const [selYear, setSelYear] = useState(year);
  const [selMonth, setSelMonth] = useState(month);
  const [activeTab, setActiveTab] = useState("transactions");
  const detailSearch = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(detailSearch);
    const tab = params.get("tab");
    if (tab === "open-installments" || tab === "transactions" || tab === "analysis") {
      setActiveTab(tab);
    }
  }, [detailSearch, card.id]);

  const { data: openInstallments } = useGetOpenInstallments(
    { profileId: activeProfileId!, cardId: card.id },
    { query: { enabled: !!activeProfileId } },
  );
  const cardOpenInstallments = openInstallments ?? [];
  const sortedOpenInstallments = useMemo(
    () => [...cardOpenInstallments].sort((a, b) => b.remainingAmount - a.remainingAmount),
    [cardOpenInstallments],
  );
  const totalOpenInstallments = useMemo(
    () => cardOpenInstallments.reduce((s, it) => s + it.remainingAmount, 0),
    [cardOpenInstallments],
  );
  const totalOriginalInstallments = useMemo(
    () => cardOpenInstallments.reduce((s, it) => s + it.totalAmount, 0),
    [cardOpenInstallments],
  );
  const [showAddTx, setShowAddTx] = useState(false);
  const [editTx, setEditTx] = useState<CardTransaction | null>(null);
  const [installmentTx, setInstallmentTx] = useState<CardTransaction | null>(null);
  const [installmentCurrent, setInstallmentCurrent] = useState(1);
  const [installmentTotal, setInstallmentTotal] = useState(2);
  const [setInstTx, setSetInstTx] = useState<CardTransaction | null>(null);
  const [setInstCurrent, setSetInstCurrent] = useState(1);
  const [setInstTotal, setSetInstTotal] = useState(2);
  const [importOpen, setImportOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const profileId = activeProfileId!;

  const { data: invoices, refetch: refetchInvoices } = useListInvoices({ cardId: card.id });
  const selectedInvoice = invoices?.find(i => i.year === selYear && i.month === selMonth);

  const { data: transactions } = useListCardTransactions(
    { invoiceId: selectedInvoice?.id, cardId: card.id },
    { query: { enabled: !!selectedInvoice?.id } }
  );

  const { data: allCategories } = useListCategories(
    { profileId },
    { query: { enabled: !!profileId } }
  );
  const categories = allCategories ?? [];
  const expenseCategories = useMemo(
    () => categories.filter(c => c.isActive !== false && (c.type === "expense" || c.type === "both")),
    [categories]
  );

  const createTx = useCreateCardTransaction();
  const updateTx = useUpdateCardTransaction();
  const deleteTx = useDeleteCardTransaction();
  const generateInstallments = useGenerateCardTransactionInstallments();
  const setInstallmentMutation = useSetCardTransactionInstallment();
  const updateInvoice = useUpdateInvoice();
  const createCategory = useCreateCategory();

  const handleCreateCategory = async (name: string): Promise<number> => {
    try {
      const created = await createCategory.mutateAsync({
        data: {
          profileId,
          name: name.trim(),
          type: "expense",
          color: "#6366f1",
          icon: null,
          isActive: true,
        } as Parameters<typeof createCategory.mutateAsync>[0]["data"],
      });
      qc.invalidateQueries();
      toast({ title: "Categoria criada", description: created.name });
      return created.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar categoria";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      throw err;
    }
  };

  const isLocked = selectedInvoice?.status === "closed";

  const handleCloseInvoice = async () => {
    if (!selectedInvoice) return;
    if (!confirm("Fechar a fatura impedirá novas transações e importações. Confirmar?")) return;
    setClosing(true);
    try {
      await updateInvoice.mutateAsync({ id: selectedInvoice.id, data: { status: "closed" } });
      await refetchInvoices();
      qc.invalidateQueries();
      toast({ title: "Fatura fechada" });
    } catch {
      toast({ title: "Erro ao fechar fatura", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  const handleReopenInvoice = async () => {
    if (!selectedInvoice) return;
    setClosing(true);
    try {
      await updateInvoice.mutateAsync({ id: selectedInvoice.id, data: { status: "open" } });
      await refetchInvoices();
      qc.invalidateQueries();
      toast({ title: "Fatura reaberta" });
    } catch {
      toast({ title: "Erro ao reabrir fatura", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  const handleAddTx = async (data: TxFormData) => {
    if (!selectedInvoice) return;
    try {
      const created = await createTx.mutateAsync({
        data: {
          invoiceId: selectedInvoice.id,
          cardId: card.id,
          profileId,
          date: data.date,
          description: data.description.toUpperCase(),
          amount: data.amount,
          categoryId: data.categoryId ?? null,
          installmentNumber: data.installmentNumber ?? null,
          totalInstallments: data.totalInstallments ?? null,
        },
      });

      const shouldGenerate =
        !!data.installmentNumber &&
        !!data.totalInstallments &&
        data.totalInstallments > data.installmentNumber;

      if (shouldGenerate && created?.id) {
        try {
          const result = await generateInstallments.mutateAsync({
            id: created.id,
            data: {
              currentInstallment: data.installmentNumber!,
              totalInstallments: data.totalInstallments!,
            },
          });
          const generated = result?.generated ?? 0;
          const skipped = result?.skipped ?? 0;
          const skippedMsg = skipped > 0 ? ` (${skipped} pulada(s))` : "";
          toast({
            title: `Transação adicionada e ${generated} parcela(s) futura(s) gerada(s)${skippedMsg}`,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Falha ao gerar parcelas futuras";
          toast({
            title: "Transação criada, parcelas não geradas",
            description: `${msg}. Use o botão "Gerar Parcelas" na linha para tentar novamente.`,
          });
        }
      } else {
        toast({ title: "Transação adicionada" });
      }

      qc.invalidateQueries();
      setShowAddTx(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleUpdateCategory = async (tx: CardTransaction, categoryId: number | null) => {
    try {
      await updateTx.mutateAsync({ id: tx.id, data: { categoryId } });
      qc.invalidateQueries();
    } catch {
      toast({ title: "Erro ao atualizar categoria", variant: "destructive" });
    }
  };

  const handleEditTx = async (data: TxFormData) => {
    if (!editTx) return;
    try {
      await updateTx.mutateAsync({
        id: editTx.id,
        data: {
          date: data.date,
          description: data.description,
          amount: data.amount,
          categoryId: data.categoryId ?? null,
        },
      });
      qc.invalidateQueries();
      toast({ title: "Transação atualizada" });
      setEditTx(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const openInstallmentDialog = (tx: CardTransaction) => {
    setInstallmentTx(tx);
    setInstallmentCurrent(tx.installmentNumber ?? 1);
    setInstallmentTotal(Math.max(2, (tx.installmentNumber ?? 1) + 1));
  };

  const openSetInstallmentDialog = (tx: CardTransaction) => {
    setSetInstTx(tx);
    setSetInstCurrent(tx.installmentNumber ?? 1);
    setSetInstTotal(tx.totalInstallments ?? Math.max(2, (tx.installmentNumber ?? 1) + 1));
  };

  const handleSetInstallment = async () => {
    if (!setInstTx) return;
    if (setInstTotal <= setInstCurrent) {
      toast({ title: "Total deve ser maior que a parcela atual.", variant: "destructive" });
      return;
    }
    try {
      const result = await setInstallmentMutation.mutateAsync({
        id: setInstTx.id,
        data: {
          currentInstallment: setInstCurrent,
          totalInstallments: setInstTotal,
        },
      });
      qc.invalidateQueries();
      toast({
        title: "Parcela redefinida",
        description: `Parcela ${setInstCurrent}/${setInstTotal} definida${result.generated > 0 ? `, ${result.generated} parcela(s) futura(s) criada(s)` : ""}${result.skipped > 0 ? `, ${result.skipped} ignorada(s)` : ""}.`,
      });
      setSetInstTx(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao redefinir parcela";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleGenerateInstallments = async () => {
    if (!installmentTx) return;
    if (installmentTotal <= installmentCurrent) {
      toast({ title: "Total deve ser maior que a parcela atual.", variant: "destructive" });
      return;
    }
    try {
      const result = await generateInstallments.mutateAsync({
        id: installmentTx.id,
        data: {
          currentInstallment: installmentCurrent,
          totalInstallments: installmentTotal,
        },
      });
      qc.invalidateQueries();
      toast({
        title: "Parcelas geradas",
        description: `${result.generated} parcelas criadas${result.skipped > 0 ? `, ${result.skipped} ignoradas (duplicadas ou fatura fechada)` : ""}.`,
      });
      setInstallmentTx(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar parcelas";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteTx = async (tx: CardTransaction) => {
    if (!confirm("Excluir esta transação?")) return;
    try {
      await deleteTx.mutateAsync({ id: tx.id });
      qc.invalidateQueries();
      toast({ title: "Transação excluída" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const handleToggleCancelTx = async (tx: CardTransaction, status: "active" | "cancelled") => {
    if (status === "cancelled" && !confirm("Cancelar esta transação? Ela continuará visível mas não afetará a fatura.")) return;
    try {
      await updateTx.mutateAsync({ id: tx.id, data: { status } });
      qc.invalidateQueries();
      toast({ title: status === "cancelled" ? "Transação cancelada" : "Transação reativada" });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [year - 2, year - 1, year, year + 1];

  // Analysis: group positive amounts by category
  const categoryTotals = useMemo(() => {
    if (!transactions) return [];
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.amount > 0) {
        const key = tx.categoryName ?? "Não Classificado";
        map.set(key, (map.get(key) ?? 0) + tx.amount);
      }
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const totalExpenses = useMemo(
    () => transactions?.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0) ?? 0,
    [transactions]
  );
  const totalCredits = useMemo(
    () => transactions?.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0) ?? 0,
    [transactions]
  );

  const statusColor: Record<string, string> = {
    open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    closed: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    paid: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  const statusLabel: Record<string, string> = { open: "Aberta", closed: "Fechada", paid: "Paga" };

  return (
    <div className="space-y-4">
      {/* Header row: selectors + invoice info + actions */}
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}/{selYear}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={String(selYear)} onValueChange={v => setSelYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedInvoice && (
          <>
            <Badge className={`text-xs px-2 py-0.5 border ${statusColor[selectedInvoice.status] ?? ""}`}>
              {statusLabel[selectedInvoice.status] ?? selectedInvoice.status}
            </Badge>
            <span className="text-sm font-semibold">
              {formatCurrency(selectedInvoice.totalAmount)}
            </span>
          </>
        )}

        <div className="ml-auto flex gap-2">
          {selectedInvoice && (
            isLocked ? (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleReopenInvoice} disabled={closing}>
                <LockOpen className="w-3 h-3" /> Reabrir
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleCloseInvoice} disabled={closing}>
                <Lock className="w-3 h-3" /> Fechar Fatura
              </Button>
            )
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setImportOpen(true)}>
            <Upload className="w-3 h-3" /> Importar
          </Button>
          {!isLocked && (
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowAddTx(true)} disabled={!selectedInvoice}>
              <Plus className="w-3 h-3" /> Lançamento
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8">
          <TabsTrigger value="transactions" className="text-xs h-7">Transações</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs h-7">Análise por Categoria</TabsTrigger>
          <TabsTrigger value="open-installments" className="text-xs h-7">
            Parcelamentos em Aberto
            {cardOpenInstallments.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] h-4">
                {cardOpenInstallments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {!selectedInvoice && activeTab !== "open-installments" && (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhuma fatura neste mês. Importe um arquivo CSV/OFX ou adicione lançamentos manualmente.
          </p>
        )}

        {selectedInvoice && (<>
          <TabsContent value="transactions" className="mt-3">
            {transactions && transactions.length > 0 ? (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="h-8">
                      <TableHead className="text-xs py-1">Data</TableHead>
                      <TableHead className="text-xs py-1">Descrição</TableHead>
                      <TableHead className="text-xs py-1">Categoria</TableHead>
                      <TableHead className="text-xs py-1 text-right">Valor</TableHead>
                      <TableHead className="text-xs py-1 w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(tx => {
                      const isCancelled = tx.status === "cancelled";
                      return (
                      <TableRow key={tx.id} className={`h-9 ${isCancelled ? "opacity-50" : ""}`}>
                        <TableCell className={`text-xs py-1 tabular-nums ${isCancelled ? "line-through" : ""}`}>{formatDate(tx.date)}</TableCell>
                        <TableCell className="text-xs py-1 max-w-[200px]">
                          <span className={`line-clamp-1 ${isCancelled ? "line-through" : ""}`}>{tx.description}</span>
                          {tx.isInstallment && tx.installmentNumber && tx.totalInstallments && (
                            isLocked ? (
                              <span className="ml-1 text-muted-foreground text-[10px]">
                                {tx.installmentNumber}/{tx.totalInstallments}
                              </span>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-primary/70 border-b border-dashed border-primary/40 hover:text-primary hover:border-primary cursor-pointer group/inst transition-colors"
                                    onClick={() => openSetInstallmentDialog(tx)}
                                  >
                                    {tx.installmentNumber}/{tx.totalInstallments}
                                    <Pencil className="w-2 h-2 opacity-0 group-hover/inst:opacity-100 transition-opacity" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Clique para redefinir a parcela</TooltipContent>
                              </Tooltip>
                            )
                          )}
                          {isCancelled && (
                            <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 border-destructive/40 text-destructive">cancelada</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-1">
                          <CategoryCell tx={tx} categories={expenseCategories} onUpdate={cid => handleUpdateCategory(tx, cid)} onCreateCategory={handleCreateCategory} />
                        </TableCell>
                        <TableCell className={`text-right font-medium text-xs py-1 tabular-nums ${isCancelled ? "line-through text-muted-foreground" : tx.amount > 0 ? "text-red-400" : "text-green-500"}`}>
                          {tx.amount < 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                        </TableCell>
                        <TableCell className="py-1">
                          <div className="flex gap-0.5 justify-end">
                            {!isLocked && (
                              isCancelled ? (
                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-green-500" onClick={() => handleToggleCancelTx(tx, "active")} title="Reativar">
                                  <Undo2 className="w-3 h-3" />
                                </Button>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => handleToggleCancelTx(tx, "cancelled")} title="Cancelar transação">
                                  <Ban className="w-3 h-3" />
                                </Button>
                              )
                            )}
                            {tx.source === "manual" && !isLocked && !isCancelled && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditTx(tx)} title="Editar">
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                            {tx.source === "manual" && !isLocked && !isCancelled && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => openSetInstallmentDialog(tx)}
                                title="Redefinir parcela"
                              >
                                <ListOrdered className="w-3 h-3" />
                              </Button>
                            )}
                            {tx.source === "manual" && !isLocked && !isCancelled && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => openInstallmentDialog(tx)}
                                title="Gerar parcelas futuras"
                              >
                                <Layers className="w-3 h-3" />
                              </Button>
                            )}
                            {tx.source === "manual" && !isLocked && (
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => handleDeleteTx(tx)} title="Excluir">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma transação. Importe um CSV/OFX ou adicione um lançamento.
              </p>
            )}

            {/* Summary row */}
            {transactions && transactions.length > 0 && (
              <div className="flex gap-6 justify-end text-xs mt-2 text-muted-foreground">
                <span>Despesas: <span className="text-red-400 font-semibold">{formatCurrency(totalExpenses)}</span></span>
                {totalCredits < 0 && <span>Créditos: <span className="text-green-500 font-semibold">{formatCurrency(Math.abs(totalCredits))}</span></span>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="mt-3">
            {categoryTotals.length > 0 ? (
              <div className="space-y-2">
                {categoryTotals.map(({ name, total }) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-40 truncate">{name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (total / totalExpenses) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold tabular-nums w-24 text-right">{formatCurrency(total)}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {totalExpenses > 0 ? `${Math.round((total / totalExpenses) * 100)}%` : ""}
                    </span>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t border-border">
                  <span className="text-sm font-bold">Total: {formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados para análise neste período.</p>
            )}
          </TabsContent>
        </>)}

          <TabsContent value="open-installments" className="mt-3">
            {sortedOpenInstallments.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Saldo total em aberto</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {formatCurrency(totalOpenInstallments)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Valor original (somado)</p>
                    <p className="text-lg font-bold tabular-nums text-muted-foreground">
                      {formatCurrency(totalOriginalInstallments)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Compras parceladas em aberto</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {sortedOpenInstallments.length}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead className="text-xs py-1">Descrição</TableHead>
                        <TableHead className="text-xs py-1 text-center">Parcela atual</TableHead>
                        <TableHead className="text-xs py-1 text-right">Valor parcela</TableHead>
                        <TableHead className="text-xs py-1 text-right">Pago</TableHead>
                        <TableHead className="text-xs py-1 text-right">Quanto falta pagar</TableHead>
                        <TableHead className="text-xs py-1">Próx. fatura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedOpenInstallments.map((it, idx) => {
                        const paidAmount = it.totalAmount - it.remainingAmount;
                        const pct = it.totalInstallments > 0
                          ? Math.round((it.paidInstallments / it.totalInstallments) * 100)
                          : 0;
                        return (
                          <TableRow
                            key={`${it.cardId}-${it.firstInstallmentDate}-${it.description}-${idx}`}
                            className="h-9"
                          >
                            <TableCell className="text-xs py-1 max-w-[260px]">
                              <span className="line-clamp-1">{it.description}</span>
                            </TableCell>
                            <TableCell className="text-xs py-1 text-center tabular-nums">
                              <div className="flex flex-col items-center gap-0.5">
                                <span>{it.currentInstallment}/{it.totalInstallments}</span>
                                <div className="w-16 bg-muted rounded-full h-1 overflow-hidden">
                                  <div
                                    className="h-1 rounded-full bg-primary"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs py-1 text-right tabular-nums">
                              {formatCurrency(it.installmentAmount)}
                            </TableCell>
                            <TableCell className="text-xs py-1 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(paidAmount)}
                            </TableCell>
                            <TableCell className="text-xs py-1 text-right font-semibold tabular-nums text-foreground">
                              {formatCurrency(it.remainingAmount)}
                            </TableCell>
                            <TableCell className="text-xs py-1 text-muted-foreground">
                              {it.nextInstallmentDate ? formatDate(it.nextInstallmentDate) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end text-sm pt-1">
                  <span className="text-muted-foreground mr-2">Saldo total de parcelamentos em aberto:</span>
                  <span className="font-bold tabular-nums">{formatCurrency(totalOpenInstallments)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma compra parcelada em aberto neste cartão.
              </p>
            )}
          </TabsContent>
      </Tabs>

      {/* Add transaction dialog */}
      <Dialog open={showAddTx} onOpenChange={open => { if (!open) setShowAddTx(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lançamento Manual</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <TransactionForm
              invoiceId={selectedInvoice.id}
              cardId={card.id}
              profileId={profileId}
              categories={expenseCategories}
              onSave={handleAddTx}
              onCancel={() => setShowAddTx(false)}
              onCreateCategory={handleCreateCategory}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit transaction dialog (manual only) */}
      <Dialog open={!!editTx} onOpenChange={open => { if (!open) setEditTx(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lançamento Manual</DialogTitle>
          </DialogHeader>
          {editTx && selectedInvoice && (
            <TransactionForm
              initial={{
                date: typeof editTx.date === "string" ? editTx.date : (editTx.date as Date).toISOString().split("T")[0],
                description: editTx.description,
                amount: editTx.amount,
                categoryId: editTx.categoryId ?? null,
                installmentNumber: editTx.installmentNumber ?? null,
                totalInstallments: editTx.totalInstallments ?? null,
              }}
              invoiceId={selectedInvoice.id}
              cardId={card.id}
              profileId={profileId}
              categories={expenseCategories}
              onSave={handleEditTx}
              onCancel={() => setEditTx(null)}
              onCreateCategory={handleCreateCategory}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Generate installments dialog */}
      <Dialog open={!!installmentTx} onOpenChange={open => { if (!open) setInstallmentTx(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Parcelas Futuras</DialogTitle>
          </DialogHeader>
          {installmentTx && (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground line-clamp-2">{installmentTx.description}</p>
                <p className="text-xs mt-1">
                  Valor por parcela: <span className="font-semibold text-foreground">{formatCurrency(Math.abs(installmentTx.amount))}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Parcela atual</Label>
                  <Input
                    type="number"
                    min={1}
                    value={installmentCurrent}
                    onChange={e => setInstallmentCurrent(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Total de parcelas</Label>
                  <Input
                    type="number"
                    min={2}
                    value={installmentTotal}
                    onChange={e => setInstallmentTotal(Math.max(2, Number(e.target.value)))}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Serão geradas <span className="font-semibold text-foreground">{Math.max(0, installmentTotal - installmentCurrent)}</span> parcela(s) futura(s),
                uma por mês após a transação atual. Faturas serão criadas automaticamente quando necessário.
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setInstallmentTx(null)}>Cancelar</Button>
                <Button onClick={handleGenerateInstallments} disabled={generateInstallments.isPending || installmentTotal <= installmentCurrent}>
                  {generateInstallments.isPending ? "Gerando..." : "Gerar Parcelas"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Set installment dialog (opened by clicking X/N badge) */}
      <Dialog open={!!setInstTx} onOpenChange={open => { if (!open) setSetInstTx(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Número da Parcela</DialogTitle>
          </DialogHeader>
          {setInstTx && (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground line-clamp-2">{setInstTx.description}</p>
                <p className="text-xs mt-1">
                  Valor por parcela: <span className="font-semibold text-foreground">{formatCurrency(Math.abs(setInstTx.amount))}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Parcela atual</Label>
                  <Input
                    type="number"
                    min={1}
                    max={setInstTotal}
                    value={setInstCurrent}
                    onChange={e => setSetInstCurrent(Math.max(1, Math.min(setInstTotal, Number(e.target.value))))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Total de parcelas</Label>
                  <Input
                    type="number"
                    min={2}
                    max={48}
                    value={setInstTotal}
                    onChange={e => {
                      const newTotal = Math.max(2, Math.min(48, Number(e.target.value)));
                      setSetInstTotal(newTotal);
                      if (setInstCurrent > newTotal) setSetInstCurrent(newTotal);
                    }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Serão geradas <span className="font-semibold text-foreground">{Math.max(0, setInstTotal - setInstCurrent)}</span> parcela(s) futura(s),
                uma por mês após esta transação. Parcelas já existentes serão ignoradas.
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSetInstTx(null)}>Cancelar</Button>
                <Button onClick={handleSetInstallment} disabled={setInstallmentMutation.isPending || setInstTotal <= setInstCurrent}>
                  {setInstallmentMutation.isPending ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      {importOpen && (
        <Dialog open={importOpen} onOpenChange={open => { if (!open) setImportOpen(false); }}>
          <ImportModal card={card} onClose={() => setImportOpen(false)} />
        </Dialog>
      )}
    </div>
  );
}

export default function CreditCardsPage() {
  const { activeProfileId } = useProfile();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { year: curYear, month: curMonth } = currentYearMonth();

  const { data: cards, isLoading } = useListCreditCards(
    { profileId: activeProfileId! },
    { query: { enabled: !!activeProfileId } }
  );
  const { data: allCategories } = useListCategories(
    { profileId: activeProfileId! },
    { query: { enabled: !!activeProfileId } }
  );

  const createCard = useCreateCreditCard();
  const updateCard = useUpdateCreditCard();
  const deleteCard = useDeleteCreditCard();

  const [pageTab, setPageTab] = useState<"cards" | "analysis">("cards");
  const [showForm, setShowForm] = useState(false);
  const [editCard, setEditCard] = useState<CreditCardType | null>(null);
  const [selectedCard, setSelectedCard] = useState<CreditCardType | null>(null);
  const [cardSearch, setCardSearch] = useState("");

  const search = useSearch();
  useEffect(() => {
    if (!cards) return;
    const params = new URLSearchParams(search);
    const cardIdStr = params.get("cardId");
    if (!cardIdStr) return;
    const cardId = Number(cardIdStr);
    const found = cards.find(c => c.id === cardId);
    if (found && selectedCard?.id !== found.id) {
      setSelectedCard(found);
      setPageTab("cards");
    }
  }, [search, cards]);

  // Analysis filters
  const [analysisYear, setAnalysisYear] = useState(curYear);
  const [analysisMonth, setAnalysisMonth] = useState(curMonth);
  const [analysisCardId, setAnalysisCardId] = useState<string>("all");
  const [analysisCategoryId, setAnalysisCategoryId] = useState<string>("all");

  const { data: allTransactions } = useListCardTransactions(
    { profileId: activeProfileId! },
    { query: { enabled: !!activeProfileId && pageTab === "analysis" } }
  );

  const analysisDatePrefix = `${analysisYear}-${String(analysisMonth).padStart(2, "0")}`;

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
    let txs = allTransactions.filter(tx => {
      const txDate = typeof tx.date === "string" ? tx.date : (tx.date as Date).toISOString().split("T")[0];
      return txDate.startsWith(analysisDatePrefix);
    });
    if (analysisCardId !== "all") txs = txs.filter(tx => tx.cardId === Number(analysisCardId));
    if (analysisCategoryId !== "all") txs = txs.filter(tx => String(tx.categoryId ?? "none") === analysisCategoryId);
    return txs;
  }, [allTransactions, analysisDatePrefix, analysisCardId, analysisCategoryId]);

  const analysisTotalExpenses = useMemo(
    () => filteredTransactions.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0),
    [filteredTransactions]
  );
  const analysisTotalCredits = useMemo(
    () => filteredTransactions.filter(tx => tx.amount < 0).reduce((s, tx) => s + tx.amount, 0),
    [filteredTransactions]
  );
  const analysisTotalFinishing = useMemo(
    () => filteredTransactions
      .filter(tx => tx.isInstallment && tx.installmentNumber != null && tx.totalInstallments != null && tx.installmentNumber === tx.totalInstallments && tx.amount > 0)
      .reduce((s, tx) => s + tx.amount, 0),
    [filteredTransactions]
  );

  const analysisByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredTransactions) {
      if (tx.amount > 0) {
        const key = tx.categoryName ?? "Não Classificado";
        map.set(key, (map.get(key) ?? 0) + tx.amount);
      }
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  const handleSave = async (data: CardFormData) => {
    try {
      if (editCard) {
        await updateCard.mutateAsync({ id: editCard.id, data });
        toast({ title: "Cartão atualizado" });
      } else {
        await createCard.mutateAsync({ data: { ...data, profileId: activeProfileId! } });
        toast({ title: "Cartão criado" });
      }
      qc.invalidateQueries();
      setShowForm(false);
      setEditCard(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este cartão? Todas as faturas e transações serão removidas.")) return;
    await deleteCard.mutateAsync({ id });
    if (selectedCard?.id === id) setSelectedCard(null);
    qc.invalidateQueries();
  };

  const years = [curYear - 2, curYear - 1, curYear, curYear + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (!activeProfileId) return <p className="text-muted-foreground">Selecione um perfil.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cartões de Crédito</h1>
        {pageTab === "cards" && (
          <Button onClick={() => { setEditCard(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Novo Cartão
          </Button>
        )}
      </div>

      <Tabs value={pageTab} onValueChange={v => setPageTab(v as "cards" | "analysis")}>
        <TabsList>
          <TabsTrigger value="cards">Cartões</TabsTrigger>
          <TabsTrigger value="analysis">Análise Geral</TabsTrigger>
        </TabsList>

        {/* ── CARTÕES TAB ── */}
        <TabsContent value="cards" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Input
              placeholder="Pesquisar cartão..."
              value={cardSearch}
              onChange={e => setCardSearch(e.target.value)}
              className="h-9 w-52"
            />
          </div>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(cardSearch
                ? cards?.filter(c =>
                    c.name.toLowerCase().includes(cardSearch.toLowerCase()) ||
                    (c.lastFour ?? "").includes(cardSearch)
                  )
                : cards
              )?.map(card => (
                <Card
                  key={card.id}
                  className={`cursor-pointer transition-all ${selectedCard?.id === card.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: card.color ?? "#3b82f6" }}
                        >
                          <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{card.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {card.brand}{card.lastFour ? ` •••• ${card.lastFour}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditCard(card); setShowForm(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                          onClick={() => handleDelete(card.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Limite</span>
                        <span className="font-medium">{formatCurrency(card.creditLimit)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Fecha dia {card.closingDay}</span>
                        <span>Vence dia {card.dueDay}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      {selectedCard?.id === card.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {selectedCard?.id === card.id ? "Ocultar faturas" : "Ver faturas"}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!cards || cards.length === 0) && (
                <p className="text-muted-foreground col-span-3 py-8 text-center">
                  {cardSearch ? "Nenhum resultado para a pesquisa." : 'Nenhum cartão cadastrado. Clique em "Novo Cartão" para começar.'}
                </p>
              )}
            </div>
          )}

          {selectedCard && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: selectedCard.color ?? "#3b82f6" }} />
                  Faturas — {selectedCard.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDetail card={selectedCard} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── ANÁLISE GERAL TAB ── */}
        <TabsContent value="analysis" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select value={String(analysisMonth)} onValueChange={v => setAnalysisMonth(Number(v))}>
                <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}/{analysisYear}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ano</Label>
              <Select value={String(analysisYear)} onValueChange={v => setAnalysisYear(Number(v))}>
                <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cartão</Label>
              <Select value={analysisCardId} onValueChange={setAnalysisCardId}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cartões</SelectItem>
                  {cards?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={analysisCategoryId} onValueChange={setAnalysisCategoryId}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  <SelectItem value="none">Não classificado</SelectItem>
                  {allCategories?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Totalizers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total de Despesas</p>
                <p className="text-xl font-bold text-red-400 tabular-nums">{formatCurrency(analysisTotalExpenses)}</p>
              </CardContent>
            </Card>
            {analysisTotalCredits < 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total de Créditos</p>
                  <p className="text-xl font-bold text-green-500 tabular-nums">{formatCurrency(Math.abs(analysisTotalCredits))}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Parcelas terminando neste mês</p>
                <p className="text-xl font-bold text-amber-400 tabular-nums">{formatCurrency(analysisTotalFinishing)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Última parcela sendo quitada</p>
              </CardContent>
            </Card>
          </div>

          {/* Category breakdown */}
          {analysisByCategory.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Despesas por Categoria</p>
              {analysisByCategory.map(({ name, total }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-44 truncate">{name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${analysisTotalExpenses > 0 ? Math.min(100, (total / analysisTotalExpenses) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums w-24 text-right">{formatCurrency(total)}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {analysisTotalExpenses > 0 ? `${Math.round((total / analysisTotalExpenses) * 100)}%` : ""}
                  </span>
                </div>
              ))}
              <div className="flex justify-end pt-2 border-t border-border">
                <span className="text-sm font-bold">Total: {formatCurrency(analysisTotalExpenses)}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nenhum dado para o período selecionado.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditCard(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCard ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
          </DialogHeader>
          <CardForm
            initial={editCard}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditCard(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
