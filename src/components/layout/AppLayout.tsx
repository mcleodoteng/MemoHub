import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { currentUser, getUserById } from "@/data/mock";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { useNotifications } from "@/context/NotificationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getWorkflowPendingCountForUser } from "@/lib/workflow";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { memos } = useMemos();
  const { conversations } = useMessages();
  const { unreadCount } = useNotifications();

  const pendingWorkflowUnread = useMemo(
    () => getWorkflowPendingCountForUser(memos, currentUser.id),
    [memos],
  );
  const headerNotificationCount = unreadCount + pendingWorkflowUnread;

  const searchResults = useMemo(() => {
    if (!search.trim()) return { memos: [], conversations: [] };
    const q = search.toLowerCase();
    const matchedMemos = memos
      .filter(m => m.status !== 'draft' && m.status !== 'deleted')
      .filter(m =>
        m.title.toLowerCase().includes(q) ||
        stripHtml(m.body).toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
      ).slice(0, 5);
    const matchedConvos = conversations.filter(c => {
      const name = c.name || c.participantIds.map(id => getUserById(id)?.name || '').join(', ');
      return name.toLowerCase().includes(q) || (c.lastMessage?.body.toLowerCase().includes(q));
    }).slice(0, 3);
    return { memos: matchedMemos, conversations: matchedConvos };
  }, [search, memos, conversations]);

  const hasResults = searchResults.memos.length > 0 || searchResults.conversations.length > 0;

  const searchDropdown = search.trim() && searchOpen && (
    <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
      {!hasResults ? (
        <p className="text-sm text-muted-foreground p-3 text-center">No results found</p>
      ) : (
        <div className="py-1">
          {searchResults.memos.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5 uppercase tracking-wider">Memos</p>
              {searchResults.memos.map(m => (
                <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex flex-col gap-0.5"
                  onClick={() => { navigate(`/memos/${m.id}`); setSearch(""); setSearchOpen(false); setMobileSearchOpen(false); }}>
                  <span className="text-sm font-medium line-clamp-1">{m.title}</span>
                  <span className="text-[11px] text-muted-foreground line-clamp-1">{stripHtml(m.body)}</span>
                </button>
              ))}
            </>
          )}
          {searchResults.conversations.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5 uppercase tracking-wider border-t">Messages</p>
              {searchResults.conversations.map(c => {
                const name = c.name || c.participantIds.map(id => getUserById(id)?.name || '').join(', ');
                return (
                  <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex flex-col gap-0.5"
                    onClick={() => { navigate(`/messages`); setSearch(""); setSearchOpen(false); setMobileSearchOpen(false); }}>
                    <span className="text-sm font-medium line-clamp-1">{name}</span>
                    {c.lastMessage && <span className="text-[11px] text-muted-foreground line-clamp-1">{c.lastMessage.body}</span>}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 md:gap-3 border-b bg-card px-3 md:px-4 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="shrink-0" />
              </TooltipTrigger>
              <TooltipContent>Toggle sidebar navigation</TooltipContent>
            </Tooltip>
            {title && (
              <h1 className="font-display text-base md:text-lg font-semibold truncate">
                {title}
              </h1>
            )}
            <div className="flex-1" />

            {/* Desktop search */}
            <div className="relative max-w-xs hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search memos, messages..."
                value={search}
                onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                className="pl-9 h-9 bg-secondary border-none text-sm pr-8"
              />
              {search && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setSearch(""); setSearchOpen(false); }}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              {searchDropdown}
            </div>

            {/* Mobile search toggle */}
            <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setMobileSearchOpen(!mobileSearchOpen)}>
              <Search className="h-5 w-5" />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative shrink-0"
                  onClick={() => navigate("/notifications")}
                >
                  <Bell className="h-5 w-5" />
                  {headerNotificationCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {headerNotificationCount > 9 ? "9+" : headerNotificationCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>View notifications ({headerNotificationCount} unread)</TooltipContent>
            </Tooltip>
          </header>

          {/* Mobile search bar */}
          {mobileSearchOpen && isMobile && (
            <div className="relative px-3 py-2 border-b bg-card">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                className="pl-9 h-9 bg-secondary border-none text-sm"
                autoFocus
              />
              {searchDropdown}
            </div>
          )}

          <main className="flex-1 overflow-auto p-3 md:p-6" onClick={() => { setSearchOpen(false); setMobileSearchOpen(false); }}>{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
