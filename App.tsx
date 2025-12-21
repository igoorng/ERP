
import React, { useState, useEffect } from 'react';
import { db } from './services/db';
import { User, ViewMode } from './types';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import InventoryView from './views/InventoryView';
import ReportsView from './views/ReportsView';
import LogsView from './views/LogsView';
import Login from './views/Login';
import StatisticsView from './views/StatisticsView';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(db.getCurrentUser());
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);

  // Persistence for view mode session
  useEffect(() => {
    const savedView = localStorage.getItem('mf_pro_current_view') as ViewMode;
    if (savedView && Object.values(ViewMode).includes(savedView)) {
      setCurrentView(savedView);
    }
  }, []);

  const handleSetView = (view: ViewMode) => {
    setCurrentView(view);
    localStorage.setItem('mf_pro_current_view', view);
  };

  const handleLogout = () => {
    db.setCurrentUser(null);
    setUser(null);
    db.logAction('AUTH', 'User logged out');
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => {
      setUser(u);
      db.setCurrentUser(u);
      db.logAction('AUTH', 'User logged in');
    }} />;
  }

  const renderView = () => {
    switch (currentView) {
      case ViewMode.DASHBOARD:
        return <Dashboard />;
      case ViewMode.INVENTORY:
        return <InventoryView />;
      case ViewMode.STATISTICS:
        return <StatisticsView />;
      case ViewMode.REPORTS:
        return <ReportsView />;
      case ViewMode.LOGS:
        return <LogsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout 
      user={user} 
      currentView={currentView} 
      setView={handleSetView} 
      onLogout={handleLogout}
    >
      {renderView()}
    </Layout>
  );
};

export default App;
