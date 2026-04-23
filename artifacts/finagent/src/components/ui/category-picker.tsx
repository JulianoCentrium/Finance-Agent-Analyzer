import { useState } from "react";
import { Check, ChevronDown, Plus, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = "Sem categoria",
  triggerClassName,
  onCreate,
}: {
  categories: { id: number; name: string }[];
  value: number | null;
  onChange: (categoryId: number | null) => void;
  placeholder?: string;
  triggerClassName?: string;
  onCreate?: (name: string) => Promise<number>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = categories.find(c => c.id === value);

  const trimmed = search.trim();
  const hasExactMatch = trimmed.length > 0
    && categories.some(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
  const showCreate = !!onCreate && trimmed.length > 0 && !hasExactMatch;

  const handleCreate = async () => {
    if (!onCreate || !trimmed) return;
    setCreating(true);
    try {
      const newId = await onCreate(trimmed);
      onChange(newId);
      setSearch("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          className={triggerClassName ?? "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"}
          role="combobox"
          aria-expanded={open}
          type="button"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 max-w-[90vw] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar categoria..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!showCreate && <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>}
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => { onChange(null); setOpen(false); }}
              >
                <Check className={`mr-2 h-4 w-4 ${value === null ? "opacity-100" : "opacity-0"}`} />
                {placeholder}
              </CommandItem>
              {categories.map(c => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === c.id ? "opacity-100" : "opacity-0"}`} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup forceMount>
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={handleCreate}
                  disabled={creating}
                  forceMount
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Criar "{trimmed}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
