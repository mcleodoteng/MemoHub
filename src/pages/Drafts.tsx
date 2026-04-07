import { AppLayout } from "@/components/layout/AppLayout";
import { useMemos } from "@/context/MemoContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit3, Trash2, Send, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

const Drafts = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { memos, deleteMemo, updateMemo } = useMemos();
  const [draftToDelete, setDraftToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const drafts = [...memos]
    .filter((m) => m.status === "draft" && m.creatorId === currentUser.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return (
    <AppLayout title="My Drafts">
      <div className="max-w-4xl mx-auto space-y-4">
        <p className="text-muted-foreground text-sm">
          {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
        </p>

        {drafts.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No drafts yet</p>
            <Button className="mt-4" onClick={() => navigate("/compose")}>
              Compose a Memo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="widget-card space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-sm">
                        {draft.title || "Untitled Draft"}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-warning border-warning/30"
                      >
                        Draft
                      </Badge>
                      {draft.attachments.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {draft.attachments.length} attachment
                          {draft.attachments.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last edited{" "}
                      {formatDistanceToNow(new Date(draft.updatedAt), {
                        addSuffix: true,
                      })}
                      {draft.recipientIds.length > 0 &&
                        ` · ${draft.recipientIds.length} recipient${draft.recipientIds.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => navigate(`/compose/${draft.id}`)}
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => {
                      updateMemo(draft.id, { status: "sent" });
                      toast.success("Memo sent!");
                    }}
                  >
                    <Send className="h-3.5 w-3.5" /> Send
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setDraftToDelete({
                        id: draft.id,
                        title: draft.title || "Untitled Draft",
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(draftToDelete)}
        onOpenChange={(open) => {
          if (!open) setDraftToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {draftToDelete
                ? `Are you sure you want to delete \"${draftToDelete.title}\"?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!draftToDelete) return;
                deleteMemo(draftToDelete.id);
                setDraftToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Drafts;
