import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MemoProvider } from "@/context/MemoContext";
import { GroupProvider } from "@/context/GroupContext";
import { MessageProvider } from "@/context/MessageContext";
import { ReminderProvider } from "@/context/ReminderContext";
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
import NotFound from "./pages/NotFound";
import { ReminderAlerts } from "@/components/reminder/ReminderAlerts";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Index /> },
  { path: "/memos", element: <Memos /> },
  { path: "/memos/:id", element: <MemoDetail /> },
  { path: "/compose", element: <Compose /> },
  { path: "/compose/:draftId", element: <Compose /> },
  { path: "/drafts", element: <Drafts /> },
  { path: "/messages", element: <Messages /> },
  { path: "/groups", element: <Groups /> },
  { path: "/groups/:id", element: <GroupDetail /> },
  { path: "/notifications", element: <Notifications /> },
  { path: "/profile", element: <Profile /> },
  { path: "/profile/:userId", element: <UserProfile /> },
  { path: "/reminders", element: <Reminders /> },
  { path: "*", element: <NotFound /> },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MemoProvider>
        <GroupProvider>
          <MessageProvider>
            <ReminderProvider>
              <Toaster />
              <Sonner />
              <ReminderAlerts />
              <RouterProvider router={router} />
            </ReminderProvider>
          </MessageProvider>
        </GroupProvider>
      </MemoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
