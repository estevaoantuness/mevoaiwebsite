import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  LayoutGrid, 
  Home, 
  MessageCircle, 
  LogOut, 
  Plus, 
  Trash2, 
  Smartphone, 
  Calendar,
  Shield,
  ArrowRight,
  Check,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';

// --- Theme & Brand Configuration ---
// Brand Colors extracted from logo: Blue to Cyan gradient
const BRAND_GRADIENT = "bg-gradient-to-r from-[#2563EB] to-[#22D3EE]";
const BRAND_TEXT_GRADIENT = "bg-clip-text text-transparent bg-gradient-to-r from-[#2563EB] to-[#22D3EE]";

// --- Mock Data ---
const INITIAL_PROPERTIES = [
  { id: 1, name: "Loft Centro 402", airbnb_ical: "https://airbnb.com/ical/...", cleaner_phone: "+5541999990000", status: "active" },
  { id: 2, name: "Casa de Praia", airbnb_ical: "https://airbnb.com/ical/...", cleaner_phone: "+5541988880000", status: "active" }
];

// --- Components ---

interface LogoProps {
  size?: string;
}

const Logo = ({ size = "text-2xl" }: LogoProps) => (
  <div className={`${size} font-bold tracking-tight select-none`}>
    <span className={BRAND_TEXT_GRADIENT}>mevo.ai</span>
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
}

const Button = ({ children, variant = "primary", className = "", ...props }: ButtonProps) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2";
  const variants = {
    primary: "bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-lg shadow-blue-500/20 border border-transparent",
    secondary: "bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10",
    ghost: "hover:bg-white/5 text-slate-400 hover:text-slate-100",
    danger: "text-red-400 hover:bg-red-500/10 hover:text-red-300"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
}

const Input = ({ label, ...props }: InputProps) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-medium text-slate-400 ml-1">{label}</label>}
    <input
      className="flex h-10 w-full rounded-md border border-white/10 bg-[#0B0C15] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
      {...props}
    />
  </div>
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0F1019] border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// --- Pages ---

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage = ({ onLogin }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-[#050509] text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-40 border-b border-white/5 bg-[#050509]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex gap-4">
             <Button variant="ghost" onClick={onLogin} className="hidden sm:inline-flex">Sign In</Button>
             <Button variant="primary" onClick={onLogin}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="pt-32 pb-20 px-6 flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="inline-flex items-center px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium uppercase tracking-wide mb-8 z-10">
          Automated Property Management
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 z-10 max-w-4xl leading-[1.1]">
          A Gestão do Seu Airbnb, <br />
          <span className={BRAND_TEXT_GRADIENT}>Elevada à Perfeição.</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed z-10">
          Automatize a limpeza com WhatsApp e sincronize calendários. 
          Nunca mais esqueça um checkout.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 z-10">
          <Button variant="primary" className="h-12 px-8 text-base" onClick={onLogin}>
            Começar Grátis
          </Button>
          <Button variant="secondary" className="h-12 px-8 text-base">
            Como Funciona
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 max-w-6xl w-full z-10">
          {[
            { icon: Calendar, title: "Sincronia iCal", desc: "Conecte Airbnb e Booking em um só lugar. Atualização em tempo real." },
            { icon: MessageCircle, title: "Avisos Automáticos", desc: "O Mevo avisa a faxineira todo dia às 08:00. Zero intervenção humana." },
            { icon: LayoutGrid, title: "Painel Unificado", desc: "Gerencie múltiplos imóveis e status de limpeza em uma interface limpa." }
          ].map((feature, i) => (
            <div key={i} className="group p-8 rounded-xl bg-[#0B0C15] border border-white/5 hover:border-blue-500/30 transition-all hover:bg-[#0E0F1A]">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                <feature.icon size={24} />
              </div>
              <h3 className="text-white font-medium mb-3 text-lg">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 py-12 bg-[#020205] text-center">
        <p className="text-slate-600 text-sm">© {new Date().getFullYear()} mevo.ai — Automação para anfitriões exigentes.</p>
      </footer>
    </div>
  );
};

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

const LoginPage = ({ onLoginSuccess, onBack }: LoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // Simulate API call
    setTimeout(() => {
      if (email === "admin@mevo.app" && password === "admin") {
        onLoginSuccess();
      } else {
        setError("Credenciais inválidas. Tente admin@mevo.app / admin");
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050509] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#050509] to-[#050509] -z-10" />
      
      <div className="w-full max-w-sm bg-[#0B0C15] border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <h2 className="text-xl font-medium text-white mb-2">Bem-vindo de volta</h2>
          <p className="text-sm text-slate-500">Acesse o painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input 
            label="Email" 
            type="email" 
            placeholder="admin@mevo.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input 
            label="Senha" 
            type="password" 
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar no Dashboard"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={onBack} className="text-xs text-slate-500 hover:text-white transition-colors">
            ← Voltar para Home
          </button>
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [properties, setProperties] = useState(INITIAL_PROPERTIES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Property Form State
  const [newProp, setNewProp] = useState({ name: '', airbnb_ical: '', cleaner_phone: '' });

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    const property = {
      id: Date.now(),
      ...newProp,
      status: 'active'
    };
    setProperties([property, ...properties]);
    setNewProp({ name: '', airbnb_ical: '', cleaner_phone: '' });
    setIsModalOpen(false);
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este imóvel?')) {
      setProperties(properties.filter(p => p.id !== id));
    }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: string, icon: React.ElementType, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all mb-1 ${
        activeTab === id 
          ? 'bg-white/5 text-white shadow-sm' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
      }`}
    >
      <Icon size={16} className={`mr-3 ${activeTab === id ? 'text-blue-400' : 'text-slate-500'}`} />
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#050509] text-slate-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-white/5 bg-[#080911] flex flex-col">
        <div className="h-14 flex items-center px-6 border-b border-white/5">
          <Logo size="text-lg" />
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">PRO</span>
        </div>

        <nav className="flex-1 p-3">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Menu</div>
          <NavItem id="overview" icon={LayoutGrid} label="Visão Geral" />
          <NavItem id="properties" icon={Home} label="Meus Imóveis" />
          <NavItem id="whatsapp" icon={MessageCircle} label="Conexão WhatsApp" />
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
              AD
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-slate-500 truncate">admin@mevo.app</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center px-2 py-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={14} className="mr-2" /> Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#050509]">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-8 border-b border-white/5 bg-[#050509]/50 backdrop-blur-sm z-10">
          <h2 className="text-sm font-medium text-slate-200">
            {activeTab === 'overview' && 'Visão Geral'}
            {activeTab === 'properties' && 'Gerenciar Imóveis'}
            {activeTab === 'whatsapp' && 'Conexão WhatsApp'}
          </h2>
          
          <div className="flex items-center space-x-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <span className="text-xs text-slate-500 font-medium">System Operational</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                  { label: "Imóveis Ativos", val: properties.length },
                  { label: "Limpezas Hoje", val: "0" },
                  { label: "Mensagens Enviadas", val: "0" }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#0B0C15] border border-white/5 p-6 rounded-xl hover:border-white/10 transition-colors">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{stat.label}</p>
                    <p className="text-3xl font-semibold text-white">{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#0B0C15]/50 border-2 border-dashed border-white/5 rounded-xl p-12 text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                   <ShieldCheck size={24} />
                </div>
                <h3 className="text-slate-300 font-medium mb-1">Tudo tranquilo por aqui</h3>
                <p className="text-slate-500 text-sm">Nenhuma atividade recente de limpeza registrada para hoje.</p>
              </div>
            </div>
          )}

          {/* TAB: PROPERTIES */}
          {activeTab === 'properties' && (
            <div className="max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <div>
                   <h3 className="text-lg font-medium text-white">Meus Imóveis</h3>
                   <p className="text-sm text-slate-500">Gerencie suas conexões iCal e faxineiras</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus size={16} className="mr-2" /> Adicionar Imóvel
                </Button>
              </div>

              <div className="bg-[#0B0C15] border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Imóvel</th>
                      <th className="py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Telefone Faxina</th>
                      <th className="py-3 px-6 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {properties.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-sm text-slate-500">
                          Nenhum imóvel cadastrado. Adicione o primeiro acima.
                        </td>
                      </tr>
                    ) : (
                      properties.map((p) => (
                        <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center mr-3 text-slate-500">
                                <Home size={14} />
                              </div>
                              <span className="text-sm font-medium text-slate-200">{p.name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 mr-1.5"></span>
                              Conectado
                            </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-400 font-mono text-xs">
                            {p.cleaner_phone}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button 
                              onClick={() => handleDelete(p.id)}
                              className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: WHATSAPP */}
          {activeTab === 'whatsapp' && (
            <div className="max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#0B0C15] border border-white/5 rounded-xl p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50"></div>
                
                <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto flex items-center justify-center mb-6 text-slate-400">
                  <Smartphone size={32} />
                </div>
                
                <h3 className="text-xl font-medium text-white mb-2">Conexão WhatsApp</h3>
                <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto">
                  Escaneie o QR Code para permitir que a Mevo envie mensagens automáticas para suas equipes de limpeza.
                </p>

                <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium mb-8">
                  ● Offline
                </div>

                <div className="w-64 h-64 mx-auto border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center bg-black/20 mb-6">
                  <div className="w-8 h-8 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin mb-3"></div>
                  <span className="text-xs text-slate-500 font-mono">Waiting for QR Code...</span>
                </div>

                <p className="text-xs text-slate-600">
                  Integração via @wppconnect/server
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Property Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Novo Imóvel"
      >
        <form onSubmit={handleAddProperty} className="space-y-4">
          <Input 
            label="Nome do Imóvel" 
            placeholder="Ex: Loft Centro 402" 
            required
            value={newProp.name}
            onChange={e => setNewProp({...newProp, name: e.target.value})}
          />
          <div className="grid grid-cols-1 gap-4">
             <Input 
              label="Airbnb iCal URL" 
              placeholder="https://airbnb.com/calendar/ical/..." 
              required
              value={newProp.airbnb_ical}
              onChange={e => setNewProp({...newProp, airbnb_ical: e.target.value})}
             />
          </div>
          <Input 
            label="Telefone Faxina (WhatsApp)" 
            placeholder="+5541999990000" 
            required
            value={newProp.cleaner_phone}
            onChange={e => setNewProp({...newProp, cleaner_phone: e.target.value})}
          />
          <div className="pt-4 flex justify-end gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
             <Button type="submit">Salvar Imóvel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- App Root ---

const App = () => {
  const [page, setPage] = useState('landing'); // 'landing', 'login', 'dashboard'

  useEffect(() => {
    // Check for "session"
    const session = localStorage.getItem('mevo_session');
    if (session) setPage('dashboard');
  }, []);

  const handleLoginSuccess = () => {
    localStorage.setItem('mevo_session', 'true');
    setPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('mevo_session');
    setPage('landing');
  };

  return (
    <>
      {page === 'landing' && <LandingPage onLogin={() => setPage('login')} />}
      {page === 'login' && <LoginPage onLoginSuccess={handleLoginSuccess} onBack={() => setPage('landing')} />}
      {page === 'dashboard' && <Dashboard onLogout={handleLogout} />}
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);