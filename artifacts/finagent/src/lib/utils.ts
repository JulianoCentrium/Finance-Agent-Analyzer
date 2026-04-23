import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const str = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr);
  const dateOnly = str.split("T")[0];
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return str;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("pt-BR", { month: "long" });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Aberto",
    paid: "Pago",
    overdue: "Vencido",
    received: "Recebido",
    cancelled: "Cancelado",
  };
  return map[status] ?? status;
}

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    open: "secondary",
    paid: "default",
    received: "default",
    overdue: "destructive",
    cancelled: "outline",
  };
  return map[status] ?? "outline";
}

