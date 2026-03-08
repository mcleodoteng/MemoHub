import { AppLayout } from "@/components/layout/AppLayout";
import { MemoCard } from "@/components/memo/MemoCard";
import { WorkflowStatus } from "@/components/memo/WorkflowStatus";
import { useMemos } from "@/context/MemoContext";
import { currentUser } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PenSquare, Search, RotateCcw, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";

function formatMemoDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMMM d, yyyy");
}

const Memos = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memos, restoreMemo, permanentlyDeleteMemo, toggleStar } = useMemos();
  const [search, setSearch] = useState("");

  const activeTab = searchParams.get("tab") || "all";

  const visibleMemos = memos.filter(m => !(m.hiddenBy || []).includes(currentUser.id));

  const filtered = visibleMemos.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.body.toLowerCase().includes(search.toLowerCase()) ||
    m.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const sentMemos = filtered.filter(m => m.status !== 'deleted' && m.status !== 'draft');
  const draftMemos = filtered.filter(m => m.status === 'draft' && m.creatorId === currentUser.id);
  const publicMemos = sentMemos.filter(m => m.visibility === "public" && !m.archived);
  const privateMemos = sentMemos.filter(m => m.visibility === "private" && !m.archived);
  const protectedMemos = sentMemos.filter(m => m.visibility === "protected" && !m.archived);
  const pinnedMemos = sentMemos.filter(m => m.pinned && !m.archived);
  const archivedMemos = sentMemos.filter(m => m.archived);
  const deletedMemos = filtered.filter(m => m.status === 'deleted' && (m as any).deletedBy === currentUser.id);
  const starredMemos = sentMemos.filter(m => (m.starredBy || []).includes(currentUser.id) && !m.archived);
  const workflowMemos = sentMemos.filter(m => m.workflow?.enabled && !m.archived);

  const pendingWorkflowApprovals = workflowMemos.filter(m => {
    const currentStep = m.workflow?.approvalChain.find(s => s.status === 'pending');
    if (!currentStep) return false;
    const priorSteps = m.workflow!.approvalChain.filter(s => s.order < currentStep.order);
    if (priorSteps.some(s => s.status !== 'approved')) return false;
    return currentStep.approverId === currentUser.id;
  }).length;

  const allNonArchived = sentMemos.filter(m => !m.archived).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Group memos by date
  const groupByDate = (items: typeof memos) => {
    const groups: Record<string, typeof memos> = {};
    items.forEach(m => {
      const key = formatMemoDate(m.createdAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  };

  const MemoList = ({ items }: { items: typeof memos }) => {
    if (items.length === 0) return <p className="text-center text-muted-foreground py-8">No memos found</p>;
    const grouped = groupByDate(items);
    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([date, memoItems]) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] font-medium text-muted-foreground bg-background px-3 py-1 rounded-full border">
                {date}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-3">
              {memoItems.map(m => <MemoCard key={m.id} memo={m} />)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout title="Memos">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search memos by title, content, or tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-none"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => navigate("/compose")} className="gap-2 shrink-0">
                <PenSquare className="h-4 w-4" /> Compose
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create a new memo</TooltipContent>
          </Tooltip>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })}>
          <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-max">
              <TabsTrigger value="all">All ({sentMemos.filter(m => !m.archived).length})</TabsTrigger>
              <TabsTrigger value="drafts">Drafts ({draftMemos.length})</TabsTrigger>
              <TabsTrigger value="public">Public ({publicMemos.length})</TabsTrigger>
              <TabsTrigger value="private">Private ({privateMemos.length})</TabsTrigger>
              <TabsTrigger value="protected">Protected ({protectedMemos.length})</TabsTrigger>
              <TabsTrigger value="pinned">Pinned ({pinnedMemos.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedMemos.length})</TabsTrigger>
              <TabsTrigger value="starred">Starred ({starredMemos.length})</TabsTrigger>
              <TabsTrigger value="workflow" className="relative pr-6">
                Workflow ({workflowMemos.length})
                {pendingWorkflowApprovals > 0 && (
                  <span className="absolute right-1 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {pendingWorkflowApprovals}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="deleted">Trash ({deletedMemos.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-4"><MemoList items={allNonArchived} /></TabsContent>
          <TabsContent value="drafts" className="mt-4"><MemoList items={draftMemos} /></TabsContent>
          <TabsContent value="public" className="mt-4"><MemoList items={publicMemos} /></TabsContent>
          <TabsContent value="private" className="mt-4"><MemoList items={privateMemos} /></TabsContent>
          <TabsContent value="protected" className="mt-4"><MemoList items={protectedMemos} /></TabsContent>
          <TabsContent value="pinned" className="mt-4"><MemoList items={pinnedMemos} /></TabsContent>
          <TabsContent value="archived" className="mt-4"><MemoList items={archivedMemos} /></TabsContent>
          <TabsContent value="starred" className="mt-4"><MemoList items={starredMemos} /></TabsContent>
          <TabsContent value="workflow" className="mt-4"><MemoList items={workflowMemos} /></TabsContent>
          <TabsContent value="deleted" className="mt-4">
            {deletedMemos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No deleted memos</p>
            ) : (
              <div className="space-y-3">
                {deletedMemos.map(m => {
                  const deletedAt = (m as any).deletedAt;
                  const deletedDate = deletedAt ? new Date(deletedAt) : null;
                  const daysSinceDeleted = deletedDate ? Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

                  return (
                    <div key={m.id} className="flex items-center gap-3 bg-card rounded-xl border p-4 opacity-70 hover:opacity-90 transition-opacity">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-1">{m.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Deleted {deletedDate ? format(deletedDate, "MMM d, yyyy 'at' h:mm a") : ''}
                          {daysSinceDeleted > 0 && <span className="ml-1">({daysSinceDeleted}d ago)</span>}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => { restoreMemo(m.id); toast.success('Memo restored!'); }}>
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Restore this memo back to your feed</TooltipContent>
                      </Tooltip>
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1.5 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" /> Delete Forever
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Permanently delete this memo — cannot be undone</TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Permanently delete this memo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. The memo "{m.title}" will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => { permanentlyDeleteMemo(m.id); toast.success('Memo permanently deleted'); }}>
                              Delete Forever
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Memos;
