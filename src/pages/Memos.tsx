import { AppLayout } from "@/components/layout/AppLayout";
import { MemoCard } from "@/components/memo/MemoCard";
import { memos } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Memos = () => {
  const navigate = useNavigate();

  const publicMemos = memos.filter((m) => m.visibility === "public" && !m.archived);
  const privateMemos = memos.filter((m) => m.visibility === "private" && !m.archived);
  const protectedMemos = memos.filter((m) => m.visibility === "protected" && !m.archived);
  const pinnedMemos = memos.filter((m) => m.pinned && !m.archived);
  const archivedMemos = memos.filter((m) => m.archived);

  return (
    <AppLayout title="Memos">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {memos.length} total memos
          </p>
          <Button onClick={() => navigate("/compose")} className="gap-2">
            <PenSquare className="h-4 w-4" />
            Compose
          </Button>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({memos.length})</TabsTrigger>
            <TabsTrigger value="public">Public ({publicMemos.length})</TabsTrigger>
            <TabsTrigger value="private">Private ({privateMemos.length})</TabsTrigger>
            <TabsTrigger value="protected">Protected ({protectedMemos.length})</TabsTrigger>
            <TabsTrigger value="pinned">Pinned ({pinnedMemos.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedMemos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-4">
            {memos.map((m) => <MemoCard key={m.id} memo={m} />)}
          </TabsContent>
          <TabsContent value="public" className="space-y-3 mt-4">
            {publicMemos.map((m) => <MemoCard key={m.id} memo={m} />)}
          </TabsContent>
          <TabsContent value="private" className="space-y-3 mt-4">
            {privateMemos.map((m) => <MemoCard key={m.id} memo={m} />)}
          </TabsContent>
          <TabsContent value="protected" className="space-y-3 mt-4">
            {protectedMemos.map((m) => <MemoCard key={m.id} memo={m} />)}
          </TabsContent>
          <TabsContent value="pinned" className="space-y-3 mt-4">
            {pinnedMemos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pinned memos</p>
            ) : pinnedMemos.map((m) => <MemoCard key={m.id} memo={m} />)}
          </TabsContent>
          <TabsContent value="archived" className="space-y-3 mt-4">
            {archivedMemos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No archived memos</p>
            ) : archivedMemos.map((m) => <MemoCard key={m.id} memo={m} />)}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Memos;
