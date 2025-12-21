
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { Settings, Shield, Monitor, Save, Loader2, CheckCircle2, UserPlus, Users, Key, Trash2, ShieldCheck, X, Zap, RefreshCw } from 'lucide-react';

const SettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({
    LOW_STOCK_THRESHOLD: '10',
    SYSTEM_NAME: 'MaterialFlow Pro'
  });

  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as 'admin' | 'user' });
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);

  const currentUser = db.getCurrentUser();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sysSettings, userList] = await Promise.all([
        db.getSettings(),
        db.getUsers()
      ]);
      setSettings(sysSettings);
      setUsers(userList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await db.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClearKV = async () => {
    if (!window.confirm('确定要清除所有边缘节点的 KV 缓存吗？这可能会导致短暂的加载延迟。')) return;
    setClearingCache(true);
    try {
      await db.clearRemoteCache();
      alert('边缘缓存已全部清空，数据将在下次请求时重新缓存。');
    } catch (e) {
      alert('清除失败');
    } finally {
      setClearingCache(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="font-bold">加载系统配置...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">系统设置</h2>
          <p className="text-sm text-gray-500 font-medium">配置与权限管理</p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : (saved ? <CheckCircle2 size={20} /> : <Save size={20} />)}
          <span>{saving ? '保存中...' : (saved ? '已保存' : '保存设置')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 系统基础设置 */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Monitor size={24} /></div>
            <h3 className="font-black text-gray-900">界面展示</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">系统名称</label>
              <input type="text" value={settings.SYSTEM_NAME} onChange={e => setSettings({...settings, SYSTEM_NAME: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">库存预警阈值</label>
              <input type="number" value={settings.LOW_STOCK_THRESHOLD} onChange={e => setSettings({...settings, LOW_STOCK_THRESHOLD: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold outline-none" />
            </div>
          </div>
        </section>

        {/* KV 缓存管理 */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Zap size={24} /></div>
              <div>
                <h3 className="font-black text-gray-900">边缘缓存 (Cloudflare KV)</h3>
                <p className="text-[10px] text-gray-400 font-bold">加速全球访问性能</p>
              </div>
            </div>
            <button 
              onClick={handleClearKV}
              disabled={clearingCache}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {clearingCache ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              <span>清空边缘缓存</span>
            </button>
          </div>
          <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900">边缘节点同步状态</p>
              <p className="text-xs text-amber-700/70 font-medium">当前物料、库存、报表数据均已缓存至 Cloudflare KV 节点。</p>
            </div>
            <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black animate-pulse">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              <span>ACTIVE</span>
            </div>
          </div>
        </section>

        {/* 用户授权 */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><Users size={24} /></div>
              <h3 className="font-black text-gray-900">权限管理</h3>
            </div>
            {currentUser?.role === 'admin' && (
              <button onClick={() => setIsAddingUser(true)} className="flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl font-black text-xs hover:bg-purple-100">
                <UserPlus size={16} />
                <span>新增授权账号</span>
              </button>
            )}
          </div>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-gray-200 transition-all">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${u.role === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{u.username[0].toUpperCase()}</div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-black text-gray-900">{u.username}</p>
                      {u.role === 'admin' && <ShieldCheck size={14} className="text-blue-600" />}
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{u.role === 'admin' ? '系统管理员' : '普通操作员'}</p>
                  </div>
                </div>
                {currentUser?.role === 'admin' && u.id !== currentUser.id && (
                  <button onClick={() => db.deleteUser(u.id).then(fetchData)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 新增用户弹窗 */}
      {isAddingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-purple-600 text-white flex items-center justify-between">
              <h3 className="text-lg font-black">授权新账号</h3>
              <button onClick={() => setIsAddingUser(false)} className="hover:bg-white/20 p-2 rounded-lg"><X size={20}/></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); db.addUser(newUser).then(() => { setIsAddingUser(false); fetchData(); }); }} className="p-6 space-y-4">
              <input required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" placeholder="用户名" />
              <input required type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" placeholder="初始密码" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setNewUser({...newUser, role: 'user'})} className={`py-3 rounded-xl font-black text-xs border-2 ${newUser.role === 'user' ? 'bg-purple-50 border-purple-600 text-purple-700' : 'border-gray-100 text-gray-400'}`}>操作员</button>
                <button type="button" onClick={() => setNewUser({...newUser, role: 'admin'})} className={`py-3 rounded-xl font-black text-xs border-2 ${newUser.role === 'admin' ? 'bg-purple-50 border-purple-600 text-purple-700' : 'border-gray-100 text-gray-400'}`}>管理员</button>
              </div>
              <button type="submit" className="w-full py-4 bg-purple-600 text-white font-black rounded-xl shadow-lg">确认授权</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
