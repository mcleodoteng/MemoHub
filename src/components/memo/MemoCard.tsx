import { Memo } from "@/types";
import { getUserById, getUserInitials } from "@/data/mock";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Lock, Shield, Pin, Paperclip, MessageCircle,
  Eye, CheckCircle2, ThumbsUp, Image as ImageIcon, FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const visibilityConfig = {
  public: { icon: Globe, label: "Public", className: "visibility-public" },
  private: { icon: Lock, label: "Private", className: "visibility-private" },
  protected: { icon: Shield, label: "Protected", className: "visibility-protected" },
};

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

  const openedCount = memo.recipientStatuses.filter((s) => s.opened).length;
  const acknowledgedCount = memo.recipientStatuses.filter((s) => s.acknowledged).length;
  const approvedCount = memo.recipientStatuses.filter((s) => s.approved).length;
  const repliedCount = memo.recipientStatuses.filter((s) => s.replied).length;
  const totalRecipients = memo.recipientStatuses.length;

  const totalReactions = memo.reactions.reduce((sum, r) => sum + r.users.length, 0);

  // Get recipient users for avatar display (show up to 4)
  const recipientUsers = memo.recipientIds
    .map((id) => getUserById(id))
    .filter(Boolean)
    .slice(0, 4);
  const remainingRecipients = memo.recipientIds.length - 4;

  // Preview text: strip HTML tags
  const previewText = memo.body.startsWith("<") ? stripHtml(memo.body) : memo.body;

  // Attachment preview info
  const imageAttachments = memo.attachments.filter((a) =>
    a.type.startsWith("image/")
  );
  const otherAttachments = memo.attachments.filter(
    (a) => !a.type.startsWith("image/")
  );

  return (
    <div
      className="memo-card p-4 cursor-pointer animate-slide-in"
      onClick={() => navigate(`/memos/${memo.id}`)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {creator ? (
          <UserHoverCard user={creator}>
            <Avatar className="h-9 w-9 shrink-0">
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
                <span className="text-sm font-semibold truncate cursor-pointer hover:underline">
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

          <h3 className="font-display font-semibold mt-1 text-sm leading-snug">
            {memo.title}
          </h3>

          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {previewText}
          </p>

          {/* Tags */}
          {memo.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {memo.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 font-medium"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Recipient Avatars */}
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
                <span className="text-[10px] text-muted-foreground ml-1">
                  +{remainingRecipients} more
                </span>
              )}
            </div>
          )}

          {/* Attachment Previews */}
          {memo.attachments.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {imageAttachments.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                  <ImageIcon className="h-3 w-3" />
                  {imageAttachments.length} image{imageAttachments.length > 1 ? "s" : ""}
                </span>
              )}
              {otherAttachments.map((att) => (
                <span
                  key={att.id}
                  className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md max-w-[160px]"
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{att.name}</span>
                </span>
              ))}
            </div>
          )}

          {/* Status & Meta Row */}
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
            <span className="status-badge-opened">
              <Eye className="h-3 w-3" />
              {openedCount}/{totalRecipients}
            </span>
            <span className="status-badge-acknowledged">
              <CheckCircle2 className="h-3 w-3" />
              {acknowledgedCount}/{totalRecipients}
            </span>
            <span className="status-badge-approved">
              <ThumbsUp className="h-3 w-3" />
              {approvedCount}/{totalRecipients}
            </span>
            <span className="status-badge-replied">
              <MessageCircle className="h-3 w-3" />
              {repliedCount}/{totalRecipients}
            </span>

            {totalReactions > 0 && (
              <span className="flex items-center gap-1">
                {memo.reactions.slice(0, 3).map((r) => (
                  <span key={r.emoji}>{r.emoji}</span>
                ))}
                <span>{totalReactions}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
