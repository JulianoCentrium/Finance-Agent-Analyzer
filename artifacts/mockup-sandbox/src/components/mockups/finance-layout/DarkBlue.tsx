import {
  LayoutDashboard, CreditCard, ArrowDownCircle, ArrowUpCircle,
  Users, BarChart2, MessageSquare, Settings, Sun, Moon,
  Bell, ChevronDown, TrendingUp, TrendingDown, Wallet,
  CalendarClock, ChevronRight, Search
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: CreditCard, label: "Cartões de Crédito" },
  { icon: ArrowDownCircle, label: "Contas a Pagar" },
  { icon: ArrowUpCircle, label: "Contas a Receber" },
  { icon: Wallet, label: "Contas Bancárias" },
  { icon: BarChart2, label: "Relatórios" },
  { icon: Users, label: "Pessoas" },
  { icon: MessageSquare, label: "Copiloto IA" },
];

const metrics = [
  { label: "Saldo Total", value: "R$ 12.847,30", sub: "+R$ 1.230 este mês", trend: "up", icon: Wallet, color: "text-blue-400", bg: "bg-blue-500/20" },
  { label: "Entradas do Mês", value: "R$ 8.500,00", sub: "3 recebimentos", trend: "up", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/20" },
  { label: "Saídas do Mês", value: "R$ 7.269,70", sub: "42 lançamentos", trend: "down", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/20" },
  { label: "Parcelas Futuras", value: "R$ 4.312,88", sub: "Próximos 3 meses", trend: "neutral", icon: CalendarClock, color: "text-amber-400", bg: "bg-amber-500/20" },
];

const transactions = [
  { date: "15/04", description: "PIX Priscila Rosin", category: "Transferência", card: "Sicredi", value: -1806.41, type: "pagar" },
  { date: "14/04", description: "Dl*Google Premie", category: "Assinaturas Digitais", card: "Nubank", value: -29.90, type: "cartao" },
  { date: "13/04", description: "Angeloni Super Loja", category: "Supermercado", card: "Nubank", value: -36.96, type: "cartao" },
  { date: "13/04", description: "Elite Comércio de Veíc.", category: "Manutenção do Veículo", card: "Sicredi", value: -231.34, type: "cartao" },
  { date: "12/04", description: "Salário Abril", category: "Receita", card: "—", value: 8500.00, type: "receber" },
  { date: "11/04", description: "Plano de Saúde", category: "Saúde", card: "—", value: -485.00, type: "pagar" },
  { date: "10/04", description: "Paladio Joalher 3/12", category: "Compras Parceladas", card: "Nubank", value: -366.33, type: "cartao" },
];

const cards = [
  { name: "Nubank", limit: "R$ 15.000", used: "R$ 4.961,31", pct: 33, color: "bg-purple-600" },
  { name: "Sicredi Visa", limit: "R$ 8.000", used: "R$ 2.834,70", pct: 35, color: "bg-blue-600" },
];

export function DarkBlue() {
  return (
    <div className="flex h-screen font-sans overflow-hidden text-sm" style={{ background: "#0f1117" }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: "#0d1b2e" }}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500/30 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">CO-Finance</div>
              <div className="text-blue-400 text-xs">Perfil: Família</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                item.active
                  ? "bg-blue-500/20 text-blue-400 font-medium border border-blue-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-white/10 space-y-0.5">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200 text-left">
            <Settings className="w-4 h-4" />
            <span className="text-xs">Configurações</span>
          </button>
          {/* Theme toggle */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Sun className="w-4 h-4 text-slate-500" />
            <div className="flex-1 h-5 bg-blue-500/30 rounded-full relative cursor-pointer border border-blue-500/30">
              <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-blue-400 rounded-full shadow" />
            </div>
            <Moon className="w-4 h-4 text-blue-400" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-12 border-b flex items-center justify-between px-5 flex-shrink-0" style={{ background: "#0f1117", borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <span className="text-slate-600">CO-Finance</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-300 font-medium">Dashboard</span>
            <span className="ml-3 text-slate-600">Abril 2026</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                className="rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-400 w-44 outline-none border border-white/10"
                style={{ background: "#1a1f2e" }}
                placeholder="Buscar lançamentos..."
              />
            </div>
            <button className="relative p-1.5 rounded-lg hover:bg-white/5">
              <Bell className="w-4 h-4 text-slate-400" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">J</div>
              <span className="text-xs text-slate-300 font-medium">João</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4" style={{ background: "#0f1117" }}>
          {/* Page heading */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-100">Dashboard</h1>
              <p className="text-xs text-slate-500">Visão geral de abril de 2026</p>
            </div>
            <button className="flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-500">
              <CreditCard className="w-3.5 h-3.5" />
              Importar Extrato
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl p-4 border" style={{ background: "#1a1f2e", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">{m.label}</p>
                    <p className="text-base font-bold text-slate-100">{m.value}</p>
                  </div>
                  <div className={`${m.bg} p-2 rounded-lg`}>
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                </div>
                <p className={`text-xs ${m.trend === "up" ? "text-emerald-400" : m.trend === "down" ? "text-red-400" : "text-amber-400"}`}>
                  {m.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="grid grid-cols-3 gap-4">
            {/* Transactions */}
            <div className="col-span-2 rounded-xl border overflow-hidden" style={{ background: "#1a1f2e", borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <span className="text-xs font-semibold text-slate-300">Últimos Lançamentos</span>
                <button className="text-xs text-blue-400 hover:text-blue-300">Ver todos</button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Data</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Descrição</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Categoria</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Cartão</th>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      <td className="px-4 py-2 text-slate-600">{t.date}</td>
                      <td className="px-4 py-2 text-slate-300 font-medium">{t.description}</td>
                      <td className="px-4 py-2">
                        <span className="text-slate-400 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.06)" }}>{t.category}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{t.card}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${t.value < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {t.value < 0 ? "-" : "+"}R$ {Math.abs(t.value).toFixed(2).replace(".", ",")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Cards */}
              <div className="rounded-xl border overflow-hidden" style={{ background: "#1a1f2e", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <span className="text-xs font-semibold text-slate-300">Cartões de Crédito</span>
                  <button className="text-xs text-blue-400 hover:text-blue-300">Gerenciar</button>
                </div>
                <div className="p-4 space-y-3">
                  {cards.map((c) => (
                    <div key={c.name} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-4 ${c.color} rounded`} />
                        <span className="text-xs font-medium text-slate-300">{c.name}</span>
                        <span className="ml-auto text-xs text-slate-500">{c.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Usado: {c.used}</span>
                        <span>Limite: {c.limit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming bills */}
              <div className="rounded-xl border overflow-hidden" style={{ background: "#1a1f2e", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <span className="text-xs font-semibold text-slate-300">A Vencer em Breve</span>
                </div>
                <div className="p-4 space-y-2.5">
                  {[
                    { name: "Fatura Nubank", date: "07/05", value: "R$ 4.961,31", urgent: true },
                    { name: "Plano de Saúde", date: "10/05", value: "R$ 485,00", urgent: false },
                    { name: "Fatura Sicredi", date: "12/05", value: "R$ 2.834,70", urgent: false },
                    { name: "Internet Residencial", date: "15/05", value: "R$ 139,90", urgent: false },
                  ].map((b) => (
                    <div key={b.name} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-300">{b.name}</p>
                        <p className="text-xs text-slate-600">{b.date}</p>
                      </div>
                      <span className={`text-xs font-semibold ${b.urgent ? "text-red-400" : "text-slate-300"}`}>{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
