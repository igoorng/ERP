
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../services/db';
import { Lock, User as UserIcon, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 初始化验证系统：确保数据库中有哈希过的默认账号
  useEffect(() => {
    db.initAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 调用数据库层的 authenticate 方法进行摘要比对
      // 这样即便查看源码，也只能看到调用接口，看不到明文密码
      const authenticatedUser = await db.authenticate(username, password);

      if (authenticatedUser) {
        onLoginSuccess(authenticatedUser);
      } else {
        setError('用户名或密码输入错误！');
      }
    } catch (err) {
      setError('系统繁忙，请稍后再试。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck size={120} />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Lock className="text-white" size={32} />
              </div>
              <h1 className="text-3xl font-black tracking-tight">物料管理系统</h1>
              <p className="mt-2 text-blue-100 text-sm font-medium">MaterialFlow Pro v1.2 Secure</p>
            </div>
          </div>
          
          <form onSubmit={handleLogin} className="p-10 space-y-6">
            {error && (
              <div className="flex items-center p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl animate-in shake duration-300">
                <AlertCircle size={20} className="mr-3 flex-shrink-0" />
                <span className="font-bold">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">管理账号</label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 transition-all outline-none font-bold text-gray-700"
                  placeholder="请输入用户名"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">授权密码</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 transition-all outline-none font-bold text-gray-700"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`
                w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 transition-all transform active:scale-[0.98] flex items-center justify-center space-x-2
                ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700 hover:shadow-blue-300'}
              `}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>立即授权登录</span>
                  <ShieldCheck size={18} />
                </>
              )}
            </button>
          </form>

          <div className="px-10 pb-8 text-center">
            <p className="text-xs text-gray-400 font-medium">
              如遇到问题，请联系管理员。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
