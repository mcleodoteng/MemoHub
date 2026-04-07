import { User } from "@/types";
import { getUserInitials } from "@/lib/user-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mail, Building2, Clock, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUserStatus } from "@/hooks/useOnlineStatus";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMessages } from "@/context/MessageContext";

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

export function UserHoverCard({
  user,
  children,
  side = "top",
}: UserHoverCardProps) {
  const status = useUserStatus(user.id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { conversations, createConversation } = useMessages();

  const handleMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || currentUser.id === user.id) {
      navigate("/profile");
      return;
    }
    const existing = conversations.find(
      (c) =>
        c.type === "direct" &&
        c.participantIds.includes(user.id) &&
        c.participantIds.includes(currentUser.id),
    );
    if (!existing) {
      try {
        await createConversation([currentUser.id, user.id]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to start conversation";
        toast.error(message);
        return;
      }
    }
    navigate("/messages");
  };

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
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-popover ${statusColors[status]}`}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 capitalize shrink-0"
              >
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
              <span>
                Joined{" "}
                {formatDistanceToNow(new Date(user.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {currentUser && currentUser.id !== user.id && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full gap-1.5 h-7 text-xs"
                onClick={handleMessage}
              >
                <MessageCircle className="h-3 w-3" /> Message
              </Button>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
