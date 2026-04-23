import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import {
  useListBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  type BankAccount,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface BankAccountFormData {
  name: string;
  bank: string;
  accountNumber: string;
  agency: string;
  balance: number;
  color: string;
  isActive: boolean;
}

function BankAccountForm({ initial, onSave, onCancel }: {
  initial?: BankAccount | null;
  onSave: (data: BankAccountFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<BankAccountFormData>({
    name: initial?.name ?? "",
    bank: initial?.bank ?? "",
    accountNumber: initial?.accountNumber ?? "",
    agency: initial?.agency ?? "",
    balance: initial?.balance ?? 0,
    color: initial?.color ?? "#3b82f6",
    isActive: initial?.isActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome da Conta</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Conta Nubank" />
        </div>
        <div>
          <Label>Banco</Label>
          <Input value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} placeholder="Nubank, Itaú..." />
        </div>
        <div>
          <Label>Número da Conta</Label>
          <Input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="00000-0" />
        </div>
        <div>
          <Label>Agência</Label>
          <Input value={form.agency} onChange={e => setForm(f => ({ ...f, agency: e.target.value }))} placeholder="0000" />
        </div>
        <div>
          <Label>Saldo Inicial (R$)</Label>
          <CurrencyInput allowNegative value={form.balance} onChange={v => setForm(f => ({ ...f, balance: v }))} />
        </div>
        <div>
          <Label>Cor</Label>
          <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
          <Label>Conta ativa</Label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name}>Salvar</Button>
      </div>
    </div>
  );
}

export default function BankAccountsPage() {
  const { activeProfileId } = useProfile();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: accounts, isLoading } = useListBankAccounts(
    { profileId: activeProfileId! },
    { query: { enabled: !!activeProfileId } }
  );

  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const deleteAccount = useDeleteBankAccount();

  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [filterSearch, setFilterSearch] = useState("");

  const handleSave = async (data: BankAccountFormData) => {
    try {
      if (editAccount) {
        await updateAccount.mutateAsync({ id: editAccount.id, data });
        toast({ title: "Conta atualizada" });
      } else {
        await createAccount.mutateAsync({ data: { ...data, profileId: activeProfileId! } });
        toast({ title: "Conta criada" });
      }
      qc.invalidateQueries();
      setShowForm(false);
      setEditAccount(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta conta?")) return;
    await deleteAccount.mutateAsync({ id });
    qc.invalidateQueries();
    toast({ title: "Conta excluída" });
  };

  const filteredAccounts = filterSearch
    ? accounts?.filter(a =>
        a.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (a.bank ?? "").toLowerCase().includes(filterSearch.toLowerCase())
      )
    : accounts;

  const totalCurrentBalance = accounts?.reduce((s, a) => s + (a.currentBalance ?? a.balance), 0) ?? 0;

  if (!activeProfileId) return <p className="text-muted-foreground">Selecione um perfil.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground text-sm">
            Saldo total: <span className={`font-bold ${totalCurrentBalance >= 0 ? "text-green-500" : "text-red-500"}`}>{formatCurrency(totalCurrentBalance)}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Pesquisar conta..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className="h-9 w-44"
          />
          <Button onClick={() => { setEditAccount(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova Conta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts?.map(account => {
            const current = account.currentBalance ?? account.balance;
            const initial = account.balance;
            const diff = current - initial;
            return (
              <Card key={account.id} className={!account.isActive ? "opacity-60" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: account.color ?? "#3b82f6" }}
                      >
                        <Landmark className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.bank && `${account.bank}`}
                          {!account.isActive && <Badge variant="outline" className="ml-1 text-xs">Inativa</Badge>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setEditAccount(account); setShowForm(true); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                        onClick={() => handleDelete(account.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className={`text-xl font-bold ${current >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatCurrency(current)}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">saldo atual</p>
                      {diff !== 0 && (
                        <div className={`flex items-center gap-1 text-xs ${diff >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Saldo inicial: {formatCurrency(initial)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!filteredAccounts || filteredAccounts.length === 0) && (
            <p className="text-muted-foreground col-span-3 py-8 text-center">
              {filterSearch ? "Nenhum resultado para a pesquisa." : 'Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.'}
            </p>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditAccount(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAccount ? "Editar Conta" : "Nova Conta"}</DialogTitle>
          </DialogHeader>
          <BankAccountForm
            initial={editAccount}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditAccount(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
