import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Users,
  Bell,
  PenSquare,
  ChevronDown,
  FileEdit,
  Tag,
  Clock,
  Trash2,
  Star,
  PanelLeftClose,
  PanelLeft,
  GitMerge,
  Settings,
  LayoutTemplate,
  LogOut,
  FileBarChart,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/user-utils";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { useGroups } from "@/context/GroupContext";
import { useReminders } from "@/context/ReminderContext";
import { useNotifications } from "@/context/NotificationContext";
import { useTags } from "@/context/TagContext";
import { useRoles } from "@/context/RoleContext";
import { getWorkflowPendingCountForUser } from "@/lib/workflow";

export function AppSidebar() {
  const sidebarContext = useSidebar();
  const { state, toggleSidebar } = sidebarContext;
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { memos } = useMemos();
  const { conversations, getUnreadCount } = useMessages();
  const { groups } = useGroups();
  const { reminders } = useReminders();
  const { unreadCount: unreadNotificationCount } = useNotifications();
  const { tags: systemTags } = useTags();
  const { hasPermission } = useRoles();

  const userId = currentUser?.id || "";
  const canAccessReports = hasPermission("canAccessReports");
  const canManageTemplates = hasPermission("canManageTemplates");

  const pendingApprovals = memos.filter((m) =>
    m.recipientStatuses.some(
      (s) => s.userId === userId && s.opened && !s.approved,
    ),
  ).length;
  const draftCount = memos.filter(
    (m) => m.status === "draft" && m.creatorId === userId,
  ).length;

  const allMemosCount = memos.filter(
    (m) =>
      m.status !== "deleted" &&
      m.status !== "draft" &&
      !(m.hiddenBy || []).includes(userId) &&
      (m.creatorId === userId ||
        m.recipientIds.includes(userId) ||
        m.visibility === "public"),
  ).length;

  const starredCount = memos.filter(
    (m) => m.status !== "deleted" && (m.starredBy || []).includes(userId),
  ).length;

  const pendingWorkflowApprovals = getWorkflowPendingCountForUser(
    memos,
    userId,
  );

  const reminderCount = reminders.filter((reminder) => {
    const isMine = reminder.userId === userId;
    const isMyGroupReminder =
      Boolean(reminder.groupId) &&
      groups.some(
        (group) =>
          group.id === reminder.groupId && group.memberIds.includes(userId),
      );
    return !reminder.fired && (isMine || isMyGroupReminder);
  }).length;

  const getConversationUnread = (conversation: (typeof conversations)[0]) => {
    const exactUnread = getUnreadCount(conversation.id, userId);
    if (exactUnread > 0) return exactUnread;

    const lastMessage = conversation.lastMessage;
    if (!lastMessage) return 0;

    const isFromMe = lastMessage.senderId === userId;
    const isRead = (lastMessage.readBy || []).includes(userId);
    return !isFromMe && !isRead ? 1 : 0;
  };

  const unreadMessages = conversations.reduce(
    (total, conversation) => total + getConversationUnread(conversation),
    0,
  );
  const unreadNotifications =
    unreadNotificationCount + pendingWorkflowApprovals;

  const myGroups = groups.filter((g) => g.memberIds.includes(userId));
  const getGroupUnreadCount = (groupId: string, groupName: string) => {
    const groupConversation =
      conversations.find((c) => c.groupId === groupId) ||
      conversations.find((c) => c.type === "group" && c.name === groupName);

    if (!groupConversation) return 0;
    return getUnreadCount(groupConversation.id, userId);
  };
  const totalGroupUnread = myGroups.reduce(
    (total, group) => total + getGroupUnreadCount(group.id, group.name),
    0,
  );

  const systemTagNames = Array.from(
    new Set(systemTags.map((tag) => tag.name).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const activeTag =
    location.pathname === "/memos"
      ? new URLSearchParams(location.search).get("tag")
      : null;

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  const mainNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, badge: 0 },
    {
      title: "Messages",
      url: "/messages",
      icon: MessageSquare,
      badge: unreadMessages,
    },
    {
      title: "Reminders",
      url: "/reminders",
      icon: Clock,
      badge: reminderCount,
    },
    {
      title: "Notifications",
      url: "/notifications",
      icon: Bell,
      badge: unreadNotifications,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: FileBarChart,
      badge: 0,
    },
  ].filter((item) => item.url !== "/reports" || canAccessReports);

  const renderNavItem = (item: (typeof mainNav)[0]) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        tooltip={item.title}
      >
        <NavLink
          to={item.url}
          end={item.url === "/"}
          className="nav-item text-sidebar-foreground"
          activeClassName="nav-item-active"
        >
          <div className="relative">
            <item.icon className="h-4 w-4 shrink-0" />
            {item.badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="flex items-center justify-between flex-1">
              {item.title}
              {item.badge > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                  {item.badge}
                </span>
              )}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const deletedCount = memos.filter(
    (m) =>
      m.status === "deleted" &&
      ((m as any).deletedBy === userId || m.creatorId === userId),
  ).length;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "p-3 transition-all duration-300",
          collapsed ? "px-1.5" : "p-4",
        )}
      >
        <div
          className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-2" : "gap-3",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center rounded-lg bg-sidebar-primary transition-all duration-300",
              collapsed ? "h-9 w-9" : "h-8 w-8",
            )}
          >
            <FileText className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-bold text-sidebar-accent-foreground flex-1">
              MemoHub
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-300",
              collapsed ? "h-8 w-8" : "h-7 w-7",
            )}
            onClick={toggleSidebar}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 overflow-y-auto scroll-smooth scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{mainNav.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Memos - Expandable */}
        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroupLabel
              asChild
              className="text-sidebar-muted text-xs uppercase tracking-wider"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                Memos
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/memos")}
                      tooltip="All Memos"
                    >
                      <NavLink
                        to="/memos"
                        className="nav-item text-sidebar-foreground"
                        activeClassName="nav-item-active"
                      >
                        <div className="relative">
                          <FileText className="h-4 w-4 shrink-0" />
                          {pendingApprovals > 0 ? (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                              {pendingApprovals > 9 ? "9+" : pendingApprovals}
                            </span>
                          ) : allMemosCount > 0 ? (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                              {allMemosCount > 9 ? "9+" : allMemosCount}
                            </span>
                          ) : null}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center justify-between flex-1">
                            All Memos
                            <span className="ml-auto flex items-center gap-1">
                              {pendingApprovals > 0 && (
                                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                  {pendingApprovals}
                                </span>
                              )}
                              {allMemosCount > 0 && (
                                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                  {allMemosCount}
                                </span>
                              )}
                            </span>
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/compose")}
                      tooltip="Compose"
                    >
                      <NavLink
                        to="/compose"
                        className="nav-item text-sidebar-foreground"
                        activeClassName="nav-item-active"
                      >
                        <PenSquare className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Compose</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/drafts")}
                      tooltip="Drafts"
                    >
                      <NavLink
                        to="/drafts"
                        className="nav-item text-sidebar-foreground"
                        activeClassName="nav-item-active"
                      >
                        <div className="relative">
                          <FileEdit className="h-4 w-4 shrink-0" />
                          {draftCount > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                              {draftCount > 9 ? "9+" : draftCount}
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center justify-between flex-1">
                            Drafts
                            {draftCount > 0 && (
                              <span className="ml-auto rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                                {draftCount}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {canManageTemplates && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive("/templates")}
                        tooltip="Templates"
                      >
                        <NavLink
                          to="/templates"
                          className="nav-item text-sidebar-foreground"
                          activeClassName="nav-item-active"
                        >
                          <LayoutTemplate className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>Templates</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/workflow"}
                      tooltip="Workflow Dashboard"
                    >
                      <NavLink
                        to="/workflow"
                        className="nav-item text-sidebar-foreground"
                        activeClassName="nav-item-active"
                      >
                        <div className="relative">
                          <GitMerge className="h-4 w-4 shrink-0" />
                          {pendingWorkflowApprovals > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                              {pendingWorkflowApprovals > 9
                                ? "9+"
                                : pendingWorkflowApprovals}
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center justify-between flex-1">
                            Workflow
                            {pendingWorkflowApprovals > 0 && (
                              <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                {pendingWorkflowApprovals}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Starred">
                      <button
                        onClick={() => navigate("/memos?tab=starred")}
                        className={`nav-item text-sidebar-foreground w-full flex items-center gap-2 ${location.pathname === "/memos" && location.search.includes("tab=starred") ? "nav-item-active" : ""}`}
                      >
                        <div className="relative">
                          <Star className="h-4 w-4 shrink-0" />
                          {starredCount > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-warning-foreground">
                              {starredCount > 9 ? "9+" : starredCount}
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center justify-between flex-1">
                            Starred
                            {starredCount > 0 && (
                              <span className="ml-auto rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                                {starredCount}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Trash">
                      <button
                        onClick={() => navigate("/memos?tab=deleted")}
                        className={`nav-item text-sidebar-foreground w-full flex items-center gap-2 ${location.pathname === "/memos" && location.search.includes("tab=deleted") ? "nav-item-active" : ""}`}
                      >
                        <div className="relative">
                          <Trash2 className="h-4 w-4 shrink-0" />
                          {deletedCount > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                              {deletedCount > 9 ? "9+" : deletedCount}
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center justify-between flex-1">
                            Trash
                            {deletedCount > 0 && (
                              <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                {deletedCount}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Groups - Expandable */}
        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroupLabel
              asChild
              className="text-sidebar-muted text-xs uppercase tracking-wider"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                Groups
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/groups"}
                      tooltip="All Groups"
                    >
                      <NavLink
                        to="/groups"
                        end
                        className="nav-item text-sidebar-foreground"
                        activeClassName="nav-item-active"
                      >
                        <div className="relative">
                          <Users className="h-4 w-4 shrink-0" />
                          {totalGroupUnread > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                              {totalGroupUnread > 9 ? "9+" : totalGroupUnread}
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center justify-between flex-1">
                            All Groups
                            {totalGroupUnread > 0 && (
                              <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                {totalGroupUnread > 99
                                  ? "99+"
                                  : totalGroupUnread}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {!collapsed &&
                    myGroups.map((g) => (
                      <SidebarMenuItem key={g.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === `/groups/${g.id}`}
                          tooltip={g.name}
                        >
                          <NavLink
                            to={`/groups/${g.id}`}
                            className="nav-item text-sidebar-foreground"
                            activeClassName="nav-item-active"
                          >
                            <span className="h-4 w-4 shrink-0 flex items-center justify-center rounded bg-primary/10 text-primary text-[9px] font-bold">
                              {g.name[0]}
                            </span>
                            <span className="truncate">{g.name}</span>
                            {getGroupUnreadCount(g.id, g.name) > 0 && (
                              <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                {getGroupUnreadCount(g.id, g.name) > 99
                                  ? "99+"
                                  : getGroupUnreadCount(g.id, g.name)}
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Tags */}
        {!collapsed && systemTagNames.length > 0 && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel
                asChild
                className="text-sidebar-muted text-xs uppercase tracking-wider"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  Tags
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <div className="flex flex-wrap gap-1.5 px-3 py-2">
                    {systemTagNames.map((tag) => {
                      return (
                        <button
                          key={tag}
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full transition-colors ${
                            activeTag === tag
                              ? "bg-sidebar-primary/25 text-sidebar-foreground"
                              : "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary/20"
                          }`}
                          onClick={() =>
                            navigate(
                              `/memos?tab=all&tag=${encodeURIComponent(tag)}`,
                            )
                          }
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip="Settings"
            >
              <NavLink
                to="/settings"
                className="nav-item text-sidebar-foreground"
                activeClassName="nav-item-active"
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={currentUser?.name || "Profile"}>
              <NavLink
                to="/profile"
                className="nav-item text-sidebar-foreground"
                activeClassName="nav-item-active"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                    {getUserInitials(currentUser?.name || "")}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-sidebar-accent-foreground truncate">
                      {currentUser?.name}
                    </span>
                    <span className="text-xs text-sidebar-muted truncate">
                      {currentUser?.department} ·{" "}
                      <span className="capitalize">
                        {currentUser?.role?.replace("_", " ")}
                      </span>
                    </span>
                  </div>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Logout">
              <div
                role="button"
                tabIndex={0}
                onClick={logout}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    logout();
                  }
                }}
                className="nav-item text-sidebar-foreground w-full flex items-center gap-2"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
