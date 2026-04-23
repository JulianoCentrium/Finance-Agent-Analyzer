/**
 * Parsers for CSV and OFX import files.
 * Supports Nubank-style CSV (date,title,amount) and standard PT-BR CSV.
 * OFX with SGML tags.
 */

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  installmentNumber?: number;
  totalInstallments?: number;
  isInstallment: boolean;
}

const INSTALLMENT_REGEX = /(?:PARC|PAR\.?|PARCELA)\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})|(\d{1,2})\s*\/\s*(\d{1,2})/i;

function detectInstallment(description: string): { installmentNumber?: number; totalInstallments?: number; isInstallment: boolean } {
  const match = INSTALLMENT_REGEX.exec(description);
  if (!match) return { isInstallment: false };
  const num = parseInt(match[1] || match[3], 10);
  const total = parseInt(match[2] || match[4], 10);
  if (isNaN(num) || isNaN(total) || total <= 1) return { isInstallment: false };
  return { installmentNumber: num, totalInstallments: total, isInstallment: true };
}

function parseDate(raw: string): string {
  // Accepts: DD/MM/YYYY, YYYY-MM-DD, YYYYMMDD
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  // OFX: 20260415000000[-03:BRT]
  const ofxMatch = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`;
  }
  throw new Error(`Cannot parse date: ${raw}`);
}

function parseAmount(raw: string): number {
  // Remove BOM, trim
  raw = raw.replace(/^\uFEFF/, '').trim();
  // Brazilian format: 1.234,56 -> 1234.56
  if (/[\d]+\.[\d]+,[\d]+/.test(raw)) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (/[\d]+,[\d]+/.test(raw)) {
    raw = raw.replace(',', '.');
  }
  const val = parseFloat(raw);
  if (isNaN(val)) throw new Error(`Cannot parse amount: ${raw}`);
  return val;
}

export function parseCSV(content: string): ParsedTransaction[] {
  // Remove BOM
  content = content.replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const headerLine = lines[0].toLowerCase();
  const separator = headerLine.includes(';') ? ';' : ',';
  const header = headerLine.split(separator).map(h => h.trim().replace(/"/g, ''));

  // Detect columns
  const dateIdx = header.findIndex(h => h.includes('date') || h.includes('data'));
  const descIdx = header.findIndex(h => h.includes('title') || h.includes('description') || h.includes('lançamento') || h.includes('lancamento') || h.includes('descricao') || h.includes('descrição'));
  const amtIdx = header.findIndex(h => h.includes('amount') || h.includes('valor'));

  if (dateIdx < 0 || descIdx < 0 || amtIdx < 0) {
    throw new Error(`Cannot detect CSV columns. Headers: ${header.join(', ')}`);
  }

  const results: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(separator).map(p => p.trim().replace(/"/g, ''));
    if (parts.length <= Math.max(dateIdx, descIdx, amtIdx)) continue;
    try {
      const dateRaw = parts[dateIdx];
      const desc = parts[descIdx].toUpperCase();
      const amtRaw = parts[amtIdx];
      if (!dateRaw || !desc || !amtRaw) continue;
      const date = parseDate(dateRaw);
      const amount = parseAmount(amtRaw);
      // Skip credit card operational entries (payments, refunds, reversals)
      if (
        desc.includes('PAGAMENTO RECEBIDO') ||
        desc.includes('PAGAMENTO DEBITO AUTOMATICO') ||
        desc.includes('ESTORNO')
      ) continue;
      const { installmentNumber, totalInstallments, isInstallment } = detectInstallment(desc);
      results.push({ date, description: desc, amount, installmentNumber, totalInstallments, isInstallment });
    } catch {
      // skip malformed rows
    }
  }
  return results;
}

export function parseOFX(content: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  // Match STMTTRN blocks
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;
  while ((match = txRegex.exec(content)) !== null) {
    const block = match[1];
    const dtPosted = /<DTPOSTED>(.*?)(?:<|\n|$)/i.exec(block)?.[1]?.trim();
    const memo = /<MEMO>(.*?)(?:<|\n|$)/i.exec(block)?.[1]?.trim() || '';
    const name = /<NAME>(.*?)(?:<|\n|$)/i.exec(block)?.[1]?.trim() || '';
    const trnAmt = /<TRNAMT>(.*?)(?:<|\n|$)/i.exec(block)?.[1]?.trim();
    if (!dtPosted || !trnAmt) continue;
    try {
      const date = parseDate(dtPosted);
      const amount = parseAmount(trnAmt);
      const description = (memo || name).toUpperCase();
      const { installmentNumber, totalInstallments, isInstallment } = detectInstallment(description);
      results.push({ date, description, amount, installmentNumber, totalInstallments, isInstallment });
    } catch {
      // skip
    }
  }
  return results;
}
