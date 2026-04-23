import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useListCommitmentTypes,
  useCreateCommitmentType,
  useUpdateCommitmentType,
  useDeleteCommitmentType,
  type Category,
  type CommitmentType,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORY_ICONS = ["💰","💳","🏠","🚗","🍔","🎮","✈️","🏥","📚","🛒","💡","📱","🎵","🐾","🏋️","💼","🎁","🔧","💊","🌿"];

type CategoryType = "expense" | "income" | "both";

interface CategoryFormData {
  name: string;
  color: string;
  icon: string | null;
  type: CategoryType;
  isActive: boolean;
}

function CategoryForm({ initial, onSave, onCancel }: {
  initial?: Category | null;
  onSave: (data: CategoryFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CategoryFormData>({
    name: initial?.name ?? "",
    color: initial?.color ?? "#6366f1",
    icon: initial?.icon ?? null,
    type: (initial?.type as CategoryType) ?? "expense",
    isActive: initial?.isActive ?? true,
  });

  const typeLabels: Record<CategoryType, string> = {
    expense: "Despesa",
    income: "Receita",
    both: "Ambos",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Alimentação" />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as CategoryType }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(typeLabels) as [CategoryType, string][]).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Cor</Label>
          <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <Label>Ícone (opcional)</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {CATEGORY_ICONS.map(icon => (
              <button
                key={icon}
                type="button"
                className={`text-xl p-1 rounded hover:bg-muted ${form.icon === icon ? "bg-primary/20 ring-1 ring-primary" : ""}`}
                onClick={() => setForm(f => ({ ...f, icon: f.icon === icon ? null : icon }))}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
          <Label>Categoria ativa</Label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name}>Salvar</Button>
      </div>
    </div>
  );
}

interface CommitmentTypeFormData {
  name: string;
  isActive: boolean;
}

function CommitmentTypeForm({ initial, onSave, onCancel }: {
  initial?: CommitmentType | null;
  onSave: (data: CommitmentTypeFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CommitmentTypeFormData>({
    name: initial?.name ?? "",
    isActive: initial?.isActive ?? true,
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Nome</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Boleto, Pix..." />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
        <Label>Ativo</Label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name}>Salvar</Button>
      </div>
    </div>
  );
}

function CategoriesTab({ profileId }: { profileId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  const { data: categories, isLoading } = useListCategories({ profileId });
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const handleSave = async (data: CategoryFormData) => {
    try {
      if (editCategory) {
        await updateCategory.mutateAsync({ id: editCategory.id, data: data as Parameters<typeof updateCategory.mutateAsync>[0]["data"] });
        toast({ title: "Categoria atualizada" });
      } else {
        await createCategory.mutateAsync({ data: { ...data, profileId } as Parameters<typeof createCategory.mutateAsync>[0]["data"] });
        toast({ title: "Categoria criada" });
      }
      qc.invalidateQueries();
      setShowForm(false);
      setEditCategory(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta categoria?")) return;
    await deleteCategory.mutateAsync({ id });
    qc.invalidateQueries();
  };

  const typeLabel = (t: string) => t === "expense" ? "Despesa" : t === "income" ? "Receita" : "Ambos";

  const renderTypeBadge = (t: string) => {
    const className =
      t === "expense"
        ? "text-[10px] py-0 border-red-500/40 text-red-500 bg-red-500/10"
        : t === "income"
        ? "text-[10px] py-0 border-green-500/40 text-green-600 bg-green-500/10"
        : "text-[10px] py-0";
    return (
      <Badge variant="outline" className={className}>
        {typeLabel(t)}
      </Badge>
    );
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{categories?.length ?? 0} categorias</p>
        <Button onClick={() => { setEditCategory(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Categoria
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          <p className="text-muted-foreground col-span-3">Carregando...</p>
        ) : categories?.map(cat => (
          <Card key={cat.id} className={!cat.isActive ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: cat.color ?? "#6366f1" }}
                >
                  {cat.icon ?? "🏷️"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-medium text-sm">{cat.name}</p>
                    {cat.isDefault && <Badge variant="secondary" className="text-xs py-0">Padrão</Badge>}
                    {!cat.isActive && <Badge variant="outline" className="text-xs py-0">Inativa</Badge>}
                  </div>
                  <div className="mt-1">{renderTypeBadge(cat.type)}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditCategory(cat); setShowForm(true); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                {!cat.isDefault && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(cat.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!categories || categories.length === 0) && (
          <p className="text-muted-foreground col-span-3 py-6 text-center">Nenhuma categoria encontrada.</p>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditCategory(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
          <CategoryForm
            initial={editCategory}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditCategory(null); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommitmentTypesTab({ profileId }: { profileId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editType, setEditType] = useState<CommitmentType | null>(null);

  const { data: commitmentTypes, isLoading } = useListCommitmentTypes({ profileId });
  const createType = useCreateCommitmentType();
  const updateType = useUpdateCommitmentType();
  const deleteType = useDeleteCommitmentType();

  const handleSave = async (data: CommitmentTypeFormData) => {
    try {
      if (editType) {
        await updateType.mutateAsync({ id: editType.id, data: data as Parameters<typeof updateType.mutateAsync>[0]["data"] });
        toast({ title: "Tipo atualizado" });
      } else {
        await createType.mutateAsync({ data: { ...data, profileId } as Parameters<typeof createType.mutateAsync>[0]["data"] });
        toast({ title: "Tipo criado" });
      }
      qc.invalidateQueries();
      setShowForm(false);
      setEditType(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este tipo de compromisso?")) return;
    await deleteType.mutateAsync({ id });
    qc.invalidateQueries();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{commitmentTypes?.length ?? 0} tipos</p>
        <Button onClick={() => { setEditType(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Tipo
        </Button>
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
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commitmentTypes?.map(ct => (
                  <TableRow key={ct.id} className={!ct.isActive ? "opacity-60" : ""}>
                    <TableCell className="font-medium text-sm">
                      {ct.name}
                      {ct.isDefault && <Badge variant="secondary" className="ml-2 text-xs">Padrão</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ct.isActive ? "default" : "outline"}>
                        {ct.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditType(ct); setShowForm(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        {!ct.isDefault && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(ct.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!commitmentTypes || commitmentTypes.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum tipo cadastrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditType(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editType ? "Editar Tipo" : "Novo Tipo de Compromisso"}</DialogTitle></DialogHeader>
          <CommitmentTypeForm
            initial={editType}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditType(null); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CategoriesPage() {
  const { activeProfileId } = useProfile();

  if (!activeProfileId) return <p className="text-muted-foreground">Selecione um perfil.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categorias</h1>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="commitment-types">Tipos de Compromisso</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="pt-4">
          <CategoriesTab profileId={activeProfileId} />
        </TabsContent>
        <TabsContent value="commitment-types" className="pt-4">
          <CommitmentTypesTab profileId={activeProfileId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
