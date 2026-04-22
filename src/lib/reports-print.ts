import { format } from "date-fns";
import { Comment, Memo } from "@/types";
import { toast } from "sonner";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCommentPrintText(body: string): string {
  if (!body) return "";

  // Comments may contain mention/editor HTML; print human-readable text.
  if (body.trim().startsWith("<")) {
    const parsed = new DOMParser().parseFromString(body, "text/html");
    return parsed.body.textContent || "";
  }

  return body;
}

export function printHtmlReport(title: string, html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Popup blocked. Please allow popups.");
    return;
  }

  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #111; font-size: 13px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .subtitle { color: #666; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
      th { background: #f5f5f5; font-weight: 600; }
      tr:nth-child(even) { background: #fafafa; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
      .badge-public { background: #dbeafe; color: #1e40af; }
      .badge-private { background: #fce7f3; color: #9d174d; }
      .badge-protected { background: #fef3c7; color: #92400e; }
      .badge-sent { background: #d1fae5; color: #065f46; }
      .badge-draft { background: #fef3c7; color: #92400e; }
      .badge-approved { background: #d1fae5; color: #065f46; }
      .badge-pending { background: #fef3c7; color: #92400e; }
      .badge-rejected { background: #fee2e2; color: #991b1b; }
      .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
      .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      .summary-card .label { font-size: 11px; color: #6b7280; }
      .summary-card .value { font-size: 22px; font-weight: 700; margin-top: 2px; }
      @media print { body { padding: 12px; } }
    </style>
  </head><body>${html}</body></html>`);

  win.document.close();
  setTimeout(() => win.print(), 300);
}

export function printMemo(
  memo: Memo,
  resolveUserById?: (userId: string) => { name?: string } | undefined,
  memoComments: Comment[] = [],
) {
  const creator = resolveUserById?.(memo.creatorId);
  const recipients = memo.recipientIds
    .map((id) => resolveUserById?.(id)?.name || "Unknown")
    .join(", ");
  const openedCount = memo.recipientStatuses.filter((s) => s.opened).length;
  const ackCount = memo.recipientStatuses.filter((s) => s.acknowledged).length;
  const approvedCount = memo.recipientStatuses.filter((s) => s.approved).length;
  const total = memo.recipientStatuses.length;
  const sortedComments = [...memoComments].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const latestCommentByAuthor = new Map<string, string>();
  sortedComments.forEach((comment) => {
    const text = getCommentPrintText(comment.body).trim();
    if (!text) return;
    latestCommentByAuthor.set(comment.authorId, text);
  });

  const html = `
    <h1>${memo.title}</h1>
    <div class="subtitle">
      Created by ${creator?.name || "Unknown"} · ${format(new Date(memo.createdAt), "PPP 'at' p")}
      · <span class="badge badge-${memo.visibility}">${memo.visibility}</span>
      · <span class="badge badge-${memo.status}">${memo.status}</span>
    </div>
    <div class="subtitle">To: ${recipients || "-"}</div>
    ${memo.tags.length > 0 ? `<div class="subtitle">Tags: ${memo.tags.join(", ")}</div>` : ""}
    <hr style="margin: 12px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <div style="line-height: 1.7;">${memo.body}</div>
    <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <div class="summary-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="summary-card"><div class="label">Opened</div><div class="value">${openedCount}/${total}</div></div>
      <div class="summary-card"><div class="label">Acknowledged</div><div class="value">${ackCount}/${total}</div></div>
      <div class="summary-card"><div class="label">Approved</div><div class="value">${approvedCount}/${total}</div></div>
      <div class="summary-card"><div class="label">Attachments</div><div class="value">${memo.attachments.length}</div></div>
    </div>
    ${memo.recipientStatuses.length > 0 ? `
    <h3 style="font-size: 14px; margin-top: 16px; margin-bottom: 8px;">Recipient Status</h3>
    <table>
      <thead><tr><th>Recipient</th><th>Opened</th><th>Acknowledged</th><th>Approved</th><th>Replied</th><th>Comment</th></tr></thead>
      <tbody>
        ${memo.recipientStatuses
          .map((s) => {
            const user = resolveUserById?.(s.userId);
            const fallbackComment = latestCommentByAuthor.get(s.userId);
            const replyComment =
              s.replied && typeof s.repliedComment === "string"
                ? escapeHtml(s.repliedComment)
                : s.replied && fallbackComment
                  ? escapeHtml(fallbackComment)
                  : "-";
            return `<tr><td>${user?.name || s.userId}</td><td>${s.opened ? "✓" : "-"}</td><td>${s.acknowledged ? "✓" : "-"}</td><td>${s.approved ? "✓" : "-"}</td><td>${s.replied ? "✓" : "-"}</td><td style="white-space: pre-wrap;">${replyComment}</td></tr>`;
          })
          .join("")}
      </tbody>
    </table>` : ""}
    ${sortedComments.length > 0 ? `
    <h3 style="font-size: 14px; margin-top: 16px; margin-bottom: 8px;">Comments</h3>
    <table>
      <thead><tr><th>#</th><th>Author</th><th>Type</th><th>Date</th><th>Comment</th></tr></thead>
      <tbody>
        ${sortedComments
          .map((comment, index) => {
            const author = resolveUserById?.(comment.authorId);
            const text = escapeHtml(getCommentPrintText(comment.body));
            const type = comment.parentId ? "Reply" : "Comment";
            return `<tr><td>${index + 1}</td><td>${author?.name || comment.authorId}</td><td>${type}</td><td>${format(new Date(comment.createdAt), "MMM d, yyyy p")}</td><td style="white-space: pre-wrap;">${text || "-"}</td></tr>`;
          })
          .join("")}
      </tbody>
    </table>` : ""}
  `;

  printHtmlReport(`Memo - ${memo.title}`, html);
}
