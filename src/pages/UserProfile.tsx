import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getUserInitials } from "@/lib/user-utils";
import { useAuth } from "@/context/AuthContext";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { useGroups } from "@/context/GroupContext";
import { useOnlineStatuses } from "@/hooks/useOnlineStatus";
import {
  apiRequest,
  BackendUser,
  normalizeRole,
  normalizeStatus,
} from "@/lib/api";
import { User as AppUser } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MemoCard } from "@/components/memo/MemoCard";
import {
  FileText,
  Users,
  Mail,
  Building,
  ArrowLeft,
  Clock,
  MessageCircle,
  Heart,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { memos } = useMemos();
  const { conversations, createConversation } = useMessages();
  const { groups } = useGroups();
  const { getUserStatus } = useOnlineStatuses();
  const [starredUsers, setStarredUsers] = useState<string[]>([]);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [profileStats, setProfileStats] = useState<{
    totalMemos: number;
    totalComments: number;
    totalReactions: number;
    joinedGroups: number;
  } | null>(null);

  const mapBackendUser = (backendUser: BackendUser): AppUser => ({
    id: backendUser.id,
    name: backendUser.name,
    email: backendUser.email,
    bio: backendUser.bio || "",
    avatar: backendUser.avatar || "",
    role: normalizeRole(backendUser.role),
    department: backendUser.department || "General",
    status: normalizeStatus(backendUser.status),
    createdAt: backendUser.createdAt || new Date().toISOString(),
  });

  useEffect(() => {
    let active = true;

    const loadUserProfile = async () => {
      if (!userId) {
        if (active) {
          setUser(null);
          setIsLoadingUser(false);
        }
        return;
      }

      if (active) {
        setIsLoadingUser(true);
      }

      try {
        const response = await apiRequest<{ user: BackendUser }>(
          `/users/${userId}`,
        );
        if (active) {
          setUser(mapBackendUser(response.data.user));
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoadingUser(false);
        }
      }
    };

    const loadUserStats = async () => {
      if (!userId) {
        if (active) {
          setProfileStats(null);
        }
        return;
      }

      try {
        const response = await apiRequest<{
          userId: string;
          totalMemos: number;
          totalComments: number;
          totalReactions: number;
          joinedGroups: number;
        }>(`/users/${userId}/stats`);

        if (active) {
          setProfileStats({
            totalMemos: response.data.totalMemos,
            totalComments: response.data.totalComments,
            totalReactions: response.data.totalReactions,
            joinedGroups: response.data.joinedGroups,
          });
        }
      } catch {
        if (active) {
          setProfileStats(null);
        }
      }
    };

    void loadUserProfile();
    void loadUserStats();

    const interval = window.setInterval(() => {
      void loadUserProfile();
      void loadUserStats();
    }, 30000);

    const onFocus = () => {
      void loadUserProfile();
      void loadUserStats();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);

  const isOwnProfile = user?.id === currentUser?.id;

  useEffect(() => {
    if (isOwnProfile) {
      navigate("/profile", { replace: true });
    }
  }, [isOwnProfile, navigate]);

  if (isLoadingUser) {
    return (
      <AppLayout title="Profile">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </AppLayout>
    );
  }

  if (!user || isOwnProfile) {
    if (!user) {
      return (
        <AppLayout title="User Not Found">
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-muted-foreground">User not found</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate(-1)}
            >
              Go Back
            </Button>
          </div>
        </AppLayout>
      );
    }
    return null;
  }

  const status = getUserStatus(user.id);
  const userMemos = memos.filter(
    (m) =>
      m.creatorId === user.id &&
      m.status !== "draft" &&
      m.visibility === "public",
  );
  const userGroups = groups.filter((g) => g.memberIds.includes(user.id));
  const totalMemos = profileStats?.totalMemos ?? userMemos.length;
  const totalGroups = profileStats?.joinedGroups ?? userGroups.length;
  const totalComments = profileStats?.totalComments;
  const totalReactions = profileStats?.totalReactions;
  const sharedGroups = currentUser
    ? groups.filter(
        (g) =>
          g.memberIds.includes(user.id) && g.memberIds.includes(currentUser.id),
      )
    : [];
  const isStarred = starredUsers.includes(user.id);

  const toggleStarUser = () => {
    setStarredUsers((prev) =>
      prev.includes(user.id)
        ? prev.filter((id) => id !== user.id)
        : [...prev, user.id],
    );
    toast.success(
      isStarred ? `Unstarred ${user.name}` : `Starred ${user.name}`,
    );
  };

  const handleMessage = async () => {
    if (!currentUser) return;
    const existing = conversations.find(
      (c) =>
        c.type === "direct" &&
        c.participantIds.includes(user.id) &&
        c.participantIds.includes(currentUser.id),
    );
    if (existing) {
      navigate("/messages");
    } else {
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
      navigate("/messages");
    }
  };

  return (
    <AppLayout title={user.name}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </TooltipTrigger>
          <TooltipContent>Go back to previous page</TooltipContent>
        </Tooltip>

        <div className="widget-card flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20 avatar-ring">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-display font-bold">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card ${statusColors[status]}`}
            />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="font-display text-xl font-bold">{user.name}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap justify-center sm:justify-start">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </span>
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5" /> {user.department}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Joined{" "}
                {formatDistanceToNow(new Date(user.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <div className="flex gap-2 mt-3 justify-center sm:justify-start">
              <Badge>{user.role}</Badge>
              <Badge variant="outline" className="capitalize">
                <span
                  className={`h-1.5 w-1.5 rounded-full mr-1.5 ${statusColors[status]}`}
                />
                {status}
              </Badge>
            </div>
            {!!user.bio && (
              <p className="mt-3 text-sm text-muted-foreground">{user.bio}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isStarred ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={toggleStarUser}
                >
                  <Star
                    className={`h-4 w-4 ${isStarred ? "fill-current" : ""}`}
                  />
                  {isStarred ? "Starred" : "Star"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isStarred
                  ? "Unstar this user"
                  : "Star for priority notifications"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="gap-1.5" onClick={handleMessage}>
                  <MessageCircle className="h-4 w-4" /> Message
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Send a direct message to {user.name.split(" ")[0]}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">{totalMemos}</p>
              <p className="text-xs text-muted-foreground">Public Memos</p>
            </div>
          </div>
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">{totalGroups}</p>
              <p className="text-xs text-muted-foreground">Groups</p>
            </div>
          </div>
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <MessageCircle className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">
                {typeof totalComments === "number" ? totalComments : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </div>
          </div>
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Heart className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-display font-bold">
                {typeof totalReactions === "number" ? totalReactions : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Reactions</p>
            </div>
          </div>
        </div>

        {/* Shared groups */}
        {sharedGroups.length > 0 && (
          <div>
            <h3 className="font-display font-semibold mb-3">
              Groups you share
            </h3>
            <div className="flex flex-wrap gap-2">
              {sharedGroups.map((g) => (
                <Badge
                  key={g.id}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => navigate(`/groups/${g.id}`)}
                >
                  <Users className="h-3 w-3 mr-1" /> {g.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* All user groups */}
        {userGroups.length > 0 && (
          <div>
            <h3 className="font-display font-semibold mb-3">All Groups</h3>
            <div className="flex flex-wrap gap-2">
              {userGroups.map((g) => (
                <Badge
                  key={g.id}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => navigate(`/groups/${g.id}`)}
                >
                  <Users className="h-3 w-3 mr-1" /> {g.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {userMemos.length > 0 && (
          <div>
            <h3 className="font-display font-semibold mb-3">
              Public Memos by {user.name.split(" ")[0]}
            </h3>
            <div className="space-y-3">
              {userMemos.map((m) => (
                <MemoCard key={m.id} memo={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserProfile;
