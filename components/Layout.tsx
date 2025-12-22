
import React, { useState } from 'react';
import { ViewMode, User } from '../types';
import { db } from '../services/db';
import { 
  LayoutDashboard, 
  Package, 
  BarChart3,
  FileText, 
  History, 
  LogOut,
  Menu,
  X,
  Settings
} from 'lucide-react';

interface LayoutProps {
  user: User;
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, currentView, setView, onLogout, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { id: ViewMode.DASHBOARD, label: '仓库看板', icon: LayoutDashboard },
    { id: ViewMode.INVENTORY, label: '实时库存管理', icon: Package },
    { id: ViewMode.STATISTICS, label: '历史变动', icon: BarChart3 },
    { id: ViewMode.REPORTS, label: '报表导出', icon: FileText },
    { id: ViewMode.LOGS, label: '操作审计', icon: History },
    { id: ViewMode.SETTINGS, label: '系统配置', icon: Settings },
  ];

  const handleNavClick = (view: ViewMode) => {
    setView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-64 bg-slate-950 text-white transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-900">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Package size={18} />
            </div>
            <span className="text-xl font-black tracking-tight text-white">物料流控</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-2">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-8 px-3 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`
                flex items-center w-full px-4 py-3 text-sm font-bold rounded-xl transition-all
                ${currentView === item.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 translate-x-1' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'}
              `}
            >
              <item.icon size={18} className="mr-3" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-900">
          <div className="px-4 py-4 bg-slate-900/50 rounded-xl mb-3 border border-slate-900">
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">当前操作员</p>
            <p className="text-sm font-black text-white truncate">{user.username}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut size={18} className="mr-3" />
            注销登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 flex items-center justify-between px-4 lg:px-10 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu size={22} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                {navItems.find(i => i.id === currentView)?.label || 'App'}
              </h1>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center space-x-2 text-xs font-black text-blue-600 bg-blue-50 px-4 py-2.5 rounded-2xl border border-blue-100 shadow-sm shadow-blue-50/50">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span>系统日期：{db.getBeijingDate()}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-10 scroll-smooth">
          <div className="max-w-7xl mx-auto pb-20 lg:pb-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
