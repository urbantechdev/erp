import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorMsg = error.message || '';
    const isExtensionError =
      errorMsg.includes('Could not establish connection') ||
      errorMsg.includes('Receiving end does not exist') ||
      errorMsg.includes('message channel closed') ||
      errorMsg.includes('Extension context invalidated');

    if (!isExtensionError) {
      console.error('[ERP Platform ErrorBoundary Caught]', error, errorInfo);
      this.setState({ errorInfo });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      sessionStorage.clear();
      // Keep essential erp data if any, or reload cleanly
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected runtime issue occurred.';

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold font-montserrat text-white">
                Application Recovered
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                The ERP platform encountered an unexpected view error. Your backend database and transaction integrity remain fully intact.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Diagnostics</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono break-words line-clamp-3">
                {errorMessage}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#FFDE00] hover:bg-[#ffe633] text-[#0A006E] font-bold rounded-xl text-xs transition shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload ERP
              </button>
              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs transition border border-slate-700"
              >
                <Home className="w-3.5 h-3.5" />
                Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
