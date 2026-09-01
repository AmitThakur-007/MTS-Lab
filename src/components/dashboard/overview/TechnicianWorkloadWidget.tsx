import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Wrench, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TechnicianWorkload } from './types';

interface TechnicianWorkloadWidgetProps {
  workload: TechnicianWorkload[];
}

export const TechnicianWorkloadWidget: React.FC<TechnicianWorkloadWidgetProps> = ({ workload }) => {
  const navigate = useNavigate();

  return (
    <div id="technician-workload-widget" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Technician Bench Workload
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live assignment distribution and capacity
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 font-medium">
              <th className="pb-2.5 pl-4 sm:pl-0 font-medium">Technician</th>
              <th className="pb-2.5 px-2 font-medium text-center">Active</th>
              <th className="pb-2.5 px-2 font-medium text-center">In Progress</th>
              <th className="pb-2.5 px-2 font-medium text-center">Pending</th>
              <th className="pb-2.5 px-2 font-medium text-center">Urgent</th>
              <th className="pb-2.5 pr-4 sm:pr-0 font-medium text-right">Today Done</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {workload.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400 text-xs">
                  No active technician accounts found.
                </td>
              </tr>
            ) : (
              workload.map((tech) => (
                <tr
                  key={tech.id}
                  onClick={() => navigate(`/dashboard/repairs?technicianId=${tech.id}`)}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 pl-4 sm:pl-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {tech.name}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {tech.department || 'Hardware Lab'}
                    </div>
                  </td>

                  <td className="py-3 px-2 text-center">
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {tech.activeCount}
                    </Badge>
                  </td>

                  <td className="py-3 px-2 text-center text-gray-600 dark:text-gray-300 font-medium">
                    {tech.inProgressCount}
                  </td>

                  <td className="py-3 px-2 text-center text-gray-500">
                    {tech.pendingCount}
                  </td>

                  <td className="py-3 px-2 text-center">
                    {tech.urgentCount > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300">
                        {tech.urgentCount}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>

                  <td className="py-3 pr-4 sm:pr-0 text-right font-medium text-emerald-600 dark:text-emerald-400">
                    {tech.completedToday > 0 ? `+${tech.completedToday}` : '0'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
