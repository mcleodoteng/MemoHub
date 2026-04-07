import { useMemos } from "@/context/MemoContext";
import { useUsers } from "@/context/UserContext";
import { getUserInitials } from "@/lib/user-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Link2 } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MemoReferencePickerProps {
  onSelect: (memoId: string) => void;
  selectedIds: string[];
}

export function MemoReferencePicker({
  onSelect,
  selectedIds,
}: MemoReferencePickerProps) {
  const [search, setSearch] = useState("");
  const { memos } = useMemos();
  const { getUserById } = useUsers();

  const filtered = memos.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) &&
      !selectedIds.includes(m.id),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" type="button">
          <Link2 className="h-3.5 w-3.5" />
          Reference Memo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <Input
          placeholder="Search memos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-48 overflow-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No memos found
            </p>
          ) : (
            filtered.slice(0, 8).map((memo) => {
              const creator = getUserById(memo.creatorId);
              return (
                <button
                  key={memo.id}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-secondary/60 transition-colors"
                  onClick={() => {
                    onSelect(memo.id);
                    setSearch("");
                  }}
                  type="button"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{memo.title}</p>
                    <p className="text-xs text-muted-foreground">
                      by {creator?.name || "Unknown"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
