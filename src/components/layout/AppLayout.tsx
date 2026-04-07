import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/context/UserContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getWorkflowPendingCountForUser } from "@/lib/workflow";
import { memoPath } from "@/lib/memo-url";
import { NotificationPanel } from "./NotificationPanel";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded-sm px-0 not-italic"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { memos } = useMemos();
  const { conversations, messages } = useMessages();
  const { unreadCount } = useNotifications();
  const { currentUser } = useAuth();
  const { getUserById } = useUsers();
  const currentUserId = currentUser?.id || "";

  const pendingWorkflowUnread = useMemo(
    () => getWorkflowPendingCountForUser(memos, currentUserId),
    [memos, currentUserId],
  );
  const headerNotificationCount = unreadCount + pendingWorkflowUnread;

  const searchResults = useMemo(() => {
    if (!search.trim()) return { memos: [], conversations: [], messages: [] };
    const q = search.toLowerCase();
    const matchedMemos = memos
      .filter((m) => m.status !== "draft" && m.status !== "deleted")
      .filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          stripHtml(m.body).toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 5);
    const matchedConvos = conversations
      .filter((c) => {
        const name =
          c.name ||
          c.participantIds.map((id) => getUserById(id)?.name || "").join(", ");
        return (
          name.toLowerCase().includes(q) ||
          c.lastMessage?.body.toLowerCase().includes(q)
        );
      })
      .slice(0, 3);
    const matchedMessages = messages
      .filter((m) => !m.isDeleted && !!m.body?.trim())
      .filter((m) => m.body.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);
    return {
      memos: matchedMemos,
      conversations: matchedConvos,
      messages: matchedMessages,
    };
  }, [search, memos, conversations, messages, getUserById]);

  const hasResults =
    searchResults.memos.length > 0 ||
    searchResults.conversations.length > 0 ||
    searchResults.messages.length > 0;

  const searchDropdown = search.trim() && searchOpen && (
    <div className="absolute top-full mt-1 left-0 right-0 bg-popover border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
      {!hasResults ? (
        <p className="text-sm text-muted-foreground p-3 text-center">
          No results found
        </p>
      ) : (
        <div className="py-1">
          {searchResults.memos.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5 uppercase tracking-wider">
                Memos
              </p>
              {searchResults.memos.map((m) => (
                <button
                  key={m.id}
                  className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex flex-col gap-0.5"
                  onClick={() => {
                    navigate(memoPath(m));
                    setSearch("");
                    setSearchOpen(false);
                    setMobileSearchOpen(false);
                  }}
                >
                  <span className="text-sm font-medium line-clamp-1">
                    {highlightText(m.title, search)}
                  </span>
                  <span className="text-[11px] text-muted-foreground line-clamp-1">
                    {highlightText(stripHtml(m.body), search)}
                  </span>
                </button>
              ))}
            </>
          )}
          {searchResults.conversations.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5 uppercase tracking-wider border-t">
                Chats
              </p>
              {searchResults.conversations.map((c) => {
                const name =
                  c.name ||
                  c.participantIds
                    .map((id) => getUserById(id)?.name || "")
                    .join(", ");
                return (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex flex-col gap-0.5"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("conversationId", c.id);
                      if (c.lastMessage?.id) {
                        params.set("messageId", c.lastMessage.id);
                      }
                      navigate(`/messages?${params.toString()}`);
                      setSearch("");
                      setSearchOpen(false);
                      setMobileSearchOpen(false);
                    }}
                  >
                    <span className="text-sm font-medium line-clamp-1">
                      {highlightText(name, search)}
                    </span>
                    {c.lastMessage && (
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {highlightText(c.lastMessage.body, search)}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {searchResults.messages.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5 uppercase tracking-wider border-t">
                Messages
              </p>
              {searchResults.messages.map((message) => {
                const conversation = conversations.find(
                  (c) => c.id === message.conversationId,
                );
                const conversationName =
                  conversation?.name ||
                  conversation?.participantIds
                    ?.map((id) => getUserById(id)?.name || "")
                    .join(", ") ||
                  "Conversation";

                return (
                  <button
                    key={message.id}
                    className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex flex-col gap-0.5"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("conversationId", message.conversationId);
                      params.set("messageId", message.id);
                      navigate(`/messages?${params.toString()}`);
                      setSearch("");
                      setSearchOpen(false);
                      setMobileSearchOpen(false);
                    }}
                  >
                    <span className="text-sm font-medium line-clamp-1">
                      {highlightText(conversationName, search)}
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {highlightText(message.body, search)}
                    </span>
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                className="pl-9 h-9 bg-secondary border-none text-sm pr-8"
                autoComplete="off"
              />
              {search && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              {searchDropdown}
            </div>

            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            >
              <Search className="h-5 w-5" />
            </Button>

            <NotificationPanel unreadCount={headerNotificationCount} />
          </header>

          {/* Mobile search bar */}
          {mobileSearchOpen && isMobile && (
            <div className="relative px-3 py-2 border-b bg-card">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                className="pl-9 h-9 bg-secondary border-none text-sm"
                autoFocus
              />
              {searchDropdown}
            </div>
          )}

          <main
            className="flex-1 overflow-auto p-3 md:p-6"
            onClick={() => {
              setSearchOpen(false);
              setMobileSearchOpen(false);
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
