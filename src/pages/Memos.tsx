import { AppLayout } from "@/components/layout/AppLayout";
import { MemoCard } from "@/components/memo/MemoCard";
import { useMemos } from "@/context/MemoContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenSquare, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const Memos = () => {
  const navigate = useNavigate();
  const { memos } = useMemos();
  const [search, setSearch] = useState("");

  const filtered = memos.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.body.toLowerCase().includes(search.toLowerCase()) ||
    m.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const activeMemos = filtered.filter(m => m.status !== 'deleted');
  const publicMemos = activeMemos.filter(m => m.visibility === "public" && !m.archived);
  const privateMemos = activeMemos.filter(m => m.visibility === "private" && !m.archived);
  const protectedMemos = activeMemos.filter(m => m.visibility === "protected" && !m.archived);
  const pinnedMemos = activeMemos.filter(m => m.pinned && !m.archived);
  const archivedMemos = activeMemos.filter(m => m.archived);

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
            <PenSquare className="h-4 w-4" />
            Compose
          </Button>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All ({activeMemos.filter(m => !m.archived).length})</TabsTrigger>
            <TabsTrigger value="public">Public ({publicMemos.length})</TabsTrigger>
            <TabsTrigger value="private">Private ({privateMemos.length})</TabsTrigger>
            <TabsTrigger value="protected">Protected ({protectedMemos.length})</TabsTrigger>
            <TabsTrigger value="pinned">Pinned ({pinnedMemos.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedMemos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <MemoList items={activeMemos.filter(m => !m.archived)} />
          </TabsContent>
          <TabsContent value="public" className="mt-4"><MemoList items={publicMemos} /></TabsContent>
          <TabsContent value="private" className="mt-4"><MemoList items={privateMemos} /></TabsContent>
          <TabsContent value="protected" className="mt-4"><MemoList items={protectedMemos} /></TabsContent>
          <TabsContent value="pinned" className="mt-4"><MemoList items={pinnedMemos} /></TabsContent>
          <TabsContent value="archived" className="mt-4"><MemoList items={archivedMemos} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Memos;
