import {
  LayoutDashboard, FileText, MessageSquare, Users,
  Bell, PenSquare, ChevronDown, FileEdit, Tag, ChevronRight,
  Clock, Trash2, Star, PanelLeftClose, PanelLeft, GitMerge, Settings, LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getUserInitials, tags as allTags } from "@/data/mock";
import { useAuth } from "@/context/AuthContext";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { useGroups } from "@/context/GroupContext";
import { getWorkflowPendingCountForUser } from "@/lib/workflow";
import { useState } from "react";

export function AppSidebar() {
  const sidebarContext = useSidebar();
  const { state, toggleSidebar } = sidebarContext;
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { memos } = useMemos();
  const { conversations } = useMessages();
  const { groups } = useGroups();
  const [showAllTags, setShowAllTags] = useState(false);

  const pendingApprovals = memos.filter(m =>
    m.recipientStatuses.some(s => s.userId === currentUser.id && s.opened && !s.approved)
  ).length;
  const draftCount = memos.filter(m => m.status === 'draft' && m.creatorId === currentUser.id).length;

  const pendingWorkflowApprovals = getWorkflowPendingCountForUser(memos, currentUser.id);

  const unreadMessages = conversations.filter(c =>
    c.lastMessage && !c.lastMessage.readBy.includes(currentUser.id)
  ).length;
  const unreadNotifications = pendingApprovals + unreadMessages + pendingWorkflowApprovals;

  const myGroups = groups.filter(g => g.memberIds.includes(currentUser.id));

  // Collect all used tags from memos
  const usedTags = Array.from(new Set(memos.flatMap(m => m.tags)));
  const displayTags = showAllTags ? usedTags : usedTags.slice(0, 5);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const mainNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, badge: 0 },
    { title: "Messages", url: "/messages", icon: MessageSquare, badge: unreadMessages },
    { title: "Reminders", url: "/reminders", icon: Clock, badge: 0 },
    { title: "Notifications", url: "/notifications", icon: Bell, badge: unreadNotifications },
  ];

  const renderNavItem = (item: typeof mainNav[0]) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
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

  const deletedCount = memos.filter(m => m.status === 'deleted' && (m as any).deletedBy === currentUser.id).length;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("p-3 transition-all duration-300", collapsed ? "px-1.5" : "p-4")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-3")}>
          <div className={cn(
            "flex items-center justify-center rounded-lg bg-sidebar-primary transition-all duration-300",
            collapsed ? "h-9 w-9" : "h-8 w-8"
          )}>
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
              collapsed ? "h-8 w-8" : "h-7 w-7"
            )}
            onClick={toggleSidebar}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 overflow-y-auto scroll-smooth scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{mainNav.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Memos - Expandable */}
        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroupLabel asChild className="text-sidebar-muted text-xs uppercase tracking-wider">
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                Memos
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/memos")} tooltip="All Memos">
                      <NavLink to="/memos" className="nav-item text-sidebar-foreground" activeClassName="nav-item-active">
                        <div className="relative">
                          <FileText className="h-4 w-4 shrink-0" />
                          {pendingApprovals > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                              {pendingApprovals > 9 ? "9+" : pendingApprovals}
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center justify-between flex-1">
                            All Memos
                            {pendingApprovals > 0 && (
                              <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                                {pendingApprovals}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/compose")} tooltip="Compose">
                      <NavLink to="/compose" className="nav-item text-sidebar-foreground" activeClassName="nav-item-active">
                        <PenSquare className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Compose</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/drafts")} tooltip="Drafts">
                      <NavLink to="/drafts" className="nav-item text-sidebar-foreground" activeClassName="nav-item-active">
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
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname === "/workflow"} tooltip="Workflow Dashboard">
                      <NavLink to="/workflow" className="nav-item text-sidebar-foreground" activeClassName="nav-item-active">
                        <div className="relative">
                          <GitMerge className="h-4 w-4 shrink-0" />
                          {pendingWorkflowApprovals > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                              {pendingWorkflowApprovals > 9 ? "9+" : pendingWorkflowApprovals}
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
                      <button onClick={() => navigate("/memos?tab=starred")} className={`nav-item text-sidebar-foreground w-full flex items-center gap-2 ${location.pathname === '/memos' && location.search.includes('tab=starred') ? 'nav-item-active' : ''}`}>
                        <Star className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Starred</span>}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Trash">
                      <button onClick={() => navigate("/memos?tab=deleted")} className={`nav-item text-sidebar-foreground w-full flex items-center gap-2 ${location.pathname === '/memos' && location.search.includes('tab=deleted') ? 'nav-item-active' : ''}`}>
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
            <SidebarGroupLabel asChild className="text-sidebar-muted text-xs uppercase tracking-wider">
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                Groups
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname === "/groups"} tooltip="All Groups">
                      <NavLink to="/groups" end className="nav-item text-sidebar-foreground" activeClassName="nav-item-active">
                        <Users className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>All Groups</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {!collapsed && myGroups.map(g => (
                    <SidebarMenuItem key={g.id}>
                      <SidebarMenuButton asChild isActive={location.pathname === `/groups/${g.id}`} tooltip={g.name}>
                        <NavLink to={`/groups/${g.id}`} className="nav-item text-sidebar-foreground" activeClassName="nav-item-active">
                          <span className="h-4 w-4 shrink-0 flex items-center justify-center rounded bg-primary/10 text-primary text-[9px] font-bold">
                            {g.name[0]}
                          </span>
                          <span className="truncate">{g.name}</span>
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
        {!collapsed && usedTags.length > 0 && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel asChild className="text-sidebar-muted text-xs uppercase tracking-wider">
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  Tags
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <div className="flex flex-wrap gap-1.5 px-3 py-2">
                    {displayTags.map(tag => {
                      const tagData = allTags.find(t => t.name === tag);
                      return (
                        <button
                          key={tag}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary/20 transition-colors"
                          onClick={() => navigate(`/memos?tag=${encodeURIComponent(tag)}`)}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  {usedTags.length > 5 && (
                    <button
                      className="flex items-center gap-1 text-[11px] text-sidebar-muted hover:text-sidebar-foreground px-3 py-1 transition-colors"
                      onClick={() => setShowAllTags(!showAllTags)}
                    >
                      <ChevronRight className={`h-3 w-3 transition-transform ${showAllTags ? 'rotate-90' : ''}`} />
                      {showAllTags ? 'Show less' : `View ${usedTags.length - 5} more`}
                    </button>
                  )}
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={currentUser.name}>
              <NavLink to="/profile" className="nav-item text-sidebar-foreground" activeClassName="nav-item-active">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                    {getUserInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-sidebar-accent-foreground truncate">{currentUser.name}</span>
                    <span className="text-xs text-sidebar-muted truncate">{currentUser.department} · <span className="capitalize">{currentUser.role}</span></span>
                  </div>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
