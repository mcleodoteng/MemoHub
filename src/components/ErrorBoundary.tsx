import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred. Please try again.';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page not found';
      message = 'The page you are looking for does not exist.';
    } else {
      title = `Error ${error.status}`;
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Reload
          </Button>
          <Button onClick={() => navigate('/')} className="gap-2">
            <Home className="h-4 w-4" /> Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
