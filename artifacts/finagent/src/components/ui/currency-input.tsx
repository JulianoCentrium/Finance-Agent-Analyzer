import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export function parseCurrency(masked: string): number {
  if (!masked) return 0;
  const negative = masked.trim().startsWith("-");
  const cleaned = masked.replace(/-/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return negative ? -n : n;
}

export function formatCurrencyMask(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function applyMask(raw: string, allowNegative: boolean): string {
  const negative = allowNegative && raw.trim().startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return negative ? "-" : "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  const formatted = reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return negative ? `-${formatted}` : formatted;
}

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  allowNegative?: boolean;
}

export function CurrencyInput({ value, onChange, placeholder, className, allowNegative = false }: CurrencyInputProps) {
  const [display, setDisplay] = useState<string>(() =>
    value !== 0 ? formatCurrencyMask(value) : ""
  );

  useEffect(() => {
    const parsed = parseCurrency(display);
    if (parsed !== value) {
      setDisplay(value !== 0 ? formatCurrencyMask(value) : "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyMask(e.target.value, allowNegative);
    setDisplay(masked);
    onChange(parseCurrency(masked));
  };

  return (
    <Input
      inputMode={allowNegative ? "text" : "numeric"}
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? "0,00"}
      className={className}
    />
  );
}
