import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border shadow-lg text-center max-w-sm mx-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <WifiOff className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="font-display text-xl font-bold">You're offline</h2>
        <p className="text-sm text-muted-foreground">
          Go online to get the latest messages
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          Waiting for connection...
        </div>
      </div>
    </div>
  );
}
