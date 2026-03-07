import {
  LayoutDashboard, FileText, MessageSquare, Users,
  Bell, PenSquare, ChevronDown, FileEdit,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { currentUser, getUserInitials } from "@/data/mock";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { useGroups } from "@/context/GroupContext";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { memos } = useMemos();
  const { conversations } = useMessages();
  const { groups } = useGroups();

  const pendingApprovals = memos.filter(m =>
    m.recipientStatuses.some(s => s.userId === currentUser.id && s.opened && !s.approved)
  ).length;
  const draftCount = memos.filter(m => m.status === 'draft' && m.creatorId === currentUser.id).length;
  const unreadMessages = conversations.filter(c =>
    c.lastMessage && !c.lastMessage.readBy.includes(currentUser.id)
  ).length;
  const unreadNotifications = pendingApprovals + unreadMessages;

  const myGroups = groups.filter(g => g.memberIds.includes(currentUser.id));

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const mainNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, badge: 0 },
    { title: "Messages", url: "/messages", icon: MessageSquare, badge: unreadMessages },
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <FileText className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-bold text-sidebar-accent-foreground">
              MemoHub
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
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
                    <span className="text-xs text-sidebar-muted truncate">{currentUser.department}</span>
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
