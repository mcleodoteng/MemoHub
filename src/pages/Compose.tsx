import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/context/AuthContext";
import { useTags } from "@/context/TagContext";
import { useUsers } from "@/context/UserContext";
import { getUserInitials } from "@/lib/user-utils";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { useMemos } from "@/context/MemoContext";
import { useTemplates } from "@/context/TemplateContext";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { AttachmentUploader } from "@/components/attachment/AttachmentManager";
import { MemoReferencePicker } from "@/components/memo/MemoReferencePicker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MemoVisibility, Attachment, WorkflowConfig } from "@/types";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Globe,
  Lock,
  Shield,
  Send,
  X,
  FileText,
  Save,
  LayoutTemplate,
  Plus,
  AlertCircle,
} from "lucide-react";
import { WorkflowConfigPanel } from "@/components/memo/WorkflowConfig";
import { toast } from "sonner";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { useRoles } from "@/context/RoleContext";
import { getSafeErrorMessage } from "@/lib/api";

const Compose = () => {
  function showFriendlyErrorToast(message: string) {
    toast.custom(
      (toastId) => (
        <div className="w-[400px] flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-lg">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-900">
              Action not completed
            </p>
            <p className="mt-0.5 text-xs text-red-800">{message}</p>
          </div>
          <button
            onClick={() => toast.dismiss(toastId)}
            className="shrink-0 rounded p-0.5 text-red-500 hover:text-red-700"
            aria-label="Dismiss error message"
            title="Dismiss error message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      { duration: 5000 },
    );
  }
  const navigate = useNavigate();
  const { draftId } = useParams<{ draftId?: string }>();
  const { currentUser } = useAuth();
  const { hasPermission } = useRoles();
  const { tags: tagOptions, refreshTags } = useTags();
  const {
    users: allUsers,
    isLoading: isUsersLoading,
    getUserById,
    refreshUsers,
  } = useUsers();
  const { addMemo, getMemoById, updateMemo, editMemo } = useMemos();
  const { notifyMentions } = useNotifications();
  const { templates, addTemplate } = useTemplates();
  const canCreateMemo = hasPermission("canCreateMemo");
  const canManageTemplates = hasPermission("canManageTemplates");

  const draft = draftId ? getMemoById(draftId) : undefined;
  const isEditingDraft =
    !!draft && draft.status === "draft" && draft.creatorId === currentUser?.id;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<MemoVisibility>("public");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [referencedMemoIds, setReferencedMemoIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isConfirmSendDraftOpen, setIsConfirmSendDraftOpen] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowConfig>({
    enabled: false,
    approvalChain: [],
  });
  const bypassUnsavedGuardRef = useRef(false);

  // Load draft data
  useEffect(() => {
    if (isEditingDraft && draft) {
      setTitle(draft.title);
      setBody(draft.body);
      setVisibility(draft.visibility);
      setSelectedRecipients(draft.recipientIds);
      setSelectedTags(draft.tags);
      setAttachments(draft.attachments);
      setReferencedMemoIds(draft.referencedMemoIds);
      if (draft.workflow) setWorkflow(draft.workflow);
    }
  }, [draftId, draft, isEditingDraft]);

  useEffect(() => {
    if (!isUsersLoading && allUsers.length === 0) {
      void refreshUsers();
    }
  }, [allUsers.length, isUsersLoading, refreshUsers]);

  // Clear recipients when visibility is set to protected
  useEffect(() => {
    if (visibility === "protected") {
      setSelectedRecipients([]);
      setRecipientSearch("");
    }
  }, [visibility]);

  const hasUnsavedContent = useCallback(() => {
    if (isSaved) return false;
    const hasContent =
      title.trim() ||
      (body.trim() && body !== "<p></p>") ||
      selectedRecipients.length > 0 ||
      selectedTags.length > 0 ||
      attachments.length > 0;
    return !!hasContent;
  }, [title, body, selectedRecipients, selectedTags, attachments, isSaved]);

  // Block navigation when there's unsaved content
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return (
      !bypassUnsavedGuardRef.current &&
      hasUnsavedContent() &&
      currentLocation.pathname !== nextLocation.pathname
    );
  });

  // Auto-save as draft when user confirms leaving
  const handleSaveAndLeave = async () => {
    if (!canCreateMemo) {
      toast.error("You do not have permission to create drafts");
      return;
    }
    if (title.trim() || body.trim()) {
      const draftTitle = title.trim() || "Untitled Draft";
      const draftBody =
        !body || body.trim() === "" || body === "<p></p>" ? " " : body;
      try {
        if (isEditingDraft && draft) {
          updateMemo(draft.id, {
            title: draftTitle,
            body: draftBody,
            visibility,
            recipientIds: selectedRecipients,
            tags: selectedTags,
            attachments,
            referencedMemoIds,
          });
        } else {
          await addMemo({
            title: draftTitle,
            body: draftBody,
            creatorId: currentUser.id,
            visibility,
            status: "draft",
            recipientIds: selectedRecipients,
            tags: selectedTags,
            attachments,
            pinned: false,
            archived: false,
            referencedMemoIds,
            groupId: undefined,
          });
        }
        toast.success("Memo saved as draft automatically");
        void refreshTags();
      } catch (error) {
        showFriendlyErrorToast(
          getSafeErrorMessage(
            error,
            "The draft could not be saved. Please try again.",
          ),
        );
        return;
      }
    }
    setIsSaved(true);
    blocker.proceed?.();
  };

  const handleDiscardAndLeave = () => {
    setIsSaved(true);
    blocker.proceed?.();
  };

  const otherUsers = allUsers.filter((u) => u.id !== currentUser?.id);
  const filteredUsers = useMemo(
    () =>
      otherUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(recipientSearch.toLowerCase()) ||
          (u.department || "")
            .toLowerCase()
            .includes(recipientSearch.toLowerCase()),
      ),
    [recipientSearch, otherUsers],
  );

  const availableTags = useMemo(() => tagOptions, [tagOptions]);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName],
    );
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
      setCustomTagInput("");
    }
  };

  const handleSend = async () => {
    if (!canCreateMemo) {
      toast.error("You do not have permission to send memos");
      return;
    }
    if (!title.trim()) {
      toast.error("Please add a title");
      return;
    }
    if (!body.trim() && body !== "<p></p>") {
      toast.error("Please add content");
      return;
    }

    // If scheduled, save as draft with scheduled send time
    const isScheduled = workflow.enabled && workflow.scheduledSendAt;
    const status = isScheduled ? "draft" : "sent";

    try {
      setIsSaved(true);
      if (isEditingDraft && draft) {
        updateMemo(draft.id, {
          title,
          body,
          visibility,
          status,
          recipientIds: selectedRecipients,
          tags: selectedTags,
          attachments,
          referencedMemoIds,
          workflow: workflow.enabled ? workflow : undefined,
          recipientStatuses: selectedRecipients.map((uid) => ({
            userId: uid,
            opened: false,
            acknowledged: false,
            approved: false,
            replied: false,
          })),
        });
      } else {
        await addMemo({
          title,
          body,
          creatorId: currentUser.id,
          visibility,
          status,
          recipientIds: selectedRecipients,
          tags: selectedTags,
          attachments,
          pinned: false,
          archived: false,
          referencedMemoIds,
          groupId: undefined,
          workflow: workflow.enabled ? workflow : undefined,
        });
      }

      toast.success(
        isScheduled
          ? `Memo scheduled for ${new Date(workflow.scheduledSendAt!).toLocaleString()}`
          : "Memo sent successfully!",
      );
      void refreshTags();
      notifyMentions(body, title, "/memos", currentUser.id);
      bypassUnsavedGuardRef.current = true;
      navigate("/memos");
    } catch (error) {
      showFriendlyErrorToast(
        getSafeErrorMessage(
          error,
          "The memo could not be sent. Please try again.",
        ),
      );
    }
  };

  const handleSendClick = () => {
    if (isEditingDraft) {
      setIsConfirmSendDraftOpen(true);
      return;
    }
    void handleSend();
  };

  const handleConfirmSendDraft = async () => {
    setIsConfirmSendDraftOpen(false);
    await handleSend();
  };

  const handleSaveDraft = async () => {
    if (!canCreateMemo) {
      toast.error("You do not have permission to save drafts");
      return;
    }
    if (!title.trim()) {
      toast.error("Please add a title for the draft");
      return;
    }

    const draftBody =
      !body || body.trim() === "" || body === "<p></p>" ? " " : body;

    setIsSaved(true);
    try {
      if (isEditingDraft && draft) {
        updateMemo(draft.id, {
          title,
          body: draftBody,
          visibility,
          recipientIds: selectedRecipients,
          tags: selectedTags,
          attachments,
          referencedMemoIds,
          workflow: workflow.enabled ? workflow : undefined,
        });
        toast.success("Draft updated!");
      } else {
        await addMemo({
          title,
          body: draftBody,
          creatorId: currentUser.id,
          visibility,
          status: "draft",
          recipientIds: selectedRecipients,
          tags: selectedTags,
          attachments,
          pinned: false,
          archived: false,
          referencedMemoIds,
          groupId: undefined,
          workflow: workflow.enabled ? workflow : undefined,
        });
        toast.success("Draft saved!");
      }
      void refreshTags();
      navigate("/drafts");
    } catch (error) {
      showFriendlyErrorToast(
        getSafeErrorMessage(
          error,
          "The draft could not be saved. Please try again.",
        ),
      );
    }
  };

  return (
    <AppLayout title={isEditingDraft ? "Edit Draft" : "Compose Memo"}>
      {/* Unsaved changes dialog */}
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to save your memo as a draft before leaving? Your
              progress will be lost if you discard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Stay
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={handleDiscardAndLeave}
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndLeave}>
              <Save className="h-4 w-4 mr-1.5" /> Save as Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isConfirmSendDraftOpen}
        onOpenChange={setIsConfirmSendDraftOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this memo now?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send this memo? If you choose No, it will
              remain as a draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep as draft</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmSendDraft()}>
              Yes, send memo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Template Picker */}
        {!isEditingDraft && (
          <div className="widget-card">
            <div className="flex items-center gap-2 mb-3">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">
                Start from a template
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  onClick={() => {
                    setTitle(tpl.title);
                    setBody(tpl.body);
                    setSelectedTags(tpl.tags);
                    setVisibility(tpl.visibility);
                    toast.success(`Template "${tpl.name}" applied`);
                  }}
                >
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">
                    {tpl.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {tpl.description}
                  </p>
                  {!tpl.isBuiltIn && (
                    <Badge variant="outline" className="mt-1.5 text-[9px] h-4">
                      Custom
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="widget-card space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              placeholder="Enter memo title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-display text-lg"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Visibility
            </label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as MemoVisibility)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" /> Public
                  </span>
                </SelectItem>
                <SelectItem value="private">
                  <span className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> Private
                  </span>
                </SelectItem>
                <SelectItem value="protected">
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" /> Protected
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients with search */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Recipients
              {selectedRecipients.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({selectedRecipients.length} selected)
                </span>
              )}
            </label>
            {visibility === "protected" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Protected memos are only accessible to you as the creator.
                    Recipients cannot be selected.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search recipients by name, email, or department..."
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  className="mb-2 h-8 text-sm"
                />
                {selectedRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedRecipients.map((userId) => {
                      const user = getUserById(userId);
                      return user ? (
                        <Badge
                          key={userId}
                          variant="default"
                          className="gap-1 cursor-pointer"
                          onClick={() => toggleRecipient(userId)}
                        >
                          <UserHoverCard user={user}>
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[7px] bg-primary-foreground/20 text-primary-foreground">
                                {getUserInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                          </UserHoverCard>
                          {user.name}
                          <X className="h-3 w-3 ml-0.5" />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
                  {filteredUsers
                    .filter((u) => !selectedRecipients.includes(u.id))
                    .map((user) => (
                      <UserHoverCard key={user.id} user={user}>
                        <Badge
                          variant="outline"
                          className="cursor-pointer transition-colors gap-1.5"
                          onClick={() => toggleRecipient(user.id)}
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[7px] bg-secondary text-secondary-foreground">
                              {getUserInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          {user.name}
                          <span className="text-[10px] text-muted-foreground">
                            · {user.department}
                          </span>
                        </Badge>
                      </UserHoverCard>
                    ))}
                  {filteredUsers.filter(
                    (u) => !selectedRecipients.includes(u.id),
                  ).length === 0 &&
                    recipientSearch && (
                      <p className="text-xs text-muted-foreground py-2">
                        No users match "{recipientSearch}"
                      </p>
                    )}
                  {filteredUsers.filter(
                    (u) => !selectedRecipients.includes(u.id),
                  ).length === 0 &&
                    !recipientSearch && (
                      <p className="text-xs text-muted-foreground py-2">
                        {isUsersLoading
                          ? "Loading users..."
                          : "No available recipients found"}
                      </p>
                    )}
                </div>
              </>
            )}
          </div>

          {/* Tags with custom input */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {availableTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={
                    selectedTags.includes(tag.name) ? "default" : "secondary"
                  }
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                  {selectedTags.includes(tag.name) && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
              {selectedTags
                .filter((t) => !availableTags.some((pt) => pt.name === t))
                .map((tag) => (
                  <Badge
                    key={tag}
                    variant="default"
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom tag..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                className="h-8 text-sm w-48"
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addCustomTag())
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={addCustomTag}
                disabled={!customTagInput.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Rich Text Content */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Write your memo content..."
              minHeight="200px"
            />
          </div>

          {/* References */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              References
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <MemoReferencePicker
                onSelect={(id) => setReferencedMemoIds((prev) => [...prev, id])}
                selectedIds={referencedMemoIds}
              />
              {referencedMemoIds.map((refId) => {
                const ref = getMemoById(refId);
                return (
                  <Badge key={refId} variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {ref?.title || refId}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() =>
                        setReferencedMemoIds((prev) =>
                          prev.filter((id) => id !== refId),
                        )
                      }
                    />
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Attachments
            </label>
            <AttachmentUploader
              attachments={attachments}
              onAdd={(newAtts) =>
                setAttachments((prev) => [...prev, ...newAtts])
              }
              onRemove={(id) =>
                setAttachments((prev) => prev.filter((a) => a.id !== id))
              }
            />
          </div>

          {/* Workflow Automation */}
          <WorkflowConfigPanel workflow={workflow} onChange={setWorkflow} />

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-3 pt-2 border-t flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                if (!canManageTemplates) {
                  toast.error("You do not have permission to manage templates");
                  return;
                }
                if (!title.trim()) {
                  toast.error("Add a title first");
                  return;
                }
                addTemplate({
                  name: title.trim().slice(0, 40),
                  description: `Custom template from "${title.trim().slice(0, 30)}"`,
                  title,
                  body,
                  tags: selectedTags,
                  visibility,
                });
                toast.success("Saved as template!");
              }}
              disabled={!canManageTemplates}
            >
              <LayoutTemplate className="h-3.5 w-3.5" /> Save as Template
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="md:size-default"
              onClick={() => navigate("/memos")}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 md:size-default"
              onClick={handleSaveDraft}
              disabled={!canCreateMemo}
            >
              <Save className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">
                {isEditingDraft ? "Update Draft" : "Save Draft"}
              </span>
              <span className="sm:hidden">Draft</span>
            </Button>
            <Button
              size="sm"
              className="gap-2 md:size-default"
              onClick={handleSendClick}
              disabled={!canCreateMemo}
            >
              <Send className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Send Memo</span>
              <span className="sm:hidden">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Compose;
