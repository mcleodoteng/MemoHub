import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/context/UserContext";
import { getUserInitials } from "@/lib/user-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";

interface MentionListProps {
  items: typeof users;
  command: (item: { id: string; label: string }) => void;
}

const MentionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  MentionListProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((selectedIndex + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selectedIndex];
        if (item) command({ id: item.id, label: item.name });
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className="z-50 w-64 max-h-48 overflow-auto rounded-lg border bg-popover shadow-lg">
      {items.map((user, index) => (
        <button
          key={user.id}
          className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors text-left ${
            index === selectedIndex
              ? "bg-secondary/80"
              : "hover:bg-secondary/60"
          }`}
          onClick={() => command({ id: user.id, label: user.name })}
          type="button"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.department}</p>
          </div>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";

export function createMentionSuggestion(
  allUsers: any[],
  currentUserId?: string,
): Omit<SuggestionOptions, "editor"> {
  return {
    items: ({ query }: { query: string }) => {
      return allUsers
        .filter((u) => u.id !== currentUserId)
        .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6);
    },
    render: () => {
      let component: ReactRenderer<any>;
      let popup: TippyInstance[];

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate: (props: SuggestionProps) => {
          component?.updateProps(props);
          if (props.clientRect && popup?.[0]) {
            popup[0].setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          }
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
