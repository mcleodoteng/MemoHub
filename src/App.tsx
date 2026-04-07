import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { SocketProvider } from "@/context/SocketContext";
import { MemoProvider } from "@/context/MemoContext";
import { GroupProvider } from "@/context/GroupContext";
import { MessageProvider } from "@/context/MessageContext";
import { ReminderProvider } from "@/context/ReminderContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { RoleProvider } from "@/context/RoleContext";
import { TagProvider } from "@/context/TagContext";
import { TemplateProvider } from "@/context/TemplateContext";
import { RouteErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Memos from "./pages/Memos";
import MemoDetail from "./pages/MemoDetail";
import Compose from "./pages/Compose";
import Messages from "./pages/Messages";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Drafts from "./pages/Drafts";
import Reminders from "./pages/Reminders";
import WorkflowDashboard from "./pages/WorkflowDashboard";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SetupPassword from "./pages/SetupPassword";
import NotFound from "./pages/NotFound";
import { ReminderAlerts } from "@/components/reminder/ReminderAlerts";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

const queryClient = new QueryClient();

/** Applies the current user's saved theme on every page and after login/logout. */
function ThemeManager() {
  const { currentUser } = useAuth();
  const userId = (currentUser as { id?: string } | null)?.id ?? "anonymous";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`memohub_settings_${userId}`);
      const settings = raw ? JSON.parse(raw) : {};
      const theme: string = settings?.appearance?.theme ?? "light";
      const compact: boolean = settings?.appearance?.compactMode ?? false;
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("compact-mode", compact);
      // Keep global keys in sync so theme-init.js uses them on the next cold load.
      localStorage.setItem("memohub_theme", theme);
      localStorage.setItem("memohub_compact", String(compact));
    } catch {
      // Storage may be unavailable; fall back gracefully.
    }
  }, [userId]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Loading MemoHub...</p>
            <p className="text-xs text-muted-foreground">
              Restoring your session
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/login", element: <Login />, errorElement: <RouteErrorBoundary /> },
  {
    path: "/register",
    element: <Register />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/setup-password",
    element: <SetupPassword />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Index />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/memos",
    element: (
      <ProtectedRoute>
        <Memos />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/memos/:id",
    element: (
      <ProtectedRoute>
        <MemoDetail />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/compose",
    element: (
      <ProtectedRoute>
        <Compose />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/compose/:draftId",
    element: (
      <ProtectedRoute>
        <Compose />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/drafts",
    element: (
      <ProtectedRoute>
        <Drafts />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/messages",
    element: (
      <ProtectedRoute>
        <Messages />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/groups",
    element: (
      <ProtectedRoute>
        <Groups />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/groups/:id",
    element: (
      <ProtectedRoute>
        <GroupDetail />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/notifications",
    element: (
      <ProtectedRoute>
        <Notifications />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/profile/:userId",
    element: (
      <ProtectedRoute>
        <UserProfile />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/reminders",
    element: (
      <ProtectedRoute>
        <Reminders />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/workflow",
    element: (
      <ProtectedRoute>
        <WorkflowDashboard />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/reports",
    element: (
      <ProtectedRoute>
        <Reports />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  { path: "*", element: <NotFound /> },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <UserProvider>
          <SocketProvider>
            <RoleProvider>
              <TemplateProvider>
                <TagProvider>
                  <MemoProvider>
                    <GroupProvider>
                      <MessageProvider>
                        <ReminderProvider>
                          <NotificationProvider>
                            <ThemeManager />
                            <OfflineBanner />
                            <Toaster />
                            <Sonner
                              position="bottom-right"
                              style={
                                {
                                  "--offset": "24px",
                                  right: "48px",
                                } as React.CSSProperties
                              }
                            />
                            <ReminderAlerts />
                            <RouterProvider router={router} />
                          </NotificationProvider>
                        </ReminderProvider>
                      </MessageProvider>
                    </GroupProvider>
                  </MemoProvider>
                </TagProvider>
              </TemplateProvider>
            </RoleProvider>
          </SocketProvider>
        </UserProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
