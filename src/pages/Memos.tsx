import { AppLayout } from "@/components/layout/AppLayout";
import { MemoCard } from "@/components/memo/MemoCard";
import { useMemos } from "@/context/MemoContext";
import { currentUser } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenSquare, Search, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

const Memos = () => {
  const navigate = useNavigate();
  const { memos, restoreMemo } = useMemos();
  const [search, setSearch] = useState("");

  // Filter out memos hidden by current user
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

  // Sort pinned memos first
  const allNonArchived = sentMemos.filter(m => !m.archived).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const MemoList = ({ items }: { items: typeof memos }) =>
    items.length === 0 ? (
      <p className="text-center text-muted-foreground py-8">No memos found</p>
    ) : (
      <div className="space-y-3">
        {items.map(m => <MemoCard key={m.id} memo={m} />)}
      </div>
    );

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
          <Button onClick={() => navigate("/compose")} className="gap-2 shrink-0">
            <PenSquare className="h-4 w-4" /> Compose
          </Button>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All ({sentMemos.filter(m => !m.archived).length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({draftMemos.length})</TabsTrigger>
            <TabsTrigger value="public">Public ({publicMemos.length})</TabsTrigger>
            <TabsTrigger value="private">Private ({privateMemos.length})</TabsTrigger>
            <TabsTrigger value="protected">Protected ({protectedMemos.length})</TabsTrigger>
            <TabsTrigger value="pinned">Pinned ({pinnedMemos.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedMemos.length})</TabsTrigger>
            <TabsTrigger value="deleted">Deleted ({deletedMemos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <MemoList items={allNonArchived} />
          </TabsContent>
          <TabsContent value="drafts" className="mt-4"><MemoList items={draftMemos} /></TabsContent>
          <TabsContent value="public" className="mt-4"><MemoList items={publicMemos} /></TabsContent>
          <TabsContent value="private" className="mt-4"><MemoList items={privateMemos} /></TabsContent>
          <TabsContent value="protected" className="mt-4"><MemoList items={protectedMemos} /></TabsContent>
          <TabsContent value="pinned" className="mt-4"><MemoList items={pinnedMemos} /></TabsContent>
          <TabsContent value="archived" className="mt-4"><MemoList items={archivedMemos} /></TabsContent>
          <TabsContent value="deleted" className="mt-4">
            {deletedMemos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No deleted memos</p>
            ) : (
              <div className="space-y-3">
                {deletedMemos.map(m => (
                  <div key={m.id} className="flex items-center gap-3 bg-card rounded-xl border p-4 opacity-70">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm line-clamp-1">{m.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Deleted {(m as any).deletedAt ? new Date((m as any).deletedAt).toLocaleDateString() : ''}</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => { restoreMemo(m.id); toast.success('Memo restored!'); }}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Restore this memo back to your feed</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Memos;
