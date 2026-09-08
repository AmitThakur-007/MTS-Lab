import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { ChartIntakePoint } from './types';

interface RepairTrendsChartProps {
  data: ChartIntakePoint[];
  totalWeekCount: number;
}

export const RepairTrendsChart: React.FC<RepairTrendsChartProps> = ({ data, totalWeekCount }) => {
  return (
    <div id="repair-trends-chart-card" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              7-Day Repair Intake Volume
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live registration trend in Nepal Standard Time
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-gray-400 block">7-Day Total</span>
          <span className="text-sm sm:text-base font-bold text-primary">
            {totalWeekCount} Devices
          </span>
        </div>
      </div>

      <div className="h-56 sm:h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="intakeColorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-800" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-lg border border-gray-700">
                      <p className="font-semibold text-blue-300">{p.day}, {p.date}</p>
                      <p className="mt-1 flex items-center justify-between gap-3 text-gray-200">
                        <span>Intake Volume:</span>
                        <span className="font-bold text-white text-sm">{p.count} devices</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#intakeColorGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
