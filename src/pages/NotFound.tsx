import { Smartphone, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4 font-sans antialiased">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-400 dark:text-slate-500">
          <HelpCircle size={48} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-4 text-slate-950 dark:text-white">404 - Page Not Found</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved. 
          If you're a customer, please check your repair ID or return to the home page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button variant="outline" className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold">
              Go to Homepage
            </Button>
          </Link>
          <Link to="/track">
            <Button className="w-full rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold">
              Track Repair
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
