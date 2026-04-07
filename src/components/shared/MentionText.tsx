import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { createElement, useMemo, type ReactNode } from "react";
import { useUsers } from "@/context/UserContext";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import type { User } from "@/types";

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
  const { users } = useUsers();

  // Split text by @mentions pattern
  const parts = text.split(/(@\w[\w\s]*?\b)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const nameCandidate = part.slice(1).trim();
          const matchedUser = users.find(
            (u) => u.name.toLowerCase() === nameCandidate.toLowerCase(),
          );
          if (matchedUser) {
            return (
              <UserHoverCard key={i} user={matchedUser}>
                <span
                  className="text-primary font-medium cursor-pointer underline decoration-primary/50 hover:decoration-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${matchedUser.id}`);
                  }}
                >
                  @{matchedUser.name}
                </span>
              </UserHoverCard>
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
export function processMentionsInHtml(
  html: string,
  users: User[] = [],
): string {
  // Sanitize HTML first to prevent XSS
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "a",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "blockquote",
      "code",
      "span",
    ],
    ALLOWED_ATTR: ["href", "class", "data-mention"],
  });

  return sanitized.replace(/@(\w[\w\s]*?\b)/g, (match, name) => {
    const user = users.find(
      (u) => u.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (user) {
      return `<a href="/profile/${encodeURIComponent(user.id)}" class="text-primary font-medium underline decoration-primary/50 hover:decoration-primary cursor-pointer" data-mention="${encodeURIComponent(user.id)}">@${DOMPurify.sanitize(user.name)}</a>`;
    }
    return match;
  });
}

interface MentionHtmlProps {
  html: string;
  className?: string;
}

/**
 * Renders rich HTML while preserving mention hover cards and profile navigation.
 */
export function MentionHtml({ html, className }: MentionHtmlProps) {
  const { users } = useUsers();
  const navigate = useNavigate();

  const renderedNodes = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const processed = processMentionsInHtml(html, users);
    const parser = new DOMParser();
    const doc = parser.parseFromString(processed, "text/html");

    const renderNode = (node: ChildNode, key: string): ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const children = Array.from(el.childNodes).map((child, index) =>
        renderNode(child, `${key}-${index}`),
      );

      if (tag === "a") {
        const href = el.getAttribute("href") || "#";
        const mentionUserId = el.getAttribute("data-mention");
        const mentionUser = mentionUserId
          ? users.find((u) => u.id === decodeURIComponent(mentionUserId))
          : undefined;

        if (mentionUser && href.startsWith("/profile/")) {
          return (
            <UserHoverCard key={key} user={mentionUser}>
              <span
                className={
                  el.className || "text-primary underline cursor-pointer"
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(href);
                }}
              >
                {children}
              </span>
            </UserHoverCard>
          );
        }

        return (
          <a
            key={key}
            href={href}
            className={el.className || undefined}
            onClick={(e) => {
              if (href.startsWith("/profile/")) {
                e.preventDefault();
                navigate(href);
              }
            }}
          >
            {children}
          </a>
        );
      }

      const VOID_ELEMENTS = new Set([
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
      ]);
      const props: Record<string, unknown> = { key };
      if (el.className) props.className = el.className;
      if (VOID_ELEMENTS.has(tag)) return createElement(tag, props);
      return createElement(tag, props, children);
    };

    return Array.from(doc.body.childNodes).map((node, index) =>
      renderNode(node, `root-${index}`),
    );
  }, [html, navigate, users]);

  return <div className={className}>{renderedNodes}</div>;
}
