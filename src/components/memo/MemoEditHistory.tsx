import { MemoEditEntry } from "@/types";
import { useUsers } from "@/context/UserContext";

import { format } from "date-fns";
import { History } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MemoEditHistoryProps {
  history: MemoEditEntry[];
}

const fieldLabels: Record<string, string> = {
  title: "Title",
  body: "Content",
  tags: "Tags",
  visibility: "Visibility",
};

export function MemoEditHistory({ history }: MemoEditHistoryProps) {
  const [open, setOpen] = useState(false);
  const { getUserById } = useUsers();

  if (history.length === 0) return null;

  return (
    <div className="widget-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
          >
            <span className="flex items-center gap-2 font-display font-semibold text-sm">
              <History className="h-4 w-4 text-muted-foreground" />
              Edit History ({history.length}{" "}
              {history.length === 1 ? "edit" : "edits"})
            </span>
            <span className="text-xs text-muted-foreground">
              {open ? "Hide" : "Show"}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          {[...history].reverse().map((entry) => {
            const editor = getUserById(entry.editedBy);
            return (
              <div
                key={entry.id}
                className="border-l-2 border-primary/20 pl-3 py-1 space-y-1"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {editor?.name || "Unknown"}
                  </span>
                  <span>•</span>
                  <span>
                    {format(
                      new Date(entry.editedAt),
                      "MMM d, yyyy 'at' h:mm a",
                    )}
                  </span>
                </div>
                {entry.changes.map((change, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium text-muted-foreground">
                      {fieldLabels[change.field] || change.field}:
                    </span>
                    {change.field === "body" ? (
                      <span className="text-muted-foreground ml-1">
                        Content was updated
                      </span>
                    ) : (
                      <>
                        <span className="line-through text-destructive/70 mx-1">
                          {change.oldValue || "(empty)"}
                        </span>
                        <span className="text-success">
                          → {change.newValue || "(empty)"}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
