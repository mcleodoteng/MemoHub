import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { getMemoById, getUserById, getUserInitials, comments as allComments } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Globe, Lock, Shield, Pin, Archive, Trash2, Paperclip,
  Eye, CheckCircle2, ThumbsUp, MessageCircle, ArrowLeft,
  FileText, Download,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

const visConfig = {
  public: { icon: Globe, label: "Public", className: "visibility-public" },
  private: { icon: Lock, label: "Private", className: "visibility-private" },
  protected: { icon: Shield, label: "Protected", className: "visibility-protected" },
};

const MemoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState("");
  const memo = getMemoById(id || "");

  if (!memo) {
    return (
      <AppLayout title="Memo Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Memo not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/memos")}>
            Back to Memos
          </Button>
        </div>
      </AppLayout>
    );
  }

  const creator = getUserById(memo.creatorId);
  const vis = visConfig[memo.visibility];
  const VisIcon = vis.icon;
  const memoComments = allComments.filter((c) => c.memoId === memo.id);

  return (
    <AppLayout title="">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/memos")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Memos
        </Button>

        {/* Main Card */}
        <div className="widget-card space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {creator ? getUserInitials(creator.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{creator?.name}</span>
                <span className={`flex items-center gap-1 text-xs ${vis.className}`}>
                  <VisIcon className="h-3 w-3" /> {vis.label}
                </span>
                {memo.pinned && <Pin className="h-3 w-3 text-warning" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(memo.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Pinned!")}>
                <Pin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Archived!")}>
                <Archive className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Deleted!")}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          {/* Title & Body */}
          <div>
            <h2 className="font-display text-xl font-bold">{memo.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{memo.body}</p>
          </div>

          {/* Tags */}
          {memo.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {memo.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Attachments */}
          {memo.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Attachments</p>
              {memo.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{att.name}</span>
                  <span className="text-xs text-muted-foreground">{(att.size / 1024).toFixed(0)} KB</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {memo.reactions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {memo.reactions.map((r) => (
                <Button key={r.emoji} variant="outline" size="sm" className="gap-1 h-7 text-xs">
                  {r.emoji} {r.users.length}
                </Button>
              ))}
            </div>
          )}

          {/* References */}
          {memo.referencedMemoIds.length > 0 && (
            <div className="text-xs text-muted-foreground">
              References:{" "}
              {memo.referencedMemoIds.map((refId) => {
                const ref = getMemoById(refId);
                return (
                  <span
                    key={refId}
                    className="text-primary cursor-pointer hover:underline"
                    onClick={() => navigate(`/memos/${refId}`)}
                  >
                    {ref?.title || refId}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Recipient Status Tracker */}
        <div className="widget-card">
          <h3 className="font-display font-semibold mb-3">Recipient Status</h3>
          <div className="space-y-3">
            {memo.recipientStatuses.map((status) => {
              const user = getUserById(status.userId);
              return (
                <div key={status.userId} className="flex items-center gap-3">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                      {user ? getUserInitials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium min-w-[100px]">{user?.name}</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className={status.opened ? "status-badge-opened" : "status-badge opacity-30"}>
                      <Eye className="h-3 w-3" /> Opened
                    </span>
                    <span className={status.acknowledged ? "status-badge-acknowledged" : "status-badge opacity-30"}>
                      <CheckCircle2 className="h-3 w-3" /> Acknowledged
                    </span>
                    <span className={status.approved ? "status-badge-approved" : "status-badge opacity-30"}>
                      <ThumbsUp className="h-3 w-3" /> Approved
                    </span>
                    <span className={status.replied ? "status-badge-replied" : "status-badge opacity-30"}>
                      <MessageCircle className="h-3 w-3" /> Replied
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comments */}
        <div className="widget-card">
          <h3 className="font-display font-semibold mb-3">
            Comments ({memoComments.length})
          </h3>
          <div className="space-y-4">
            {memoComments.map((comment) => {
              const author = getUserById(comment.authorId);
              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                      {author ? getUserInitials(author.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{author?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5">{comment.body}</p>
                    {comment.reactions.length > 0 && (
                      <div className="flex gap-1.5 mt-1">
                        {comment.reactions.map((r) => (
                          <span key={r.emoji} className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">
                            {r.emoji} {r.users.length}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Reply */}
            <div className="flex gap-3 pt-2 border-t">
              <Textarea
                placeholder="Write a comment..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                className="resize-none flex-1"
              />
              <Button
                size="sm"
                className="self-end"
                onClick={() => {
                  toast.success("Comment added!");
                  setReplyText("");
                }}
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MemoDetail;
