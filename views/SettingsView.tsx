
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Settings, Shield, Bell, Monitor, Save, Loader2, CheckCircle2 } from 'lucide-react';

const SettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({
    LOW_STOCK_THRESHOLD: '10',
    SYSTEM_NAME: 'MaterialFlow Pro'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const data = await db.getSettings();
      setSettings(data);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
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

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-bold">正在读取系统配置...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900">系统设置 Settings</h2>
          <p className="text-sm text-gray-500">管理全局预警参数与系统展示信息</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : (saved ? <CheckCircle2 size={18} /> : <Save size={18} />)}
          <span>{saving ? '保存中...' : (saved ? '已保存' : '保存更改')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 系统基础设置 */}
        <section className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Monitor size={20} />
            </div>
            <h3 className="font-black text-gray-800">基础展示设置</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">系统显示名称</label>
              <input
                type="text"
                value={settings.SYSTEM_NAME}
                onChange={(e) => setSettings({ ...settings, SYSTEM_NAME: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-bold text-gray-700 transition-all"
                placeholder="例如: 物料管理中心"
              />
            </div>
          </div>
        </section>

        {/* 业务逻辑设置 */}
        <section className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <Bell size={20} />
            </div>
            <h3 className="font-black text-gray-800">库存预警逻辑</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">低库存预警阈值 (数值)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.LOW_STOCK_THRESHOLD}
                  onChange={(e) => setSettings({ ...settings, LOW_STOCK_THRESHOLD: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-bold text-gray-700 transition-all"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">个/件/kg</span>
              </div>
              <p className="mt-3 text-xs text-gray-400 flex items-start">
                <Shield size={12} className="mr-1.5 mt-0.5 shrink-0" />
                当物料的“今日剩余库存”低于此数值时，系统将在 Dashboard 中触发红色告警提醒。
              </p>
            </div>
          </div>
        </section>

        {/* 环境信息 */}
        <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">运行环境信息</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">后端引擎</p>
              <p className="text-sm font-black text-blue-400">Cloudflare Pages Functions</p>
            </div>
            <div className="bg-white/5 p-4 rounded-xl">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">数据存储</p>
              <p className="text-sm font-black text-emerald-400">D1 SQL (Edge Database)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
