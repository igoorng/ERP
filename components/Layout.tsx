
import React, { useState } from 'react';
import { ViewMode, User } from '../types';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  History, 
  LogOut,
  Menu,
  X,
  BarChart3,
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
    { id: ViewMode.DASHBOARD, label: '概览 Dashboard', icon: LayoutDashboard },
    { id: ViewMode.INVENTORY, label: '物料管理 Inventory', icon: Package },
    { id: ViewMode.STATISTICS, label: '数据统计 Statistics', icon: BarChart3 },
    { id: ViewMode.REPORTS, label: '报表导出 Reports', icon: FileText },
    { id: ViewMode.LOGS, label: '操作日志 Logs', icon: History },
    { id: ViewMode.SETTINGS, label: '系统设置 Settings', icon: Settings },
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
        fixed inset-y-0 left-0 z-[70] w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <span className="text-xl font-bold tracking-tight text-blue-400">MaterialFlow</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-2">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`
                flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl transition-all
                ${currentView === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon size={20} className="mr-3" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4">
          <div className="px-4 py-4 bg-slate-800/50 rounded-xl mb-3">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">当前用户</p>
            <p className="text-sm font-bold text-white truncate">{user.username}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/20 rounded-xl transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            退出系统 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {navItems.find(i => i.id === currentView)?.label.split(' ')[0] || 'App'}
            </h1>
          </div>
          
          <div className="hidden sm:block text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            {new Date().toLocaleDateString('zh-CN', { 
              timeZone: 'Asia/Shanghai', 
              month: 'long', 
              day: 'numeric', 
              weekday: 'short' 
            })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto pb-20 lg:pb-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
