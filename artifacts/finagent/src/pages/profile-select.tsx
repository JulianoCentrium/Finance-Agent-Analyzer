import { useState } from "react";
import { useProfile } from "../contexts/ProfileContext";
import { UserButton } from "@clerk/react";
import {
  useUpdateProfile,
  useDeleteProfile,
  useCreateProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pencil, Archive, ArchiveRestore, Trash2, Plus, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileLite {
  id: number;
  name: string;
  isDefault: boolean;
  status: "active" | "archived";
}

export default function ProfileSelectPage() {
  const { profiles, setActiveProfileId } = useProfile();
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();
  const createProfile = useCreateProfile();

  const [showArchived, setShowArchived] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ProfileLite | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProfileLite | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  const list = profiles as ProfileLite[];
  const visible = list.filter(p => (showArchived ? p.status === "archived" : p.status !== "archived"));

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast({ title: "Nome não pode ser vazio", variant: "destructive" });
      return;
    }
    if (list.some(p => p.id !== renameTarget.id && p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Já existe outro perfil com esse nome", variant: "destructive" });
      return;
    }
    try {
      await updateProfile.mutateAsync({ id: renameTarget.id, data: { name: trimmed } });
      qc.invalidateQueries();
      toast({ title: "Perfil renomeado" });
      setRenameTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao renomear";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleArchive = async (profile: ProfileLite) => {
    const next = profile.status === "archived" ? "active" : "archived";
    try {
      await updateProfile.mutateAsync({ id: profile.id, data: { status: next } });
      qc.invalidateQueries();
      toast({ title: next === "archived" ? "Perfil arquivado" : "Perfil reativado" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar status";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfile.mutateAsync({ id: deleteTarget.id });
      qc.invalidateQueries();
      toast({ title: "Perfil excluído" });
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir perfil";
      toast({
        title: "Não foi possível excluir",
        description: msg.includes("dados financeiros")
          ? "Este perfil possui dados financeiros e não pode ser excluído. Considere arquivá-lo."
          : msg,
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    const trimmed = createName.trim();
    if (!trimmed) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (list.some(p => p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Já existe um perfil com esse nome", variant: "destructive" });
      return;
    }
    try {
      await createProfile.mutateAsync({ data: { name: trimmed, isDefault: false } });
      qc.invalidateQueries();
      toast({ title: "Perfil criado" });
      setCreateOpen(false);
      setCreateName("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar perfil";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Selecionar Perfil</h1>
            <p className="text-muted-foreground mt-1 text-sm">Escolha um perfil ou gerencie seus perfis</p>
          </div>
          <UserButton />
        </div>

        <div className="flex justify-between items-center mb-3">
          <div className="flex gap-2">
            <Button
              variant={!showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(false)}
            >
              Ativos ({list.filter(p => p.status !== "archived").length})
            </Button>
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(true)}
            >
              Arquivados ({list.filter(p => p.status === "archived").length})
            </Button>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>

        <div className="space-y-2">
          {visible.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border rounded-lg">
              {showArchived ? "Nenhum perfil arquivado." : "Nenhum perfil ativo. Crie um novo."}
            </div>
          )}
          {visible.map(profile => (
            <div
              key={profile.id}
              className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
            >
              <button
                disabled={profile.status === "archived"}
                onClick={() => profile.status !== "archived" && setActiveProfileId(profile.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {profile.name}
                    {profile.isDefault && <Badge variant="secondary" className="text-[10px]">padrão</Badge>}
                    {profile.status === "archived" && (
                      <Badge variant="outline" className="text-[10px]">arquivado</Badge>
                    )}
                  </div>
                </div>
                {profile.status !== "archived" && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setRenameTarget(profile);
                    setRenameValue(profile.name);
                  }}
                  title="Renomear"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleArchive(profile)}
                  title={profile.status === "archived" ? "Reativar" : "Arquivar"}
                >
                  {profile.status === "archived" ? (
                    <ArchiveRestore className="w-3.5 h-3.5" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:text-destructive"
                  onClick={() => setDeleteTarget(profile)}
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={open => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Perfil</DialogTitle>
            <DialogDescription>Defina um novo nome para este perfil.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRename(); }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancelar</Button>
              <Button onClick={handleRename} disabled={updateProfile.isPending || !renameValue.trim()}>
                {updateProfile.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este perfil? Esta ação removerá todos os dados associados.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3 pt-2">
              <div className="text-sm bg-muted/50 p-3 rounded">
                <strong>{deleteTarget.name}</strong>
                <p className="text-xs text-muted-foreground mt-1">
                  Se este perfil contiver lançamentos, contas, cartões ou parcelas, a exclusão será bloqueada
                  por segurança — neste caso, prefira <em>arquivar</em>.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteProfile.isPending}>
                  {deleteProfile.isPending ? "Excluindo..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Perfil</DialogTitle>
            <DialogDescription>Crie um novo perfil financeiro independente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                placeholder="Ex.: Pessoal, Empresa, Família"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createProfile.isPending || !createName.trim()}>
                {createProfile.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
