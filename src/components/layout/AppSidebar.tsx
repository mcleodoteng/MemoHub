import {
  LayoutDashboard, FileText, MessageSquare, Users,
  Bell, PenSquare,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { currentUser, getUserInitials } from "@/data/mock";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { memos } = useMemos();
  const { conversations } = useMessages();

  // Dynamic counts
  const pendingApprovals = memos.filter(m =>
    m.recipientStatuses.some(s => s.userId === currentUser.id && s.opened && !s.approved)
  ).length;
  const draftCount = memos.filter(m => m.status === 'draft' && m.creatorId === currentUser.id).length;
  const unreadMessages = conversations.filter(c =>
    c.lastMessage && !c.lastMessage.readBy.includes(currentUser.id)
  ).length;
  const unreadNotifications = pendingApprovals + unreadMessages; // simplified

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const mainNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, badge: 0 },
    { title: "Memos", url: "/memos", icon: FileText, badge: pendingApprovals },
    { title: "Compose", url: "/compose", icon: PenSquare, badge: draftCount },
    { title: "Messages", url: "/messages", icon: MessageSquare, badge: unreadMessages },
  ];

  const organizeNav = [
    { title: "Groups", url: "/groups", icon: Users, badge: 0 },
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">Organize</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{organizeNav.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
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
