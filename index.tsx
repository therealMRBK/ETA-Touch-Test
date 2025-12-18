
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  AlertTriangle, 
  Layers, 
  RefreshCw, 
  Activity, 
  Thermometer, 
  Database, 
  ChevronRight, 
  ChevronDown,
  Terminal,
  Gauge,
  Flame,
  Info,
  Clock,
  Globe
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components for historical data
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- State & Defaults ---

const INITIAL_CONFIG = {
  apiUrl: 'https://pc.bravokilo.cloud',
  refreshInterval: 30, // seconds
  mockMode: true,
};

type View = 'overview' | 'menu' | 'alerts' | 'config';

// --- App Component ---

export default function ETAtouchMonitor() {
  const [view, setView] = useState<View>('overview');
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [logs, setLogs] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Data State (Simulated Database)
  const [data, setData] = useState({
    boilerTemp: 72.5,
    outsideTemp: 8.2,
    boilerSoll: 75.0,
    exhaustTemp: 142.0,
    runtime: 4521,
    history: [] as any[],
    menuTree: null as any,
    alerts: [] as any[]
  });

  // Log helper
  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{
      time: new Date().toLocaleTimeString(),
      msg,
      type
    }, ...prev].slice(0, 50));
  };

  // --- Sync Engine (HTTP Polling Only) ---
  // This simulates the PHP service running in the background.
  const fetchCycle = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addLog(`GET ${config.apiUrl}/user/menu - Fetching data...`, 'info');

    try {
      // Simulation of the server-side proxy behavior
      if (config.mockMode) {
        await new Promise(r => setTimeout(r, 1200)); // Simulate latency
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const nextBoiler = 70 + Math.random() * 5;
        const nextOutside = 5 + Math.random() * 3;

        setData(prev => ({
          ...prev,
          boilerTemp: parseFloat(nextBoiler.toFixed(1)),
          outsideTemp: parseFloat(nextOutside.toFixed(1)),
          history: [...prev.history, { time: timestamp, boiler: nextBoiler, outside: nextOutside }].slice(-24),
          menuTree: {
            name: "ETAtouch System",
            children: [
              { 
                name: "Kessel", 
                children: [
                  { name: "Kessel-Temperatur", value: nextBoiler.toFixed(1), unit: "°C" },
                  { name: "Abgas-Temperatur", value: "145.0", unit: "°C" },
                  { name: "Kessel-Soll", value: "75.0", unit: "°C" }
                ]
              },
              {
                name: "Heizkreis 1",
                children: [
                  { name: "Vorlauf-Ist", value: "42.1", unit: "°C" },
                  { name: "Vorlauf-Soll", value: "45.0", unit: "°C" }
                ]
              }
            ]
          }
        }));
        setLastUpdate(new Date().toLocaleTimeString());
        addLog(`Database updated successfully. 200 OK`, 'success');
      } else {
        // In reality, here we fetch from the PHP proxy
        // fetch('/api/sync.php')...
        addLog(`CORS Restriction: Direct browser fetch blocked. Please use Mock Mode or Proxy.`, 'error');
      }
    } catch (err: any) {
      addLog(`Sync failed: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchCycle();
    const timer = setInterval(fetchCycle, config.refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [config.refreshInterval, config.apiUrl]);

  // --- Components ---

  const StatCard = ({ label, value, unit, icon: Icon, color }: any) => (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm hover:border-slate-700 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl bg-slate-800 ${color}`}>
          <Icon size={24} />
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-sm font-medium">{label}</p>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
            <span className="text-slate-500 font-semibold text-sm">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const NavItem = ({ id, label, icon: Icon }: { id: View, label: string, icon: any }) => (
    <button 
      onClick={() => setView(id)}
      className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl w-full transition-all ${
        view === id 
        ? 'bg-orange-500/10 text-orange-500 font-semibold' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
      {id === 'alerts' && data.alerts.length > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
          {data.alerts.length}
        </span>
      )}
    </button>
  );

  const RecursiveTree = ({ item, depth = 0 }: any) => {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div className="ml-4 border-l border-slate-800 pl-4 my-1">
        <div 
          className={`flex items-center py-2 px-3 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors ${hasChildren ? '' : 'cursor-default'}`}
          onClick={() => hasChildren && setIsOpen(!isOpen)}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown size={14} className="mr-2 text-slate-500" /> : <ChevronRight size={14} className="mr-2 text-slate-500" />
          ) : <div className="w-5" />}
          <span className="flex-1 text-slate-300 text-sm">{item.name}</span>
          {item.value && (
            <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              <span className="text-emerald-400 font-mono text-xs font-bold">{item.value}</span>
              <span className="text-slate-600 text-[10px]">{item.unit}</span>
            </div>
          )}
        </div>
        {isOpen && hasChildren && (
          <div>
            {item.children.map((child: any, i: number) => (
              <RecursiveTree key={i} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-900 bg-slate-900/50 flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-orange-500 p-2.5 rounded-2xl shadow-lg shadow-orange-500/20">
            <Flame size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">ETA<span className="text-orange-500">touch</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Heating Monitor v2</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem id="overview" label="Dashboard" icon={LayoutDashboard} />
          <NavItem id="menu" label="Strukturbaum" icon={Layers} />
          <NavItem id="alerts" label="Warnungen" icon={AlertTriangle} />
          <NavItem id="config" label="Konfiguration" icon={Settings} />
        </nav>

        <div className="mt-auto bg-slate-950/50 border border-slate-800/50 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">Status</span>
            <span className={isSyncing ? "text-orange-500 animate-pulse" : "text-emerald-500"}>
              {isSyncing ? "Syncing..." : "Online"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-600">
            <span>Zuletzt:</span>
            <span>{lastUpdate || '--:--'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 bg-gradient-to-br from-slate-950 to-slate-900">
        <header className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-4xl font-bold text-white mb-2 capitalize">{view === 'menu' ? 'CAN-Explorer' : view}</h2>
            <div className="flex items-center gap-4 text-slate-500 text-sm">
              <span className="flex items-center gap-1.5"><Globe size={14} /> {config.apiUrl}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
              <span className="flex items-center gap-1.5"><Clock size={14} /> Alle {config.refreshInterval}s</span>
            </div>
          </div>
          <button 
            onClick={fetchCycle}
            disabled={isSyncing}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all font-semibold text-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            Sync Jetzt
          </button>
        </header>

        {view === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Kessel-Temperatur" value={data.boilerTemp} unit="°C" icon={Thermometer} color="text-orange-500" />
              <StatCard label="Außen-Temperatur" value={data.outsideTemp} unit="°C" icon={Activity} color="text-blue-400" />
              <StatCard label="Abgas-Temperatur" value={data.exhaustTemp} unit="°C" icon={Gauge} color="text-emerald-400" />
              <StatCard label="Betriebsstunden" value={data.runtime} unit="h" icon={Clock} color="text-purple-400" />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity size={20} className="text-orange-500" />
                  Historische Verläufe
                </h3>
                <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span> Kessel</span>
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400"></span> Außen</span>
                </div>
              </div>
              <div className="h-80">
                <Line 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                      x: { grid: { display: false }, ticks: { color: '#64748b' } }
                    }
                  }}
                  data={{
                    labels: data.history.map(h => h.time),
                    datasets: [
                      {
                        label: 'Boiler',
                        data: data.history.map(h => h.boiler),
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3
                      },
                      {
                        label: 'Outside',
                        data: data.history.map(h => h.outside),
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3
                      }
                    ]
                  }} 
                />
              </div>
            </div>
          </div>
        )}

        {view === 'menu' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 animate-in fade-in duration-300">
             {data.menuTree ? (
               <RecursiveTree item={data.menuTree} />
             ) : (
               <div className="text-center py-20 text-slate-600 italic">Lade Menüstruktur...</div>
             )}
          </div>
        )}

        {view === 'alerts' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {data.alerts.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 p-20 rounded-3xl text-center">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck size={40} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Keine Störungen</h3>
                <p className="text-slate-500">Das Heizungssystem läuft aktuell innerhalb aller Parameter.</p>
              </div>
            ) : (
              data.alerts.map((a, i) => (
                <div key={i} className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center gap-4">
                  <AlertTriangle className="text-red-500" />
                  <span className="text-white font-medium">{a.msg}</span>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Settings size={20} className="text-slate-400" />
                Dienst-Einstellungen
              </h3>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Base API URL</label>
                <input 
                  type="text" 
                  value={config.apiUrl} 
                  onChange={e => setConfig({...config, apiUrl: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Polling Intervall (Sekunden)</label>
                <input 
                  type="number" 
                  value={config.refreshInterval} 
                  onChange={e => setConfig({...config, refreshInterval: parseInt(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-white focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                <input 
                  type="checkbox" 
                  checked={config.mockMode} 
                  onChange={e => setConfig({...config, mockMode: e.target.checked})}
                  id="mock"
                  className="w-5 h-5 accent-orange-500 rounded"
                />
                <label htmlFor="mock" className="text-sm font-medium text-slate-300 cursor-pointer">Mock-Modus aktivieren (Demo-Daten statt API)</label>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                <Info size={12} className="inline mr-1 text-blue-400" />
                Hinweis: Zur Umgehung von CORS-Einschränkungen im Browser sollten die Daten serverseitig von einem PHP-Script (z.B. <code>sync.php</code>) abgerufen und hier nur aus der "Datenbank" (lokaler Cache) gelesen werden.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl flex flex-col h-[500px]">
              <div className="p-5 border-b border-slate-900 flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <Terminal size={14} className="text-emerald-500" />
                  Hintergrund-Dienst Logs
                </div>
                <button onClick={() => setLogs([])} className="text-[10px] text-slate-600 hover:text-white transition-colors">CLEAR</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] space-y-2">
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-3 leading-relaxed">
                    <span className="text-slate-700">[{l.time}]</span>
                    <span className={l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : 'text-blue-400'}>
                      {l.msg}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && <div className="text-slate-800 italic">Warte auf Datenabgleich...</div>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Simple Helper Icon
function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
