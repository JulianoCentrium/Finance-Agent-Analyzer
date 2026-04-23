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
  { label: "Saldo Total", value: "R$ 12.847,30", sub: "+R$ 1.230 este mês", trend: "up", icon: Wallet, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Entradas do Mês", value: "R$ 8.500,00", sub: "3 recebimentos", trend: "up", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
  { label: "Saídas do Mês", value: "R$ 7.269,70", sub: "42 lançamentos", trend: "down", icon: TrendingDown, color: "text-red-500", bg: "bg-red-50" },
  { label: "Parcelas Futuras", value: "R$ 4.312,88", sub: "Próximos 3 meses", trend: "neutral", icon: CalendarClock, color: "text-amber-600", bg: "bg-amber-50" },
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
  { name: "Sicredi Visa", limit: "R$ 8.000", used: "R$ 2.834,70", pct: 35, color: "bg-blue-700" },
];

export function LightBlue() {
  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden text-sm">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-blue-700 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-blue-600">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">CO-Finance</div>
              <div className="text-blue-200 text-xs">Perfil: Família</div>
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
                  ? "bg-white/20 text-white font-medium"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-blue-600 space-y-0.5">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-blue-100 hover:bg-white/10 hover:text-white text-left">
            <Settings className="w-4 h-4" />
            <span className="text-xs">Configurações</span>
          </button>
          {/* Theme toggle */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Sun className="w-4 h-4 text-blue-200" />
            <div className="flex-1 h-5 bg-white/20 rounded-full relative cursor-pointer">
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
            </div>
            <Moon className="w-4 h-4 text-blue-200" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span className="text-gray-400">CO-Finance</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 font-medium">Dashboard</span>
            <span className="ml-3 text-gray-400">Abril 2026</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                className="bg-gray-100 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-600 w-44 outline-none"
                placeholder="Buscar lançamentos..."
              />
            </div>
            <button className="relative p-1.5 rounded-lg hover:bg-gray-100">
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">J</div>
              <span className="text-xs text-gray-700 font-medium">João</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Page heading */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-gray-800">Dashboard</h1>
              <p className="text-xs text-gray-500">Visão geral de abril de 2026</p>
            </div>
            <button className="flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700">
              <CreditCard className="w-3.5 h-3.5" />
              Importar Extrato
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
                    <p className="text-base font-bold text-gray-800">{m.value}</p>
                  </div>
                  <div className={`${m.bg} p-2 rounded-lg`}>
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                </div>
                <p className={`text-xs ${m.trend === "up" ? "text-green-600" : m.trend === "down" ? "text-red-500" : "text-amber-600"}`}>
                  {m.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="grid grid-cols-3 gap-4">
            {/* Transactions */}
            <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-700">Últimos Lançamentos</span>
                <button className="text-xs text-blue-600 hover:underline">Ver todos</button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Data</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Descrição</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Categoria</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Cartão</th>
                    <th className="text-right px-4 py-2 text-gray-500 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-400">{t.date}</td>
                      <td className="px-4 py-2 text-gray-700 font-medium">{t.description}</td>
                      <td className="px-4 py-2">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{t.category}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{t.card}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${t.value < 0 ? "text-red-500" : "text-green-600"}`}>
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">Cartões de Crédito</span>
                  <button className="text-xs text-blue-600 hover:underline">Gerenciar</button>
                </div>
                <div className="p-4 space-y-3">
                  {cards.map((c) => (
                    <div key={c.name} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-4 ${c.color} rounded`} />
                        <span className="text-xs font-medium text-gray-700">{c.name}</span>
                        <span className="ml-auto text-xs text-gray-500">{c.pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Usado: {c.used}</span>
                        <span>Limite: {c.limit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming bills */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">A Vencer em Breve</span>
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
                        <p className="text-xs font-medium text-gray-700">{b.name}</p>
                        <p className="text-xs text-gray-400">{b.date}</p>
                      </div>
                      <span className={`text-xs font-semibold ${b.urgent ? "text-red-500" : "text-gray-700"}`}>{b.value}</span>
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
