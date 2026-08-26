import React, { Component, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ROUTE ERROR BOUNDARY CAUGHT ERROR]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 sm:p-12 max-w-2xl mx-auto text-center space-y-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {this.props.fallbackTitle || 'Unable to load this section'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
              {this.props.fallbackDescription || 'A temporary display issue occurred while rendering this dashboard component.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button 
              onClick={this.handleRetry} 
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs h-10 px-5 gap-2 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/dashboard'} 
              className="rounded-xl border-slate-200 text-slate-700 font-bold text-xs h-10 px-5 gap-2 hover:bg-slate-50"
            >
              <Home className="w-4 h-4" /> Return to Overview
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
