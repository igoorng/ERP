
import React from 'react';
import { ViewMode, User } from '../types';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  History, 
  Settings, 
  LogOut,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  user: User;
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, currentView, setView, onLogout, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { id: ViewMode.DASHBOARD, label: '系统概览', icon: LayoutDashboard },
    { id: ViewMode.INVENTORY, label: '物料管理', icon: Package },
    { id: ViewMode.REPORTS, label: '报表导出', icon: FileText },
    { id: ViewMode.LOGS, label: '操作日志', icon: History },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <span className="text-xl font-bold tracking-tight text-blue-400">MaterialFlow</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`
                flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors
                ${currentView === item.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon size={20} className="mr-3" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 space-y-4">
          <div className="px-4 py-3 bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-400 uppercase font-semibold">User</p>
            <p className="text-sm font-medium text-white truncate">{user.username}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            退出登录 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-white border-b border-gray-200">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900">
              {navItems.find(i => i.id === currentView)?.label || 'App'}
            </h1>
          </div>
          <div className="text-sm text-gray-500 font-medium">
            {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;

import React from 'react';
import { ViewMode, User } from '../types';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  History, 
  Settings, 
  LogOut,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  user: User;
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, currentView, setView, onLogout, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { id: ViewMode.DASHBOARD, label: '概览 Dashboard', icon: LayoutDashboard },
    { id: ViewMode.INVENTORY, label: '物料管理 Inventory', icon: Package },
    { id: ViewMode.REPORTS, label: '报表导出 Reports', icon: FileText },
    { id: ViewMode.LOGS, label: '操作日志 Logs', icon: History },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <span className="text-xl font-bold tracking-tight text-blue-400">MaterialFlow</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`
                flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors
                ${currentView === item.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon size={20} className="mr-3" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 space-y-4">
          <div className="px-4 py-3 bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-400 uppercase font-semibold">User</p>
            <p className="text-sm font-medium text-white truncate">{user.username}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            退出登录 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-white border-b border-gray-200">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900">
              {navItems.find(i => i.id === currentView)?.label || 'App'}
            </h1>
          </div>
          <div className="text-sm text-gray-500 font-medium">
            {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
