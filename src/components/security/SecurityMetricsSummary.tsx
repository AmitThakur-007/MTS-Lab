import React from 'react';
import { Users, Radio, Smartphone, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SecurityMetricsSummaryProps {
  stats: {
    totalStaff: number;
    activeStaffNow: number;
    totalDevices: number;
    blockedDevices: number;
    securityAlertsCount: number;
    pendingAccessRequests: number;
  };
  loading?: boolean;
}

export default function SecurityMetricsSummary({ stats, loading }: SecurityMetricsSummaryProps) {
  const cards = [
    {
      id: 'metric-total-staff',
      title: 'Total Staff Accounts',
      value: stats.totalStaff,
      description: 'Authorized personnel profiles',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600',
      borderAccent: 'border-l-4 border-l-blue-600',
    },
    {
      id: 'metric-active-staff',
      title: 'Active Staff Right Now',
      value: stats.activeStaffNow,
      description: 'Active in past 15 minutes',
      icon: Radio,
      iconBg: 'bg-emerald-50 text-emerald-600',
      borderAccent: 'border-l-4 border-l-emerald-600',
      liveBeacon: true,
    },
    {
      id: 'metric-registered-devices',
      title: 'Total Registered Devices',
      value: stats.totalDevices,
      description: 'Enrolled workstation & mobile fingerprints',
      icon: Smartphone,
      iconBg: 'bg-indigo-50 text-indigo-600',
      borderAccent: 'border-l-4 border-l-indigo-600',
    },
    {
      id: 'metric-blocked-devices',
      title: 'Blocked / Revoked Devices',
      value: stats.blockedDevices,
      description: 'Hardware restricted from access',
      icon: ShieldAlert,
      iconBg: 'bg-rose-50 text-rose-600',
      borderAccent: 'border-l-4 border-l-rose-600',
      highlight: stats.blockedDevices > 0,
    },
    {
      id: 'metric-security-alerts',
      title: 'Security Alerts (24h)',
      value: stats.securityAlertsCount,
      description: 'Failed logins & policy violations',
      icon: AlertTriangle,
      iconBg: stats.securityAlertsCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600',
      borderAccent: stats.securityAlertsCount > 0 ? 'border-l-4 border-l-amber-600' : 'border-l-4 border-l-slate-400',
      highlight: stats.securityAlertsCount > 0,
    },
  ];

  return (
    <div id="security-metrics-summary-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card 
            key={card.id} 
            id={card.id} 
            className={`shadow-xs border border-slate-200/80 bg-white transition-all duration-200 hover:shadow-md ${card.borderAccent}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                  {card.title}
                </p>
                <div className={`p-2 rounded-lg shrink-0 ${card.iconBg} relative`}>
                  <Icon className="w-4 h-4" />
                  {card.liveBeacon && stats.activeStaffNow > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  {loading ? '—' : card.value}
                </span>
                {card.liveBeacon && stats.activeStaffNow > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-emerald-100 text-emerald-800">
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
