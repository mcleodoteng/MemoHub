import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MemoProvider } from "@/context/MemoContext";
import Index from "./pages/Index";
import Memos from "./pages/Memos";
import MemoDetail from "./pages/MemoDetail";
import Compose from "./pages/Compose";
import Messages from "./pages/Messages";
import Groups from "./pages/Groups";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MemoProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/memos" element={<Memos />} />
            <Route path="/memos/:id" element={<MemoDetail />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MemoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
