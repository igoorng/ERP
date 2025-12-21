
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { History, User as UserIcon, Activity } from 'lucide-react';
import { AuditLog } from '../types';

const LogsView: React.FC = () => {
  // Fixed: changed logs to a state variable and initialized it as an empty array
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Fixed: added useEffect to fetch logs asynchronously on mount
  useEffect(() => {
    const fetchLogs = async () => {
      const data = await db.getLogs();
      setLogs(data);
    };
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      case 'AUTH': return 'bg-purple-100 text-purple-700';
      case 'IMPORT': return 'bg-indigo-100 text-indigo-700';
      case 'EXPORT': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Activity className="mr-2 text-blue-500" size={20} />
            操作历史记录
          </h3>
          <p className="text-sm text-gray-500 mt-1">记录系统内所有的增删改查操作记录，用于追溯管理。</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">时间 Timestamp</th>
                <th className="px-6 py-4">操作员 User</th>
                <th className="px-6 py-4">动作 Action</th>
                <th className="px-6 py-4">详情 Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    暂无操作记录。
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                          <UserIcon size={12} className="text-blue-600" />
                        </div>
                        {log.username}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LogsView;
