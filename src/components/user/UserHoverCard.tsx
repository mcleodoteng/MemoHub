import { User } from "@/types";
import { getUserInitials } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Mail, Building2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserHoverCardProps {
  user: User;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

const statusColors: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

export function UserHoverCard({ user, children, side = "top" }: UserHoverCardProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side={side} className="w-72 p-4">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-popover ${statusColors[user.status]}`}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
                {user.role}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span>{user.department}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
