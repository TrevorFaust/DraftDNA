import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background text-foreground">
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-center max-w-md">
            The app ran into an error. This can happen if the tab was open a long time or your session expired.
          </p>
          <Button onClick={this.handleReload} size="lg">
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
