import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-card border border-line bg-panel p-8 text-center shadow-panel">
            <h2 className="text-[20px] font-medium text-text">Something went wrong</h2>
            <p className="mt-3 text-[15px] text-muted">
              This view failed to render. Refresh the page or try again in a moment.
            </p>
            <button
              type="button"
              className="focus-ring mt-6 rounded-full border border-line px-5 py-2.5 text-[14px] text-text"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
