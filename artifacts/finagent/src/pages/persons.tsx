import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import {
  useListPersons,
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
  type Person,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, User, Building2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface PersonFormData {
  name: string;
  type: string;
  document: string;
  email: string;
  phone: string;
  zipCode: string;
  street: string;
  streetNumber: string;
  complement: string;
  notes: string;
}

function formatCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCNPJ(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function PersonForm({ initial, onSave, onCancel }: {
  initial?: Person | null;
  onSave: (data: PersonFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PersonFormData>({
    name: initial?.name ?? "",
    type: initial?.type ?? "person",
    document: initial?.document ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    zipCode: initial?.zipCode ?? "",
    street: initial?.street ?? "",
    streetNumber: initial?.streetNumber ?? "",
    complement: initial?.complement ?? "",
    notes: initial?.notes ?? "",
  });

  const handleDocumentChange = (v: string) => {
    const formatted = form.type === "company" ? formatCNPJ(v) : formatCPF(v);
    setForm(f => ({ ...f, document: formatted }));
  };

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo ou razão social" />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, document: "" }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="person">Pessoa Física</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{form.type === "company" ? "CNPJ" : "CPF"}</Label>
          <Input
            value={form.document}
            onChange={e => handleDocumentChange(e.target.value)}
            placeholder={form.type === "company" ? "00.000.000/0000-00" : "000.000.000-00"}
          />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
        </div>

        <div className="col-span-2">
          <p className="text-sm font-medium text-muted-foreground mb-2 mt-1">Endereço</p>
        </div>
        <div>
          <Label>CEP</Label>
          <Input value={form.zipCode} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} placeholder="00000-000" maxLength={9} />
        </div>
        <div className="col-span-2">
          <Label>Logradouro</Label>
          <Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Rua, Av., etc." />
        </div>
        <div>
          <Label>Número</Label>
          <Input value={form.streetNumber} onChange={e => setForm(f => ({ ...f, streetNumber: e.target.value }))} placeholder="123" />
        </div>
        <div>
          <Label>Complemento</Label>
          <Input value={form.complement} onChange={e => setForm(f => ({ ...f, complement: e.target.value }))} placeholder="Apto, Sala..." />
        </div>

        <div className="col-span-2">
          <Label>Observações</Label>
          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name}>Salvar</Button>
      </div>
    </div>
  );
}

export default function PersonsPage() {
  const { activeProfileId } = useProfile();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: persons, isLoading } = useListPersons(
    { profileId: activeProfileId!, ...(search ? { search } : {}) },
    { query: { enabled: !!activeProfileId } }
  );

  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();

  const [showForm, setShowForm] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);

  const handleSave = async (data: PersonFormData) => {
    try {
      if (editPerson) {
        await updatePerson.mutateAsync({ id: editPerson.id, data: data as Parameters<typeof updatePerson.mutateAsync>[0]["data"] });
        toast({ title: "Pessoa atualizada" });
      } else {
        await createPerson.mutateAsync({ data: { ...data, profileId: activeProfileId! } as Parameters<typeof createPerson.mutateAsync>[0]["data"] });
        toast({ title: "Pessoa criada" });
      }
      qc.invalidateQueries();
      setShowForm(false);
      setEditPerson(null);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({ title: apiMsg ?? "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta pessoa?")) return;
    await deletePerson.mutateAsync({ id });
    qc.invalidateQueries();
  };

  if (!activeProfileId) return <p className="text-muted-foreground">Selecione um perfil.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pessoas e Empresas</h1>
        <Button onClick={() => { setEditPerson(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Pessoa
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou documento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground p-6">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons?.map(person => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {person.type === "company"
                          ? <Building2 className="w-4 h-4 text-muted-foreground" />
                          : <User className="w-4 h-4 text-muted-foreground" />
                        }
                        <div>
                          <span className="font-medium text-sm">{person.name}</span>
                          {person.street && (
                            <p className="text-xs text-muted-foreground">
                              {person.street}{person.streetNumber ? `, ${person.streetNumber}` : ""}{person.complement ? ` ${person.complement}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{person.type === "company" ? "Empresa" : "Pessoa"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{person.document ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {person.email ?? person.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditPerson(person); setShowForm(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                          onClick={() => handleDelete(person.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!persons || persons.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {search ? "Nenhuma pessoa encontrada." : "Nenhuma pessoa cadastrada."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditPerson(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editPerson ? "Editar Pessoa" : "Nova Pessoa"}</DialogTitle></DialogHeader>
          <PersonForm
            initial={editPerson}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditPerson(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
