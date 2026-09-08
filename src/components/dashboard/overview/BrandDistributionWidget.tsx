import React from 'react';
import { Smartphone, PieChart } from 'lucide-react';
import { TopBrand } from './types';

interface BrandDistributionWidgetProps {
  brands: TopBrand[];
  totalRepairs: number;
}

export const BrandDistributionWidget: React.FC<BrandDistributionWidgetProps> = ({
  brands,
  totalRepairs,
}) => {
  return (
    <div id="brand-distribution-widget" className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              Device Brand Distribution
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Top repair intake categories
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 pt-1">
        {brands.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No brand repair records yet</p>
        ) : (
          brands.map((item, idx) => {
            const percentage = totalRepairs > 0 ? Math.round((item.count / totalRepairs) * 100) : 0;
            return (
              <div key={item.brand} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/70 inline-block" />
                    {item.brand}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {item.count} units ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(percentage, 4)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
