import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  PlusCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Wrench,
  Package,
  Truck,
  BatteryCharging,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OverviewData } from './types';

interface OverviewHeaderProps {
  data: OverviewData;
  loading: boolean;
  onRefresh: () => void;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({ data, loading, onRefresh }) => {
  const navigate = useNavigate();
  const role = data.role?.toUpperCase() || 'USER';

  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'ADMIN':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'MANAGER':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      case 'HEAD_TECHNICIAN':
      case 'LEAD_TECHNICIAN':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 'TECHNICIAN':
      case 'TECHNICAL_ASSISTANT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'RECEPTIONIST':
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      case 'ACCOUNTANT':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  const formatRoleLabel = (r: string) => {
    return r.replace(/_/g, ' ');
  };

  return (
    <div id="overview-header-container" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs mb-6 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: User Greeting & Identity */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Welcome back, {data.user?.name || 'MTS Team'}
            </h1>
            <Badge variant="outline" className={`font-semibold text-xs tracking-wider uppercase px-2.5 py-0.5 border ${getRoleBadgeStyle(role)}`}>
              {formatRoleLabel(role)}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{data.user?.department || 'MTS Lab Central'}</span>
            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span>NPT Today: {data.serverTime?.serverDateNPT || 'Realtime'}</span>
              <span className="text-gray-400">({data.serverTime?.serverTime || 'Live'})</span>
            </span>
          </p>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
          <Button
            id="overview-refresh-btn"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 px-3 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>

          {/* Role specific quick action shortcuts */}
          {(role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER' || role === 'RECEPTIONIST') && (
            <Button
              id="overview-new-repair-btn"
              size="sm"
              onClick={() => navigate('/dashboard/repairs')}
              className="h-9 px-3.5 text-xs font-medium bg-primary hover:bg-primary/90 text-white shadow-xs"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              <span>New Repair</span>
            </Button>
          )}

          {(role === 'TECHNICIAN' || role === 'HEAD_TECHNICIAN' || role === 'LEAD_TECHNICIAN' || role === 'TECHNICAL_ASSISTANT') && (
            <Button
              id="overview-my-repairs-btn"
              size="sm"
              onClick={() => navigate('/dashboard/repairs')}
              className="h-9 px-3.5 text-xs font-medium bg-primary hover:bg-primary/90 text-white shadow-xs"
            >
              <Wrench className="w-4 h-4 mr-1.5" />
              <span>Repair Queue</span>
            </Button>
          )}

          {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
            <Button
              id="overview-security-btn"
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/security')}
              className="h-9 px-3 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
              <span>Security</span>
            </Button>
          )}

          {role === 'MANAGER' && (
            <Button
              id="overview-attendance-btn"
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/attendance')}
              className="h-9 px-3 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
              <span>Staff Attendance</span>
            </Button>
          )}

          {role === 'RECEPTIONIST' && (
            <Button
              id="overview-courier-btn"
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/couriers')}
              className="h-9 px-3 text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              <Truck className="w-3.5 h-3.5 mr-1.5 text-teal-600 dark:text-teal-400" />
              <span>Courier Hub</span>
            </Button>
          )}

          {role === 'ACCOUNTANT' && (
            <Button
              id="overview-revenue-btn"
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/revenue')}
              className="h-9 px-3 text-xs font-medium text-cyan-700 dark:text-cyan-400"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-cyan-600 dark:text-cyan-400" />
              <span>Revenue Hub</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
