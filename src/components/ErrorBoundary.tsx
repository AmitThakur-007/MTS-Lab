import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
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
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
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
        <div className="p-6 max-w-2xl mx-auto my-8">
          <Card className="p-8 rounded-3xl border border-rose-200 bg-white shadow-xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-600 shadow-sm">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900">
                {this.props.fallbackTitle || 'Something went wrong in Staff Management. Please try again.'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto">
                {this.props.fallbackMessage ||
                  'An unexpected rendering error occurred. The application remains running safely. You can reload this view to restore full functionality.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <Button
                type="button"
                onClick={this.handleReset}
                className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-slate-900/10 cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="h-4 w-4 text-indigo-400" />
                Reload Staff Management
              </Button>
              {this.props.showBackHome && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/dashboard';
                  }}
                  className="h-11 px-5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs sm:text-sm gap-2 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-500" />
                  Back to Dashboard
                </Button>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
