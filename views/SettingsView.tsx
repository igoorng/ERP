
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { Settings, Shield, Bell, Monitor, Save, Loader2, CheckCircle2, UserPlus, Users, Key, Trash2, ShieldCheck, X } from 'lucide-react';

const SettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({
    LOW_STOCK_THRESHOLD: '10',
    SYSTEM_NAME: 'MaterialFlow Pro'
  });

  // 用户管理状态
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as 'admin' | 'user' });
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

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
      alert('保存失败，请检查数据库绑定');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    try {
      await db.addUser(newUser);
      setIsAddingUser(false);
      setNewUser({ username: '', password: '', role: 'user' });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (id === currentUser?.id) return alert('不能删除当前登录账号');
    if (!window.confirm(`确定要删除用户 "${username}" 吗？`)) return;
    try {
      await db.deleteUser(id);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!editingPasswordId || !newPassword) return;
    try {
      await db.updateUserPassword(editingPasswordId, newPassword);
      setEditingPasswordId(null);
      setNewPassword('');
      alert('密码修改成功');
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-gray-400">
        <div className="relative mb-4">
           <Loader2 className="animate-spin text-blue-500" size={48} />
           <Settings className="absolute inset-0 m-auto text-blue-200" size={20} />
        </div>
        <p className="font-bold">正在同步云端配置与用户权限...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">系统设置 Settings</h2>
          <p className="text-sm text-gray-500 font-medium">全局配置管理与多租户权限授权</p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : (saved ? <CheckCircle2 size={20} /> : <Save size={20} />)}
          <span>{saving ? '保存中...' : (saved ? '配置已保存' : '同步全局更改')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* 系统基础设置 */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Monitor size={24} />
            </div>
            <div>
              <h3 className="font-black text-gray-900">基础展示设置</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Branding & Display</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">系统显示名称</label>
              <input
                type="text"
                value={settings.SYSTEM_NAME}
                onChange={(e) => setSettings({ ...settings, SYSTEM_NAME: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-bold text-gray-700 transition-all"
                placeholder="例如: 物料管理中心"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">库存预警阈值</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.LOW_STOCK_THRESHOLD}
                  onChange={(e) => setSettings({ ...settings, LOW_STOCK_THRESHOLD: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-bold text-gray-700 transition-all"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">单位</span>
              </div>
            </div>
          </div>
        </section>

        {/* 用户管理设置 (仅管理员可见或全员可见但受限) */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-black text-gray-900">权限授权管理</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">User Access Control</p>
              </div>
            </div>
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setIsAddingUser(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl font-black text-xs hover:bg-purple-100 transition-all"
              >
                <UserPlus size={16} />
                <span>新增授权账号</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-transparent hover:border-gray-200 transition-all group">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${u.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {u.username.substring(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-black text-gray-900">{u.username}</p>
                      {u.role === 'admin' && <ShieldCheck size={14} className="text-indigo-600" />}
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {u.role === 'admin' ? '系统管理员' : '普通操作员'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      setEditingPasswordId(u.id);
                      setNewPassword('');
                    }}
                    className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm"
                    title="修改密码"
                  >
                    <Key size={18} />
                  </button>
                  {currentUser?.role === 'admin' && u.id !== currentUser.id && (
                    <button 
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="p-3 text-gray-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm"
                      title="注销账号"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 环境与运行状态 */}
        <div className="p-8 bg-slate-950 rounded-[2.5rem] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Node Engine Status</h4>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                <span className="text-sm font-black tracking-tight">Cloudflare Edge DB Online</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold">
                <Shield size={14} />
                <span>AES-256 事务级加密</span>
              </div>
            </div>
          </div>
          <div className="flex -space-x-3">
             {users.slice(0, 5).map(u => (
               <div key={u.id} className="w-10 h-10 rounded-full border-4 border-slate-950 bg-slate-800 flex items-center justify-center text-[10px] font-black uppercase ring-1 ring-slate-700">
                 {u.username[0]}
               </div>
             ))}
             {users.length > 5 && (
               <div className="w-10 h-10 rounded-full border-4 border-slate-950 bg-slate-700 flex items-center justify-center text-[10px] font-black uppercase ring-1 ring-slate-700 text-slate-400">
                 +{users.length - 5}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* 新增用户弹窗 */}
      {isAddingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <UserPlus size={24} />
                <h3 className="text-xl font-black">授权新账号</h3>
              </div>
              <button onClick={() => setIsAddingUser(false)} className="hover:bg-white/20 p-2 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">登录用户名</label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 outline-none font-bold"
                  placeholder="请输入用户名"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">初始访问密码</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 outline-none font-bold"
                  placeholder="请输入密码"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">角色权限 Role</label>
                <div className="grid grid-cols-2 gap-3">
                   <button 
                    type="button"
                    onClick={() => setNewUser({...newUser, role: 'user'})}
                    className={`py-3 rounded-xl font-black text-sm border-2 transition-all ${newUser.role === 'user' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-gray-100 text-gray-400'}`}
                   >操作员</button>
                   <button 
                    type="button"
                    onClick={() => setNewUser({...newUser, role: 'admin'})}
                    className={`py-3 rounded-xl font-black text-sm border-2 transition-all ${newUser.role === 'admin' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-gray-100 text-gray-400'}`}
                   >管理员</button>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all mt-4">
                立即确认授权
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {editingPasswordId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Key size={24} />
                <h3 className="text-xl font-black">重置访问密码</h3>
              </div>
              <button onClick={() => setEditingPasswordId(null)} className="hover:bg-white/20 p-2 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">请输入新密码</label>
                <input
                  type="password"
                  autoFocus
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-slate-900 outline-none font-bold"
                  placeholder="新密码..."
                />
              </div>
              <button 
                onClick={handleUpdatePassword}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:bg-black transition-all"
              >
                立即重置密码
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
