import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { MemoProvider } from "@/context/MemoContext";
import { GroupProvider } from "@/context/GroupContext";
import { MessageProvider } from "@/context/MessageContext";
import { ReminderProvider } from "@/context/ReminderContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { RoleProvider } from "@/context/RoleContext";
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
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { ReminderAlerts } from "@/components/reminder/ReminderAlerts";
import { OfflineBanner } from "@/components/OfflineBanner";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/login", element: <Login />, errorElement: <RouteErrorBoundary /> },
  { path: "/forgot-password", element: <ForgotPassword />, errorElement: <RouteErrorBoundary /> },
  { path: "/reset-password", element: <ResetPassword />, errorElement: <RouteErrorBoundary /> },
  { path: "/", element: <ProtectedRoute><Index /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/memos", element: <ProtectedRoute><Memos /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/memos/:id", element: <ProtectedRoute><MemoDetail /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/compose", element: <ProtectedRoute><Compose /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/compose/:draftId", element: <ProtectedRoute><Compose /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/drafts", element: <ProtectedRoute><Drafts /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/messages", element: <ProtectedRoute><Messages /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/groups", element: <ProtectedRoute><Groups /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/groups/:id", element: <ProtectedRoute><GroupDetail /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/notifications", element: <ProtectedRoute><Notifications /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/profile", element: <ProtectedRoute><Profile /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/profile/:userId", element: <ProtectedRoute><UserProfile /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/reminders", element: <ProtectedRoute><Reminders /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/workflow", element: <ProtectedRoute><WorkflowDashboard /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/settings", element: <ProtectedRoute><Settings /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "/reports", element: <ProtectedRoute><Reports /></ProtectedRoute>, errorElement: <RouteErrorBoundary /> },
  { path: "*", element: <NotFound /> },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RoleProvider>
          <TemplateProvider>
            <MemoProvider>
              <GroupProvider>
                <MessageProvider>
                  <ReminderProvider>
                    <NotificationProvider>
                      <OfflineBanner />
                      <Sonner />
                      <ReminderAlerts />
                      <RouterProvider router={router} />
                    </NotificationProvider>
                  </ReminderProvider>
                </MessageProvider>
              </GroupProvider>
            </MemoProvider>
          </TemplateProvider>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
