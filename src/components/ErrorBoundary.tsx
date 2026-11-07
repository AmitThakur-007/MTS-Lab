import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  showBackHome?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught exception]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto my-8 font-sans antialiased">
          <Card className="p-6 sm:p-8 rounded-3xl border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-slate-900 shadow-xl text-center space-y-5 transition-colors">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 shadow-xs">
              <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                ERROR RECOVERY
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {this.props.fallbackTitle || 'An unexpected interface error occurred.'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
                {this.props.fallbackMessage ||
                  'The application caught a rendering exception. Your session remains secure. You can retry this component or return to the dashboard.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <Button
                type="button"
                onClick={this.handleReset}
                className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs sm:text-sm gap-2 shadow-sm cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="h-4 w-4 text-cyan-400 dark:text-slate-950" />
                Retry Component
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs sm:text-sm gap-2 cursor-pointer"
              >
                <Home className="h-4 w-4 text-slate-400" />
                Dashboard Home
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
