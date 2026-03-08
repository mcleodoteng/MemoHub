import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { users } from '@/data/mock';

interface MentionTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with @mentions as clickable links to user profiles.
 * Works for both plain text and inline usage.
 */
export function MentionText({ text, className }: MentionTextProps) {
  const navigate = useNavigate();

  // Split text by @mentions pattern
  const parts = text.split(/(@\w[\w\s]*?\b)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const nameCandidate = part.slice(1).trim();
          const matchedUser = users.find(
            (u) => u.name.toLowerCase() === nameCandidate.toLowerCase()
          );
          if (matchedUser) {
            return (
              <span
                key={i}
                className="text-primary font-medium cursor-pointer underline decoration-primary/50 hover:decoration-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${matchedUser.id}`);
                }}
              >
                @{matchedUser.name}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Process HTML content to turn @mentions into clickable links.
 * Returns modified HTML string.
 */
export function processMentionsInHtml(html: string): string {
  return html.replace(/@(\w[\w\s]*?\b)/g, (match, name) => {
    const user = users.find(
      (u) => u.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (user) {
      return `<a href="/profile/${user.id}" class="text-primary font-medium underline decoration-primary/50 hover:decoration-primary cursor-pointer" data-mention="${user.id}">@${user.name}</a>`;
    }
    return match;
  });
}
