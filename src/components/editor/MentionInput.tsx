import React, { useState, useRef } from 'react';
import { users, currentUser } from '@/data/mock';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getUserInitials } from '@/data/mock';
import { cn } from '@/lib/utils';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  onMention?: (userId: string) => void;
  onSubmit?: () => void;
}

export function MentionInput({
  value,
  onChange,
  placeholder = 'Type @ to mention someone...',
  className,
  rows = 3,
  onMention,
  onSubmit,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const otherUsers = users.filter(u => u.id !== currentUser.id);
  const filteredUsers = otherUsers.filter(u =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(pos);

    const textBefore = newValue.slice(0, pos);
    const lastAtIndex = textBefore.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const textAfterAt = textBefore.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') || textAfterAt.split(' ').length <= 2) {
        setMentionQuery(textAfterAt);
        setMentionStart(lastAtIndex);
        setShowSuggestions(true);
        return;
      }
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const selectMention = (user: typeof users[0]) => {
    if (mentionStart < 0) return;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPosition);
    const newValue = `${before}@${user.name} ${after}`;
    onChange(newValue);
    setShowSuggestions(false);
    onMention?.(user.id);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = mentionStart + user.name.length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-64 max-h-48 overflow-auto rounded-lg border bg-popover shadow-lg">
          {filteredUsers.slice(0, 6).map(user => (
            <button
              key={user.id}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-secondary/60 transition-colors text-left"
              onClick={() => selectMention(user)}
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
      )}
    </div>
  );
}
