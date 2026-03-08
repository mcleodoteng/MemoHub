import { Memo } from "@/types";
import { getUserById, getUserInitials, currentUser } from "@/data/mock";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemos } from "@/context/MemoContext";
import {
  Globe, Lock, Shield, Pin, Paperclip, MessageCircle,
  Eye, CheckCircle2, ThumbsUp,
  Archive, EyeOff, Smile, Trash2, Play, Image as ImageIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const visibilityConfig = {
  public: { icon: Globe, label: "Public", className: "visibility-public" },
  private: { icon: Lock, label: "Private", className: "visibility-private" },
  protected: { icon: Shield, label: "Protected", className: "visibility-protected" },
};

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '🚀', '👏', '😊', '🔥', '💯'];

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

interface MemoCardProps {
  memo: Memo;
}

export function MemoCard({ memo }: MemoCardProps) {
  const creator = getUserById(memo.creatorId);
  const vis = visibilityConfig[memo.visibility];
  const VisIcon = vis.icon;
  const navigate = useNavigate();
  const { togglePin, toggleArchive, hideMemo, addReaction, deleteMemo } = useMemos();

  const isCreator = memo.creatorId === currentUser.id;
  const isAdmin = currentUser.role === 'admin';

  const openedCount = memo.recipientStatuses.filter((s) => s.opened).length;
  const acknowledgedCount = memo.recipientStatuses.filter((s) => s.acknowledged).length;
  const approvedCount = memo.recipientStatuses.filter((s) => s.approved).length;
  const repliedCount = memo.recipientStatuses.filter((s) => s.replied).length;
  const totalRecipients = memo.recipientStatuses.length;
  const totalReactions = memo.reactions.reduce((sum, r) => sum + r.users.length, 0);

  const recipientUsers = memo.recipientIds
    .map((id) => getUserById(id))
    .filter(Boolean)
    .slice(0, 4);
  const remainingRecipients = memo.recipientIds.length - 4;

  const previewText = memo.body.startsWith("<") ? stripHtml(memo.body) : memo.body;

  const imageAttachments = memo.attachments.filter((a) => a.type.startsWith("image/"));
  const videoAttachments = memo.attachments.filter((a) => a.type.startsWith("video/"));
  const otherAttachments = memo.attachments.filter((a) => !a.type.startsWith("image/") && !a.type.startsWith("video/"));

  const stopProp = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  return (
    <div
      className="group/card bg-card rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20 cursor-pointer overflow-hidden"
      onClick={() => navigate(`/memos/${memo.id}`)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {creator ? (
            <UserHoverCard user={creator}>
              <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm" onClick={stopProp(() => navigate(`/profile/${creator.id}`))}>
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {getUserInitials(creator.name)}
                </AvatarFallback>
              </Avatar>
            </UserHoverCard>
          ) : (
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">?</AvatarFallback>
            </Avatar>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {creator ? (
                <UserHoverCard user={creator}>
                  <span className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={stopProp(() => navigate(`/profile/${creator.id}`))}>
                    {creator.name}
                  </span>
                </UserHoverCard>
              ) : (
                <span className="text-sm font-semibold truncate">Unknown</span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(memo.createdAt), { addSuffix: true })}
              </span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 border-transparent ${vis.className}`}>
                <VisIcon className="h-2.5 w-2.5" />
                {vis.label}
              </Badge>
              {memo.pinned && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-warning/30 text-warning bg-warning/10">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </Badge>
              )}
              {memo.status === "draft" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/30 text-warning bg-warning/10">Draft</Badge>
              )}
            </div>

            <h3 className="font-display font-bold mt-1.5 text-[15px] leading-snug line-clamp-1">{memo.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{previewText}</p>

            {memo.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {memo.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 font-medium rounded-full">{tag}</Badge>
                ))}
                {memo.tags.length > 4 && (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium rounded-full">+{memo.tags.length - 4}</Badge>
                )}
              </div>
            )}

            {recipientUsers.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2.5">
                <span className="text-[10px] text-muted-foreground font-medium">To:</span>
                <div className="flex -space-x-1.5">
                  {recipientUsers.map((user) => (
                    <UserHoverCard key={user!.id} user={user!}>
                      <Avatar className="h-6 w-6 border-2 border-background shadow-sm" onClick={stopProp(() => navigate(`/profile/${user!.id}`))}>
                        <AvatarFallback className="text-[8px] bg-secondary text-secondary-foreground font-bold">
                          {getUserInitials(user!.name)}
                        </AvatarFallback>
                      </Avatar>
                    </UserHoverCard>
                  ))}
                </div>
                {remainingRecipients > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{remainingRecipients} more</span>
                )}
              </div>
            )}

            {/* Small image/video thumbnails inline */}
            {(imageAttachments.length > 0 || videoAttachments.length > 0) && (
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {imageAttachments.slice(0, 4).map((att) => (
                  <div key={att.id} className="relative h-14 w-14 rounded-lg overflow-hidden border bg-secondary/50 shrink-0">
                    <img
                      src={att.url !== '#' ? att.url : `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop`}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {videoAttachments.slice(0, 2).map((att) => (
                  <div key={att.id} className="relative h-14 w-14 rounded-lg overflow-hidden border bg-secondary/50 shrink-0 flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
                      <Play className="h-3 w-3 text-foreground ml-0.5" />
                    </div>
                    <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[7px] text-muted-foreground truncate text-center">{att.name}</span>
                  </div>
                ))}
                {imageAttachments.length + videoAttachments.length > 4 && (
                  <div className="h-14 w-14 rounded-lg border bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-medium text-muted-foreground">+{imageAttachments.length + videoAttachments.length - 4}</span>
                  </div>
                )}
              </div>
            )}

            {/* Non-media attachments */}
            {otherAttachments.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {otherAttachments.map((att) => (
                  <span key={att.id} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/80 px-2 py-1 rounded-lg max-w-[160px]">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{att.name}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Reactions */}
            {totalReactions > 0 && (
              <div className="flex gap-1 mt-2.5 flex-wrap">
                {memo.reactions.map((r) => {
                  const isActive = r.users.includes(currentUser.id);
                  return (
                    <Tooltip key={r.emoji}>
                      <TooltipTrigger asChild>
                        <button
                          className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                            isActive ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-secondary/60 border-transparent hover:border-border'
                          }`}
                          onClick={stopProp(() => addReaction(memo.id, r.emoji, currentUser.id))}
                        >
                          {r.emoji} {r.users.length}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{isActive ? "Remove reaction" : "Add reaction"}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}

            {/* Status badges + inline actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
              {memo.status !== 'draft' && totalRecipients > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 bg-info/10 text-info px-1.5 py-0.5 rounded-md">
                        <Eye className="h-3 w-3" />{openedCount}/{totalRecipients}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Opened by {openedCount} of {totalRecipients} recipients</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 bg-warning/10 text-warning px-1.5 py-0.5 rounded-md">
                        <CheckCircle2 className="h-3 w-3" />{acknowledgedCount}/{totalRecipients}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Acknowledged by {acknowledgedCount} of {totalRecipients}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 bg-success/10 text-success px-1.5 py-0.5 rounded-md">
                        <ThumbsUp className="h-3 w-3" />{approvedCount}/{totalRecipients}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Approved by {approvedCount} of {totalRecipients}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                        <MessageCircle className="h-3 w-3" />{repliedCount}/{totalRecipients}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Replied by {repliedCount} of {totalRecipients}</TooltipContent>
                  </Tooltip>
                </div>
              )}

              <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover/card:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className={`h-7 w-7 ${memo.pinned ? 'text-warning' : 'text-muted-foreground'}`}
                      onClick={stopProp(() => { togglePin(memo.id); toast.success(memo.pinned ? 'Unpinned' : 'Pinned!'); })}>
                      <Pin className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{memo.pinned ? "Unpin memo" : "Pin memo to top"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className={`h-7 w-7 ${memo.archived ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={stopProp(() => { toggleArchive(memo.id); toast.success(memo.archived ? 'Unarchived' : 'Archived!'); })}>
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{memo.archived ? "Unarchive memo" : "Archive memo"}</TooltipContent>
                </Tooltip>
                {!isCreator && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                        onClick={stopProp(() => { hideMemo(memo.id, currentUser.id); toast.success('Memo hidden from feed'); })}>
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Hide memo from your feed</TooltipContent>
                  </Tooltip>
                )}
                {(isCreator || isAdmin) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={stopProp(() => { deleteMemo(memo.id); toast.success('Memo deleted'); })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete memo permanently</TooltipContent>
                  </Tooltip>
                )}
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={e => e.stopPropagation()}>
                          <Smile className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Add reaction</TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-auto p-2" align="end" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {QUICK_EMOJIS.map(emoji => (
                        <button key={emoji} className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary text-sm"
                          onClick={() => addReaction(memo.id, emoji, currentUser.id)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
