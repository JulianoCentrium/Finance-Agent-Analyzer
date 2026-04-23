import { db, categoriesTable, commitmentTypesTable } from "@workspace/db";

interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
  type: "expense" | "income" | "both";
}

interface DefaultCommitmentType {
  name: string;
  description: string;
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Alimentação", color: "#ef4444", icon: "🍔", type: "expense" },
  { name: "Supermercado", color: "#f97316", icon: "🛒", type: "expense" },
  { name: "Restaurante", color: "#eab308", icon: "🍽️", type: "expense" },
  { name: "Transporte", color: "#3b82f6", icon: "🚗", type: "expense" },
  { name: "Combustível", color: "#6366f1", icon: "⛽", type: "expense" },
  { name: "Saúde", color: "#10b981", icon: "🏥", type: "expense" },
  { name: "Farmácia", color: "#14b8a6", icon: "💊", type: "expense" },
  { name: "Moradia", color: "#8b5cf6", icon: "🏠", type: "expense" },
  { name: "Lazer", color: "#ec4899", icon: "🎮", type: "expense" },
  { name: "Educação", color: "#0ea5e9", icon: "📚", type: "expense" },
  { name: "Vestuário", color: "#f59e0b", icon: "👗", type: "expense" },
  { name: "Serviços", color: "#64748b", icon: "🔧", type: "expense" },
  { name: "Salário", color: "#22c55e", icon: "💰", type: "income" },
  { name: "Freelance", color: "#84cc16", icon: "💻", type: "income" },
  { name: "Investimentos", color: "#06b6d4", icon: "📈", type: "income" },
  { name: "Outros", color: "#94a3b8", icon: "📦", type: "both" },
];

const DEFAULT_COMMITMENT_TYPES: DefaultCommitmentType[] = [
  { name: "À Vista", description: "Pagamento imediato, sem parcelamento" },
  { name: "Parcelado", description: "Pagamento dividido em parcelas" },
  { name: "Recorrente", description: "Compromisso que se repete automaticamente" },
  { name: "Temporário", description: "Válido por período determinado" },
  { name: "Eventual", description: "Ocorre esporadicamente, sem periodicidade fixa" },
  { name: "Fixo", description: "Valor e data fixos a cada período" },
  { name: "Variável", description: "Valor ou data variam a cada período" },
  { name: "Anual", description: "Ocorre uma vez por ano" },
  { name: "Semestral", description: "Ocorre duas vezes por ano" },
  { name: "Ajuste", description: "Correção ou ajuste de valor" },
  { name: "Estorno", description: "Devolução ou cancelamento de cobrança" },
];

export async function seedDefaultData(profileId: number): Promise<void> {
  const categoryValues = DEFAULT_CATEGORIES.map(c => ({ ...c, profileId }));
  const commitmentTypeValues = DEFAULT_COMMITMENT_TYPES.map(ct => ({ ...ct, profileId }));

  await Promise.all([
    db.insert(categoriesTable).values(categoryValues),
    db.insert(commitmentTypesTable).values(commitmentTypeValues),
  ]);
}
