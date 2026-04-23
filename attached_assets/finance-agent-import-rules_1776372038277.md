# Finance Agent — Import Rules

Versão: 1.0  
Status: Regras de Importação  
Objetivo: Definir o comportamento completo da importação de arquivos CSV/OFX.

---

# 🎯 Objetivo da Importação

Garantir que:

✔ Arquivo seja a verdade absoluta  
✔ Dados sejam consistentes  
✔ Parcelas futuras sejam recalculadas  
✔ Categorias sejam aplicadas automaticamente  
✔ Fatura mensal seja atualizada corretamente  

---

# 🧠 Princípio Fundamental

REGRA PRINCIPAL:

O arquivo importado representa o estado completo do mês.

Após a importação:
As transações do mês devem ser EXATAMENTE iguais às do arquivo.

Nunca:
- manter dados antigos do mês
- misturar dados antigos com novos

---

# 📥 Processo Geral de Importação

Fluxo completo:

1 — Usuário entra no cartão  
2 — Seleciona competência (Ano/Mês)  
   Default = mês atual  
3 — Seleciona arquivo CSV/OFX  

Sistema executa:

4 — Ler arquivo  
5 — Normalizar dados  
6 — Identificar parcelas  
7 — Substituir transações do mês  
8 — Aplicar categorias  
9 — Gerar parcelas futuras  
10 — Recalcular fatura  
11 — Atualizar conta a pagar  

---

# 📅 Seleção da Competência

Competência é escolhida manualmente.

Default:
Mês atual

Usuário pode alterar:

Abril 2026  
Maio 2025  
Janeiro 2024  

Permite:

✔ reprocessamento  
✔ importação histórica  

---

# 📄 Tipos de Arquivo Suportados

Arquivos permitidos:

CSV  
OFX  

---

# 🔍 Estrutura esperada do CSV

Campos mínimos:

Date  
Description  
Amount  

Campos opcionais:

Installment  
TotalInstallments  

Exemplo:

10/04/2026;NETFLIX;59.90  
12/04/2026;MAGAZINE LUIZA PARC 1/10;300.00  

---

# 🧠 Normalização dos Dados

Sistema executa:

✔ Remover espaços extras  
✔ Converter texto para maiúsculo  
✔ Padronizar datas  
✔ Padronizar valores  
✔ Remover caracteres inválidos  

---

# 🔁 Identificação de Parcelas

Sistema tenta detectar automaticamente.

Padrões reconhecidos:

PARC 1/10  
PAR 2/6  
1/12  
02/10  

Regex sugerido:

(\d{1,2})\/(\d{1,2})

---

# 🔧 Parcelamento Manual

Se não detectar automaticamente:

Usuário pode informar:

Número total de parcelas

Sistema:

gera parcelas futuras automaticamente

---

# 🧾 Regra — Substituição do Mês

Antes de inserir novas transações:

Sistema remove TODAS as transações da competência selecionada.

Também remove:

✔ parcelas futuras associadas  

Depois:

insere novamente.

---

# 🧠 Aplicação de CategoryRule

Após inserir transação:

Sistema busca regra:

Description CONTAINS MatchText  
AND ProfileId

Se encontrada:

Categoria aplicada automaticamente.

Se não encontrada:

Categoria = "Não Classificado"

Depois:

Usuário ajusta  
Sistema cria nova CategoryRule  

---

# 🔁 Geração de Parcelas Futuras

Se transação possuir parcelamento:

Sistema cria registros em:

Installment

Para:

Mês atual + meses futuros

---

# 🧾 Recalcular Invoice

Após inserir todas transações:

Sistema calcula:

TotalAmount = SUM(Amount)

Atualiza:

Invoice.TotalAmount

Se não existir:

Criar Invoice

---

# 💰 Atualizar Conta a Pagar

Cada Invoice gera:

1 AccountPayable

Fluxo:

Se existir:

Atualizar valor

Se não existir:

Criar novo

Status inicial:

OPEN

---

# 📋 Registro de Importação

Tabela recomendada:

ImportLog

Campos:

ImportLogId  
CardId  
Year  
Month  
FileName  
TotalRecords  
ImportedAt  
Status  

---

# ⚠️ Validações obrigatórias

Sistema valida:

✔ Arquivo válido  
✔ Datas válidas  
✔ Valores válidos  
✔ Competência selecionada  
✔ Cartão selecionado  

Se erro:

Cancelar importação  
Exibir mensagem  

---

# 📌 Status

Import Rules: ✔ DEFINIDO  
Ready for Codex: ✔ SIM
