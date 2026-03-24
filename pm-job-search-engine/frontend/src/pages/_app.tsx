import type { AppProps } from 'next/app';
import React from 'react';
import { Toaster } from 'sonner';
import '../styles/globals.css';

type AppErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Frontend runtime error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-2xl w-full bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-red-700 mb-2">Application Error</h1>
            <p className="text-gray-700 mb-3">
              A runtime error occurred. Refresh the page. If this keeps happening, share the message below.
            </p>
            <pre className="bg-red-50 border border-red-100 rounded p-3 text-sm text-red-900 whitespace-pre-wrap">
              {this.state.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppErrorBoundary>
      <Component {...pageProps} />
      <Toaster position="top-right" richColors closeButton />
    </AppErrorBoundary>
  );
}
