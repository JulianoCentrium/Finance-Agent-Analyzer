import { useState, useMemo } from "react";
import { useProfile } from "../contexts/ProfileContext";
import {
  useListAccountsPayable,
  useCreateAccountPayable,
  useUpdateAccountPayable,
  useDeleteAccountPayable,
  usePayAccountPayable,
  getAccountPayableRecurrenceInfo,
  useListCategories,
  useListCommitmentTypes,
  useListPersons,
  useListBankAccounts,
  type AccountPayable,
  type AccountPayableStatus,
} from "@workspace/api-client-react";

import { formatCurrency, formatDate, statusLabel, statusVariant, currentYearMonth } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "@/components/ui/category-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface PayableFormData {
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  natureza: "manual" | "card" | "financing" | null;
  categoryId: number | null;
  commitmentTypeId: number | null;
  personId: number | null;
  bankAccountId: number | null;
  notes: string;
  recurrent: boolean;
  repeatMonths: number;
}

function PayableForm({ initial, profileId, onSave, onCancel }: {
  initial?: AccountPayable | null;
  profileId: number;
  onSave: (data: PayableFormData) => void;
  onCancel: () => void;
}) {
  const { year, month } = currentYearMonth();
  const [form, setForm] = useState<PayableFormData>({
    description: initial?.description ?? "",
    amount: initial?.amount ?? 0,
    dueDate: initial?.dueDate
      ? String(initial.dueDate).split("T")[0]
      : `${year}-${String(month).padStart(2, "0")}-10`,
    status: initial?.status ?? "open",
    natureza: (initial?.natureza as PayableFormData["natureza"]) ?? "manual",
    categoryId: initial?.categoryId ?? null,
    commitmentTypeId: initial?.commitmentTypeId ?? null,
    personId: initial?.personId ?? null,
    bankAccountId: initial?.bankAccountId ?? null,
    notes: initial?.notes ?? "",
    recurrent: initial?.recurrent ?? false,
    repeatMonths: 1,
  });

  const { data: categories } = useListCategories({ profileId });
  const { data: commitmentTypes } = useListCommitmentTypes({ profileId });
  const { data: persons } = useListPersons({ profileId });
  const { data: bankAccounts } = useListBankAccounts({ profileId });

  const isEdit = !!initial;

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Descrição</Label>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Aluguel" />
        </div>
        <div>
          <Label>Natureza</Label>
          <Select value={form.natureza ?? "manual"} onValueChange={v => setForm(f => ({ ...f, natureza: v as PayableFormData["natureza"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Digitado</SelectItem>
              <SelectItem value="card">Cartão</SelectItem>
              <SelectItem value="financing">Financiamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <CurrencyInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
        </div>
        <div>
          <Label>Vencimento</Label>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </div>
        <div>
          <Label>Categoria</Label>
          <CategoryPicker
            categories={categories?.filter(c => c.isActive !== false && (c.type === "expense" || c.type === "both")) ?? []}
            value={form.categoryId}
            onChange={v => setForm(f => ({ ...f, categoryId: v }))}
            placeholder="Nenhuma"
          />
        </div>
        <div>
          <Label>Tipo de Compromisso</Label>
          <Select value={form.commitmentTypeId != null ? String(form.commitmentTypeId) : "__none__"} onValueChange={v => setForm(f => ({ ...f, commitmentTypeId: v === "__none__" ? null : Number(v) }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {commitmentTypes?.filter(c => c.isActive !== false).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Pessoa/Empresa</Label>
          <Select value={form.personId != null ? String(form.personId) : "__none__"} onValueChange={v => setForm(f => ({ ...f, personId: v === "__none__" ? null : Number(v) }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhuma</SelectItem>
              {persons?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Conta Bancária</Label>
          <Select value={form.bankAccountId != null ? String(form.bankAccountId) : "__none__"} onValueChange={v => setForm(f => ({ ...f, bankAccountId: v === "__none__" ? null : Number(v) }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhuma</SelectItem>
              {bankAccounts?.filter(b => b.isActive).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Observações</Label>
          <Input value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        {!isEdit && (
          <>
            <div className="col-span-2 flex items-center gap-3 pt-1 border-t border-border">
              <Switch checked={form.recurrent} onCheckedChange={v => setForm(f => ({ ...f, recurrent: v, repeatMonths: v ? (f.repeatMonths > 1 ? f.repeatMonths : 12) : 1 }))} />
              <Label>Repetir mensalmente</Label>
            </div>
            {(form.recurrent || form.repeatMonths > 1) && (
              <div className="col-span-2">
                <Label>Quantidade de meses</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={form.repeatMonths}
                  onChange={e => setForm(f => ({ ...f, repeatMonths: Math.max(1, Math.min(60, Number(e.target.value))) }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Serão gerados {form.repeatMonths} lançamentos mensais a partir da data de vencimento.</p>
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.description}>Salvar</Button>
      </div>
    </div>
  );
}

function PayModal({ item, profileId, onClose }: { item: AccountPayable; profileId: number; onClose: () => void }) {
  const payMutation = usePayAccountPayable();
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [paidAt, setPaidAt] = useState(today);
  const [paidAmount, setPaidAmount] = useState(item.amount);
  const [bankAccountId, setBankAccountId] = useState<number | null>(item.bankAccountId ?? null);

  const { data: bankAccounts } = useListBankAccounts({ profileId });

  const handlePay = async () => {
    if (bankAccountId == null) {
      toast({ title: "Selecione a conta bancária a ser debitada.", variant: "destructive" });
      return;
    }
    try {
      await payMutation.mutateAsync({ id: item.id, data: { paidAt, paidAmount, bankAccountId } });
      toast({ title: "Pagamento registrado!" });
      qc.invalidateQueries();
      onClose();
    } catch {
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{item.description}</p>
        <div>
          <Label>Data do Pagamento</Label>
          <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
        </div>
        <div>
          <Label>Valor Pago (R$)</Label>
          <CurrencyInput value={paidAmount} onChange={setPaidAmount} />
        </div>
        <div>
          <Label>Conta Bancária (débito) <span className="text-destructive">*</span></Label>
          <Select value={bankAccountId != null ? String(bankAccountId) : "__none__"} onValueChange={v => setBankAccountId(v === "__none__" ? null : Number(v))}>
            <SelectTrigger className={bankAccountId == null ? "border-destructive" : ""}><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Selecionar...</SelectItem>
              {bankAccounts?.filter(b => b.isActive).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {bankAccountId == null && <p className="text-xs text-destructive mt-1">Conta bancária obrigatória para registrar o pagamento.</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handlePay} disabled={bankAccountId == null}>Confirmar Pagamento</Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function AccountsPayablePage() {
  const { activeProfileId } = useProfile();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { year, month } = currentYearMonth();

  const competencias = (() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = -24; i <= 6; i++) {
      const d = new Date(year, month - 1 + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const value = `${y}-${String(m).padStart(2, "0")}`;
      const label = `${String(m).padStart(2, "0")}/${y}`;
      opts.push({ value, label });
    }
    return opts.reverse();
  })();

  const currentCompetencia = `${year}-${String(month).padStart(2, "0")}`;
  const [filterCompetencia, setFilterCompetencia] = useState<string>(currentCompetencia);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterCommitmentTypeId, setFilterCommitmentTypeId] = useState<string>("all");

  const filterYear = filterCompetencia !== "all" ? parseInt(filterCompetencia.split("-")[0]) : null;
  const filterMonth = filterCompetencia !== "all" ? parseInt(filterCompetencia.split("-")[1]) : null;

  const { data: items, isLoading } = useListAccountsPayable(
    {
      profileId: activeProfileId!,
      ...(filterYear ? { year: filterYear } : {}),
      ...(filterMonth ? { month: filterMonth } : {}),
      ...(filterStatus ? { status: filterStatus as AccountPayableStatus } : {}),
    },
    { query: { enabled: !!activeProfileId } }
  );

  const { data: categories } = useListCategories({ profileId: activeProfileId! }, { query: { enabled: !!activeProfileId } });
  const { data: commitmentTypes } = useListCommitmentTypes({ profileId: activeProfileId! }, { query: { enabled: !!activeProfileId } });

  const createItem = useCreateAccountPayable();
  const updateItem = useUpdateAccountPayable();
  const deleteItem = useDeleteAccountPayable();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<AccountPayable | null>(null);
  const [payItem, setPayItem] = useState<AccountPayable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ item: AccountPayable; recurrenceGroupId: string | null; futureCount: number } | null>(null);

  const handleSave = async (data: PayableFormData) => {
    try {
      const { repeatMonths, ...baseData } = data;
      if (editItem) {
        await updateItem.mutateAsync({ id: editItem.id, data: baseData as Parameters<typeof updateItem.mutateAsync>[0]["data"] });
        toast({ title: "Conta atualizada" });
      } else {
        await createItem.mutateAsync({ data: { ...baseData, profileId: activeProfileId!, repeatMonths } as Parameters<typeof createItem.mutateAsync>[0]["data"] });
        const msg = repeatMonths > 1 ? `${repeatMonths} lançamentos criados!` : "Conta criada";
        toast({ title: msg });
      }
      qc.invalidateQueries();
      setShowForm(false);
      setEditItem(null);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({ title: apiMsg ?? "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDeleteClick = async (item: AccountPayable) => {
    try {
      const info = await getAccountPayableRecurrenceInfo(item.id);
      setDeleteTarget({ item, recurrenceGroupId: info.recurrenceGroupId, futureCount: info.futureCount });
    } catch {
      toast({
        title: "Não foi possível verificar o parcelamento desta conta. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteItem.mutateAsync({ id: deleteTarget.item.id });
      qc.invalidateQueries();
      const isSeries = deleteTarget.recurrenceGroupId !== null;
      const msg = isSeries
        ? `Conta excluída${deleteTarget.futureCount > 0 ? ` junto com ${deleteTarget.futureCount} parcela(s) futura(s)` : ""}.`
        : "Conta excluída";
      toast({ title: msg });
    } catch {
      toast({ title: "Erro ao excluir conta", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredItems = (items ?? []).filter(item => {
    const matchesSearch = !filterSearch || item.description.toLowerCase().includes(filterSearch.toLowerCase());
    const matchesCategory = filterCategoryId === "all" || String(item.categoryId ?? "") === filterCategoryId;
    const matchesCommitmentType =
      filterCommitmentTypeId === "all" || String(item.commitmentTypeId ?? "") === filterCommitmentTypeId;
    return matchesSearch && matchesCategory && matchesCommitmentType;
  });

  const totals = useMemo(() => {
    const list = filteredItems ?? [];
    const sum = (fn?: (i: typeof list[0]) => boolean) =>
      list.filter(fn ?? (() => true)).reduce((s, i) => s + Number(i.amount), 0);
    const count = (fn?: (i: typeof list[0]) => boolean) =>
      list.filter(fn ?? (() => true)).length;
    return {
      total: sum(),
      totalCount: count(),
      open: sum(i => i.status === "open"),
      openCount: count(i => i.status === "open"),
      overdue: sum(i => i.status === "overdue"),
      overdueCount: count(i => i.status === "overdue"),
      paid: sum(i => i.status === "paid"),
      paidCount: count(i => i.status === "paid"),
    };
  }, [filteredItems]);

  if (!activeProfileId) return <p className="text-muted-foreground">Selecione um perfil.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Contas a Pagar</h1>
        <Button onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Conta
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Pesquisar descrição..."
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="h-9 w-52"
        />
        <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories?.filter(c => c.isActive !== false).map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCommitmentTypeId} onValueChange={setFilterCommitmentTypeId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Tipo de Compromisso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {commitmentTypes?.filter(c => c.isActive !== false).map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCompetencia} onValueChange={setFilterCompetencia}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {competencias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totals.total)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totals.totalCount} lançamento(s)</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase tracking-wide mb-1">Em Aberto</p>
            <p className="text-lg font-bold tabular-nums text-yellow-600 dark:text-yellow-400">{formatCurrency(totals.open)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totals.openCount} lançamento(s)</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-xs text-destructive uppercase tracking-wide mb-1">Vencido</p>
            <p className="text-lg font-bold tabular-nums text-destructive">{formatCurrency(totals.overdue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totals.overdueCount} lançamento(s)</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Pago</p>
            <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{formatCurrency(totals.paid)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totals.paidCount} lançamento(s)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground p-6">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems?.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.description}</p>
                        {item.personName && <p className="text-xs text-muted-foreground">{item.personName}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(item.dueDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.categoryName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {(item.status === "open" || item.status === "overdue") && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-400"
                            onClick={() => setPayItem(item)} title="Registrar pagamento">
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditItem(item); setShowForm(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                          onClick={() => handleDeleteClick(item)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredItems || filteredItems.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {filterSearch ? "Nenhum resultado para a pesquisa." : "Nenhuma conta encontrada."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditItem(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Editar Conta" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader>
          <PayableForm
            initial={editItem}
            profileId={activeProfileId}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditItem(null); }}
          />
        </DialogContent>
      </Dialog>

      {payItem && (
        <Dialog open={!!payItem} onOpenChange={open => { if (!open) setPayItem(null); }}>
          <PayModal item={payItem} profileId={activeProfileId} onClose={() => setPayItem(null)} />
        </Dialog>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.recurrenceGroupId !== null ? (
                <>
                  Esta conta faz parte de uma série parcelada. Ao confirmar, esta parcela será excluída
                  {deleteTarget.futureCount > 0 ? (
                    <> junto com <strong>{deleteTarget.futureCount} parcela(s) futura(s)</strong> em aberto da mesma série.</>
                  ) : (
                    <>. Nenhuma outra parcela futura em aberto será afetada.</>
                  )}
                  {" "}Parcelas já pagas e parcelas com vencimento anterior a hoje não serão afetadas.
                </>
              ) : (
                <>Esta ação não pode ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {deleteTarget && deleteTarget.recurrenceGroupId !== null && deleteTarget.futureCount > 0
                ? `Excluir esta e ${deleteTarget.futureCount} futura(s)`
                : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
