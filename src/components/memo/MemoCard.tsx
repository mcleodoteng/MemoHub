import { Memo } from "@/types";
import { getUserById, getUserInitials, currentUser } from "@/data/mock";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMemos } from "@/context/MemoContext";
import {
  Globe, Lock, Shield, Pin, Paperclip, MessageCircle,
  Eye, CheckCircle2, ThumbsUp, Image as ImageIcon,
  Archive, EyeOff, Smile, Trash2,
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
  const otherAttachments = memo.attachments.filter((a) => !a.type.startsWith("image/"));

  const stopProp = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  return (
    <div
      className="memo-card p-4 cursor-pointer animate-slide-in"
      onClick={() => navigate(`/memos/${memo.id}`)}
    >
      <div className="flex items-start gap-3">
        {creator ? (
          <UserHoverCard user={creator}>
            <Avatar className="h-9 w-9 shrink-0" onClick={stopProp(() => navigate(`/profile/${creator.id}`))}>
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getUserInitials(creator.name)}
              </AvatarFallback>
            </Avatar>
          </UserHoverCard>
        ) : (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">?</AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {creator ? (
              <UserHoverCard user={creator}>
                <span className="text-sm font-semibold truncate cursor-pointer hover:underline"
                  onClick={stopProp(() => navigate(`/profile/${creator.id}`))}>
                  {creator.name}
                </span>
              </UserHoverCard>
            ) : (
              <span className="text-sm font-semibold truncate">Unknown</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(memo.createdAt), { addSuffix: true })}
            </span>
            <span className={`flex items-center gap-1 text-xs ${vis.className}`}>
              <VisIcon className="h-3 w-3" />
              {vis.label}
            </span>
            {memo.pinned && <Pin className="h-3 w-3 text-warning" />}
            {memo.status === "draft" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Draft</Badge>
            )}
          </div>

          <h3 className="font-display font-semibold mt-1 text-sm leading-snug">{memo.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{previewText}</p>

          {memo.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {memo.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{tag}</Badge>
              ))}
            </div>
          )}

          {recipientUsers.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] text-muted-foreground mr-1">To:</span>
              <div className="flex -space-x-1.5">
                {recipientUsers.map((user) => (
                  <UserHoverCard key={user!.id} user={user!}>
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-[8px] bg-secondary text-secondary-foreground font-semibold">
                        {getUserInitials(user!.name)}
                      </AvatarFallback>
                    </Avatar>
                  </UserHoverCard>
                ))}
              </div>
              {remainingRecipients > 0 && (
                <span className="text-[10px] text-muted-foreground ml-1">+{remainingRecipients} more</span>
              )}
            </div>
          )}

          {memo.attachments.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {imageAttachments.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                  <ImageIcon className="h-3 w-3" />
                  {imageAttachments.length} image{imageAttachments.length > 1 ? "s" : ""}
                </span>
              )}
              {otherAttachments.map((att) => (
                <span key={att.id} className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md max-w-[160px]">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{att.name}</span>
                </span>
              ))}
            </div>
          )}

          {/* Reactions display */}
          {totalReactions > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {memo.reactions.map((r) => {
                const isActive = r.users.includes(currentUser.id);
                return (
                  <button
                    key={r.emoji}
                    className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                      isActive ? 'bg-primary/10 border-primary/30' : 'bg-secondary border-transparent hover:border-border'
                    }`}
                    onClick={stopProp(() => addReaction(memo.id, r.emoji, currentUser.id))}
                  >
                    {r.emoji} {r.users.length}
                  </button>
                );
              })}
            </div>
          )}

          {/* Status & inline actions row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {memo.status !== 'draft' && totalRecipients > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
                <span className="status-badge-opened"><Eye className="h-3 w-3" />{openedCount}/{totalRecipients}</span>
                <span className="status-badge-acknowledged"><CheckCircle2 className="h-3 w-3" />{acknowledgedCount}/{totalRecipients}</span>
                <span className="status-badge-approved"><ThumbsUp className="h-3 w-3" />{approvedCount}/{totalRecipients}</span>
                <span className="status-badge-replied"><MessageCircle className="h-3 w-3" />{repliedCount}/{totalRecipients}</span>
              </div>
            )}

            {/* Inline action buttons */}
            <div className="flex items-center gap-0.5 ml-auto">
              <Button variant="ghost" size="icon" className={`h-7 w-7 ${memo.pinned ? 'text-warning' : 'text-muted-foreground'}`}
                onClick={stopProp(() => { togglePin(memo.id); toast.success(memo.pinned ? 'Unpinned' : 'Pinned!'); })}>
                <Pin className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className={`h-7 w-7 ${memo.archived ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={stopProp(() => { toggleArchive(memo.id); toast.success(memo.archived ? 'Unarchived' : 'Archived!'); })}>
                <Archive className="h-3.5 w-3.5" />
              </Button>
              {!isCreator && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                  onClick={stopProp(() => { hideMemo(memo.id, currentUser.id); toast.success('Memo hidden from feed'); })}>
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Admin can delete, creator can delete */}
              {(isCreator || isAdmin) && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={stopProp(() => { deleteMemo(memo.id); toast.success('Memo deleted'); })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={e => e.stopPropagation()}>
                    <Smile className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
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
  );
}
