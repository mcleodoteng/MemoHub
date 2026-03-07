import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MemoProvider } from "@/context/MemoContext";
import { GroupProvider } from "@/context/GroupContext";
import { MessageProvider } from "@/context/MessageContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MemoProvider>
        <GroupProvider>
          <MessageProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/memos" element={<Memos />} />
                <Route path="/memos/:id" element={<MemoDetail />} />
                <Route path="/compose" element={<Compose />} />
                <Route path="/compose/:draftId" element={<Compose />} />
                <Route path="/drafts" element={<Drafts />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/groups/:id" element={<GroupDetail />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<UserProfile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </MessageProvider>
        </GroupProvider>
      </MemoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
