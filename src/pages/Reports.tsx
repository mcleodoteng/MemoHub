import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/context/RoleContext";
import { useSocket } from "@/context/SocketContext";
import { apiRequest } from "@/lib/api";
import { getUserInitials } from "@/lib/user-utils";
import { printHtmlReport } from "../lib/reports-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Printer,
  CalendarIcon,
  Filter,
  Users,
  BarChart3,
  Clock,
  CheckCircle2,
  ThumbsUp,
  Eye,
  Globe,
  Lock,
  Shield,
  TrendingUp,
  Activity,
  FileBarChart,
  Download,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  format,
  formatDistanceToNow,
  isWithinInterval,
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  Memo,
  MemoStatus,
  MemoVisibility,
  MemoActivityEntry,
  WorkflowConfig,
  ApprovalStep,
} from "@/types";
import { toast } from "sonner";

type ReportUser = {
  id: string;
  name: string;
  department?: string;
  role?: string;
  email?: string;
};

type ReportGroup = {
  id: string;
  name: string;
  type: string;
  memberIds: string[];
};

type ReportsSourcePayload = {
  generatedAt: string;
  users: ReportUser[];
  groups: ReportGroup[];
  memos: Memo[];
};

type BackendReaction = {
  emoji?: string;
  userId?: string;
};

type BackendRecipient = {
  userId?: string;
  id?: string;
  opened?: boolean;
  openedAt?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  approved?: boolean;
  approvedAt?: string;
  replied?: boolean;
  repliedAt?: string;
  repliedComment?: string;
};

type BackendTag = { name?: string } | string;

type BackendAttachment = {
  id: string;
  name?: string;
  filename?: string;
  type?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  thumbnailUrl?: string;
};

type BackendActivityLog = {
  id: string;
  userId: string;
  action: string;
  createdAt?: string;
  timestamp?: string;
  detail?: string;
};

type BackendMemoForReports = {
  id: string;
  title?: string;
  body?: string;
  creatorId: string;
  status?: string;
  visibility?: string;
  groupId?: string;
  recipients?: BackendRecipient[];
  tags?: BackendTag[];
  attachments?: BackendAttachment[];
  reactions?: BackendReaction[];
  pinned?: boolean;
  archived?: boolean;
  referencedMemoIds?: string[];
  activityLogs?: BackendActivityLog[];
  hiddenBy?: string[];
  starredBy?: string[];
  workflow?: unknown;
  previousStatus?: string;
  createdAt: string;
  updatedAt: string;
};

type BackendUserForReports = {
  id: string;
  name: string;
  department?: string;
  role?: string;
  email?: string;
};

type BackendGroupForReports = {
  id: string;
  name: string;
  type?: string;
  members?: Array<{ userId?: string; id?: string }>;
};

function normalizeMemoStatus(status?: string): MemoStatus {
  switch (status) {
    case "draft":
    case "pinned":
    case "archived":
    case "deleted":
      return status;
    default:
      return "sent";
  }
}

function normalizeMemoVisibility(visibility?: string): MemoVisibility {
  switch (visibility) {
    case "public":
    case "protected":
      return visibility;
    default:
      return "private";
  }
}

function normalizeActivityAction(action?: string): MemoActivityEntry["action"] {
  switch (action) {
    case "opened":
    case "acknowledged":
    case "unacknowledged":
    case "approved":
    case "unapproved":
    case "commented":
    case "replied":
    case "edited_comment":
    case "deleted_comment":
    case "reacted":
      return action;
    default:
      return "opened";
  }
}

function normalizeWorkflow(workflow: unknown): WorkflowConfig | undefined {
  if (!workflow || typeof workflow !== "object") return undefined;
  const candidate = workflow as {
    enabled?: unknown;
    approvalChain?: unknown;
    escalation?: WorkflowConfig["escalation"];
    scheduledSendAt?: string;
    sentBySchedule?: boolean;
  };

  if (!Array.isArray(candidate.approvalChain)) return undefined;

  const approvalChain: ApprovalStep[] = candidate.approvalChain
    .map((rawStep, index: number) => {
      const step = rawStep as {
        id?: string;
        approverId?: string;
        order?: number;
        status?: string;
        decidedAt?: string;
        comment?: string;
      };
      const normalizedStatus: ApprovalStep["status"] =
        step.status === "approved" || step.status === "rejected"
          ? step.status
          : "pending";
      return {
        id: String(step.id || `step-${index + 1}`),
        approverId: String(step.approverId || ""),
        order: Number(step.order || index + 1),
        status: normalizedStatus,
        decidedAt: step.decidedAt,
        comment: step.comment,
      };
    })
    .filter((step) => step.approverId);

  return {
    enabled: Boolean(candidate.enabled),
    approvalChain,
    escalation: candidate.escalation,
    scheduledSendAt: candidate.scheduledSendAt,
    sentBySchedule: candidate.sentBySchedule,
  };
}

function mapReactionSummary(reactions: BackendReaction[] = []) {
  const byEmoji = new Map<string, Set<string>>();
  for (const reaction of reactions) {
    const emoji = reaction?.emoji;
    const userId = reaction?.userId;
    if (!emoji || !userId) continue;
    if (!byEmoji.has(emoji)) byEmoji.set(emoji, new Set<string>());
    byEmoji.get(emoji)?.add(userId);
  }
  return Array.from(byEmoji.entries()).map(([emoji, users]) => ({
    emoji,
    users: Array.from(users),
  }));
}

function mapBackendMemoForReports(memo: BackendMemoForReports): Memo {
  const recipients = (memo.recipients || []).map(
    (recipient: BackendRecipient) => ({
      userId: recipient.userId || recipient.id,
      opened: !!recipient.opened,
      openedAt: recipient.openedAt
        ? new Date(recipient.openedAt).toISOString()
        : undefined,
      acknowledged: !!recipient.acknowledged,
      acknowledgedAt: recipient.acknowledgedAt
        ? new Date(recipient.acknowledgedAt).toISOString()
        : undefined,
      approved: !!recipient.approved,
      approvedAt: recipient.approvedAt
        ? new Date(recipient.approvedAt).toISOString()
        : undefined,
      replied: !!recipient.replied,
      repliedAt: recipient.repliedAt
        ? new Date(recipient.repliedAt).toISOString()
        : undefined,
      repliedComment: recipient.repliedComment,
    }),
  );

  return {
    id: memo.id,
    title: memo.title || "Untitled memo",
    body: memo.body || "",
    creatorId: memo.creatorId,
    recipientIds: recipients.map((recipient) => recipient.userId),
    recipientStatuses: recipients,
    status: normalizeMemoStatus(memo.status),
    visibility: normalizeMemoVisibility(memo.visibility),
    groupId: memo.groupId || undefined,
    tags: (memo.tags || [])
      .map((tag) => (typeof tag === "string" ? tag : tag.name || ""))
      .filter(Boolean),
    attachments: (memo.attachments || []).map(
      (attachment: BackendAttachment) => ({
        id: attachment.id,
        name: attachment.name || attachment.filename || "attachment",
        type: attachment.type || attachment.mimeType || "file",
        size: attachment.size || 0,
        url: attachment.url || "#",
        thumbnailUrl: attachment.thumbnailUrl,
      }),
    ),
    reactions: mapReactionSummary(memo.reactions || []),
    pinned: !!memo.pinned,
    archived: !!memo.archived,
    referencedMemoIds: memo.referencedMemoIds || [],
    editHistory: [],
    activityLog: (memo.activityLogs || []).map((entry: BackendActivityLog) => ({
      id: entry.id,
      userId: entry.userId,
      action: normalizeActivityAction(entry.action),
      timestamp: new Date(entry.createdAt || entry.timestamp).toISOString(),
      detail: entry.detail || undefined,
    })),
    hiddenBy: memo.hiddenBy || [],
    starredBy: memo.starredBy || [],
    workflow: normalizeWorkflow(memo.workflow),
    previousStatus: memo.previousStatus || undefined,
    createdAt: new Date(memo.createdAt).toISOString(),
    updatedAt: new Date(memo.updatedAt).toISOString(),
  };
}

function mapBackendUserForReports(user: BackendUserForReports): ReportUser {
  return {
    id: user.id,
    name: user.name,
    department: user.department || "General",
    role: user.role || "member",
    email: user.email,
  };
}

function mapBackendGroupForReports(group: BackendGroupForReports): ReportGroup {
  return {
    id: group.id,
    name: group.name,
    type: (group.type || "public").toLowerCase(),
    memberIds: (group.members || [])
      .map((member) => member.userId || member.id || "")
      .filter(Boolean),
  };
}

type ReportType =
  | "memo_summary"
  | "memo_detail"
  | "memo_activity"
  | "user_activity"
  | "acknowledgment"
  | "approval_status"
  | "group_activity"
  | "visibility_breakdown"
  | "workflow_report"
  | "overdue_approvals"
  | "tag_analysis"
  | "user_engagement";

interface ReportConfig {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const REPORT_TYPES: ReportConfig[] = [
  {
    id: "memo_summary",
    title: "Memo Summary",
    description: "Overview of all memos with status, visibility, and dates",
    icon: FileText,
  },
  {
    id: "memo_detail",
    title: "Detailed Memo Report",
    description:
      "Printable full-detail report for every memo including body, recipients, workflow and attachments",
    icon: FileText,
  },
  {
    id: "memo_activity",
    title: "Memo Activity Log",
    description:
      "Detailed activity log for memos (opens, acknowledges, approvals)",
    icon: Activity,
  },
  {
    id: "user_activity",
    title: "User Activity Report",
    description:
      "Activity breakdown per user — memos created, received, acknowledged",
    icon: Users,
  },
  {
    id: "acknowledgment",
    title: "Acknowledgment Report",
    description: "Track who has and hasn't acknowledged memos",
    icon: CheckCircle2,
  },
  {
    id: "approval_status",
    title: "Approval Status Report",
    description: "Status of all memo approvals and pending actions",
    icon: ThumbsUp,
  },
  {
    id: "group_activity",
    title: "Group Activity Report",
    description: "Memo and engagement statistics per group",
    icon: BarChart3,
  },
  {
    id: "visibility_breakdown",
    title: "Visibility Breakdown",
    description:
      "Memos categorized by public, private, and protected visibility",
    icon: Eye,
  },
  {
    id: "workflow_report",
    title: "Workflow Report",
    description: "Workflow approval chain status and bottlenecks",
    icon: TrendingUp,
  },
  {
    id: "overdue_approvals",
    title: "Overdue Approvals",
    description: "Memos pending approval beyond expected timelines",
    icon: AlertTriangle,
  },
  {
    id: "tag_analysis",
    title: "Tag Analysis",
    description: "Distribution and usage of tags across memos",
    icon: FileBarChart,
  },
  {
    id: "user_engagement",
    title: "User Engagement Metrics",
    description: "Reactions, comments, and engagement per user",
    icon: Activity,
    adminOnly: true,
  },
];

const Reports = () => {
  const { currentUser } = useAuth();
  const { hasPermission } = useRoles();
  const { onEvent, offEvent } = useSocket();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [allUsers, setAllUsers] = useState<ReportUser[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const canAccessReports = hasPermission("canAccessReports");
  const isAdmin =
    hasPermission("canManageUsers") || hasPermission("canViewAuditLogs");

  const getUserById = useCallback(
    (userId: string) => allUsers.find((user) => user.id === userId),
    [allUsers],
  );

  const getMemoReferenceLabel = useCallback(
    (memoId: string) => {
      const referencedMemo = memos.find((memo) => memo.id === memoId);
      if (!referencedMemo) {
        return `Memo (${memoId.slice(0, 8)})`;
      }

      const trimmedTitle = referencedMemo.title.trim();
      return trimmedTitle || `Untitled memo (${memoId.slice(0, 8)})`;
    },
    [memos],
  );

  const escapeHtml = useCallback((value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }, []);

  const formatExactComment = useCallback(
    (comment?: string) => {
      if (typeof comment !== "string" || comment.length === 0) return "-";
      return escapeHtml(comment);
    },
    [escapeHtml],
  );

  const refreshReportData = useCallback(async () => {
    if (!currentUser || !canAccessReports) return;
    setIsSyncing(true);
    try {
      const response = await apiRequest<{
        success: boolean;
        data: ReportsSourcePayload;
      }>("/reports/source");

      setMemos(response.data.memos || []);
      setAllUsers(response.data.users || []);
      setGroups(response.data.groups || []);
      setLastSyncedAt(response.data.generatedAt || new Date().toISOString());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to sync live report data from database";
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  }, [canAccessReports, currentUser]);

  useEffect(() => {
    if (!canAccessReports) return;
    void refreshReportData();
  }, [canAccessReports, refreshReportData]);

  useEffect(() => {
    if (!canAccessReports) return;
    const interval = window.setInterval(() => {
      void refreshReportData();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [canAccessReports, refreshReportData]);

  useEffect(() => {
    if (!canAccessReports) return;
    const syncLiveReports = () => {
      void refreshReportData();
    };

    const events = [
      "reports:data_updated",
      "memo_created",
      "memo_updated",
      "memo_deleted",
      "memo_archived",
      "memo_pinned",
      "memo_unpinned",
      "memo_status_updated",
      "memo_reaction_added",
      "memo_reaction_removed",
      "memo_workflow_approved",
      "memo_acknowledged_by_user",
      "comment_created",
      "group:member_updated",
      "notification:new",
    ];

    events.forEach((eventName) => onEvent(eventName, syncLiveReports));

    return () => {
      events.forEach((eventName) => offEvent(eventName, syncLiveReports));
    };
  }, [canAccessReports, offEvent, onEvent, refreshReportData]);

  const [selectedReport, setSelectedReport] =
    useState<ReportType>("memo_summary");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterVisibility, setFilterVisibility] = useState<string>("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    subMonths(new Date(), 1),
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const availableReports = REPORT_TYPES.filter((r) => !r.adminOnly || isAdmin);

  const filteredMemos = useMemo(() => {
    let result = memos.filter((m) => m.status !== "deleted");

    if (!isAdmin) {
      result = result.filter(
        (m) =>
          m.visibility === "public" ||
          m.creatorId === currentUser?.id ||
          m.recipientIds.includes(currentUser?.id || ""),
      );
    }

    if (filterUser !== "all")
      result = result.filter(
        (m) =>
          m.creatorId === filterUser || m.recipientIds.includes(filterUser),
      );
    if (filterVisibility !== "all")
      result = result.filter((m) => m.visibility === filterVisibility);
    if (filterGroup !== "all")
      result = result.filter((m) => m.groupId === filterGroup);
    if (filterStatus !== "all") {
      result = result.filter((memo) => {
        if (filterStatus === "pinned") return memo.pinned;
        if (filterStatus === "archived") return memo.archived;
        return memo.status === filterStatus;
      });
    }

    if (dateFrom && dateTo) {
      result = result.filter((m) => {
        const d = new Date(m.createdAt);
        return isWithinInterval(d, {
          start: startOfDay(dateFrom),
          end: endOfDay(dateTo),
        });
      });
    }

    return result;
  }, [
    memos,
    filterUser,
    filterVisibility,
    filterGroup,
    filterStatus,
    dateFrom,
    dateTo,
    isAdmin,
    currentUser,
  ]);

  const generateReportHtml = (): { title: string; html: string } => {
    const dateRange =
      dateFrom && dateTo
        ? `${format(dateFrom, "MMM d, yyyy")} — ${format(dateTo, "MMM d, yyyy")}`
        : "All time";
    const filterInfo = [
      filterUser !== "all" ? `User: ${getUserById(filterUser)?.name}` : null,
      filterVisibility !== "all" ? `Visibility: ${filterVisibility}` : null,
      filterGroup !== "all"
        ? `Group: ${groups.find((g) => g.id === filterGroup)?.name}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const reportConfig = REPORT_TYPES.find((r) => r.id === selectedReport)!;

    switch (selectedReport) {
      case "memo_detail": {
        return {
          title: "Detailed Memo Report",
          html: `
            <h1>Detailed Memo Report</h1>
            <div class="subtitle">${dateRange}${filterInfo ? " · " + filterInfo : ""} · ${filteredMemos.length} memos · Generated ${format(new Date(), "PPP 'at' p")}</div>
            ${filteredMemos
              .map((memo, index) => {
                const creator = getUserById(memo.creatorId);
                const group = memo.groupId
                  ? groups.find((g) => g.id === memo.groupId)
                  : undefined;
                const recipients = memo.recipientStatuses
                  .map((recipient) => {
                    const user = getUserById(recipient.userId);
                    return `<tr><td>${user?.name || recipient.userId}</td><td>${recipient.opened ? "Yes" : "No"}</td><td>${recipient.acknowledged ? "Yes" : "No"}</td><td>${recipient.approved ? "Yes" : "No"}</td><td>${recipient.replied ? "Yes" : "No"}</td><td style="white-space: pre-wrap;">${recipient.replied ? formatExactComment(recipient.repliedComment) : "-"}</td></tr>`;
                  })
                  .join("");
                const referencedMemos = memo.referencedMemoIds
                  .map((memoId) => getMemoReferenceLabel(memoId))
                  .join(", ");
                const workflowSteps = memo.workflow?.approvalChain?.length
                  ? `<table><thead><tr><th>Step</th><th>Approver</th><th>Status</th><th>Decision Time</th><th>Comment</th></tr></thead><tbody>${memo.workflow.approvalChain
                      .map((step) => {
                        const approver = getUserById(step.approverId);
                        return `<tr><td>${step.order}</td><td>${approver?.name || step.approverId}</td><td>${step.status}</td><td>${step.decidedAt ? format(new Date(step.decidedAt), "MMM d, yyyy p") : "-"}</td><td style="white-space: pre-wrap;">${formatExactComment(step.comment)}</td></tr>`;
                      })
                      .join("")}</tbody></table>`
                  : "<p>No workflow configured.</p>";

                return `
                <section style="margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; page-break-inside: avoid;">
                  <h2 style="font-size: 18px; margin-bottom: 6px;">${index + 1}. ${memo.title}</h2>
                  <div class="subtitle">
                    Created by ${creator?.name || memo.creatorId} · ${format(new Date(memo.createdAt), "PPP 'at' p")}
                    · <span class="badge badge-${memo.visibility}">${memo.visibility}</span>
                    · <span class="badge badge-${memo.status}">${memo.status}</span>
                    ${memo.pinned ? ' · <span class="badge badge-approved">pinned</span>' : ""}
                    ${memo.archived ? ' · <span class="badge badge-pending">archived</span>' : ""}
                  </div>
                  ${group ? `<div class="subtitle">Group: ${group.name} (${group.type})</div>` : ""}
                  ${memo.tags.length > 0 ? `<div class="subtitle">Tags: ${memo.tags.join(", ")}</div>` : ""}
                  ${memo.attachments.length > 0 ? `<div class="subtitle">Attachments: ${memo.attachments.map((attachment) => `${attachment.name} (${attachment.type}, ${attachment.size} bytes)`).join(", ")}</div>` : ""}
                  ${memo.referencedMemoIds.length > 0 ? `<div class="subtitle">Referenced memos: ${referencedMemos}</div>` : ""}
                  <div style="margin: 14px 0; line-height: 1.7; white-space: pre-wrap;">${memo.body}</div>
                  <h3 style="font-size: 14px; margin: 14px 0 8px;">Recipients</h3>
                  <table>
                    <thead><tr><th>Recipient</th><th>Opened</th><th>Acknowledged</th><th>Approved</th><th>Replied</th><th>Comment</th></tr></thead>
                    <tbody>${recipients || `<tr><td colspan="6">No recipients</td></tr>`}</tbody>
                  </table>
                  <h3 style="font-size: 14px; margin: 14px 0 8px;">Workflow</h3>
                  ${workflowSteps}
                  <h3 style="font-size: 14px; margin: 14px 0 8px;">Activity Summary</h3>
                  <table>
                    <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
                    <tbody>
                      ${
                        memo.activityLog.length > 0
                          ? memo.activityLog
                              .map((entry) => {
                                const actor = getUserById(entry.userId);
                                return `<tr><td>${format(new Date(entry.timestamp), "MMM d, yyyy p")}</td><td>${actor?.name || entry.userId}</td><td>${entry.action}</td><td>${entry.detail || "-"}</td></tr>`;
                              })
                              .join("")
                          : `<tr><td colspan="4">No recorded activity</td></tr>`
                      }
                    </tbody>
                  </table>
                </section>
              `;
              })
              .join("")}
          `,
        };
      }
      case "memo_summary": {
        return {
          title: "Memo Summary Report",
          html: `
            <h1>Memo Summary Report</h1>
            <div class="subtitle">${dateRange}${filterInfo ? " · " + filterInfo : ""} · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <div class="summary-grid">
              <div class="summary-card"><div class="label">Total Memos</div><div class="value">${filteredMemos.length}</div></div>
              <div class="summary-card"><div class="label">Public</div><div class="value">${filteredMemos.filter((m) => m.visibility === "public").length}</div></div>
              <div class="summary-card"><div class="label">Private</div><div class="value">${filteredMemos.filter((m) => m.visibility === "private").length}</div></div>
              <div class="summary-card"><div class="label">Protected</div><div class="value">${filteredMemos.filter((m) => m.visibility === "protected").length}</div></div>
            </div>
            <table><thead><tr><th>#</th><th>Title</th><th>Creator</th><th>Visibility</th><th>Status</th><th>Recipients</th><th>Date</th></tr></thead><tbody>
              ${filteredMemos.map((m, i) => `<tr><td>${i + 1}</td><td>${m.title}</td><td>${getUserById(m.creatorId)?.name || "?"}</td><td><span class="badge badge-${m.visibility}">${m.visibility}</span></td><td><span class="badge badge-${m.status}">${m.status}</span></td><td>${m.recipientIds.length}</td><td>${format(new Date(m.createdAt), "MMM d, yyyy")}</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      case "memo_activity": {
        const activities = filteredMemos.flatMap((m) =>
          m.activityLog.map((a) => ({
            ...a,
            memoTitle: m.title,
            memoId: m.id,
          })),
        );
        activities.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        return {
          title: "Memo Activity Log",
          html: `
            <h1>Memo Activity Log</h1>
            <div class="subtitle">${dateRange} · ${activities.length} activities · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>#</th><th>Memo</th><th>User</th><th>Action</th><th>Date</th><th>Detail</th></tr></thead><tbody>
              ${activities
                .slice(0, 200)
                .map(
                  (a, i) =>
                    `<tr><td>${i + 1}</td><td>${a.memoTitle}</td><td>${getUserById(a.userId)?.name || "?"}</td><td>${a.action}</td><td>${format(new Date(a.timestamp), "MMM d, p")}</td><td>${a.detail || "—"}</td></tr>`,
                )
                .join("")}
            </tbody></table>`,
        };
      }
      case "user_activity": {
        const userStats = allUsers
          .map((u) => {
            const created = filteredMemos.filter(
              (m) => m.creatorId === u.id,
            ).length;
            const received = filteredMemos.filter((m) =>
              m.recipientIds.includes(u.id),
            ).length;
            const acked = filteredMemos.filter((m) =>
              m.recipientStatuses.some(
                (s) => s.userId === u.id && s.acknowledged,
              ),
            ).length;
            const approved = filteredMemos.filter((m) =>
              m.recipientStatuses.some((s) => s.userId === u.id && s.approved),
            ).length;
            return { ...u, created, received, acked, approved };
          })
          .filter((u) => u.created > 0 || u.received > 0);
        return {
          title: "User Activity Report",
          html: `
            <h1>User Activity Report</h1>
            <div class="subtitle">${dateRange} · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>User</th><th>Department</th><th>Role</th><th>Created</th><th>Received</th><th>Acknowledged</th><th>Approved</th></tr></thead><tbody>
              ${userStats.map((u) => `<tr><td>${u.name}</td><td>${u.department}</td><td>${u.role}</td><td>${u.created}</td><td>${u.received}</td><td>${u.acked}</td><td>${u.approved}</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      case "acknowledgment": {
        const rows = filteredMemos.flatMap((m) =>
          m.recipientStatuses.map((s) => ({
            memo: m.title,
            user: getUserById(s.userId)?.name || "?",
            acknowledged: s.acknowledged,
            acknowledgedAt: s.acknowledgedAt,
          })),
        );
        const ackRate =
          rows.length > 0
            ? Math.round(
                (rows.filter((r) => r.acknowledged).length / rows.length) * 100,
              )
            : 0;
        return {
          title: "Acknowledgment Report",
          html: `
            <h1>Acknowledgment Report</h1>
            <div class="subtitle">${dateRange} · Ack rate: ${ackRate}% · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <div class="summary-grid">
              <div class="summary-card"><div class="label">Total</div><div class="value">${rows.length}</div></div>
              <div class="summary-card"><div class="label">Acknowledged</div><div class="value">${rows.filter((r) => r.acknowledged).length}</div></div>
              <div class="summary-card"><div class="label">Pending</div><div class="value">${rows.filter((r) => !r.acknowledged).length}</div></div>
              <div class="summary-card"><div class="label">Rate</div><div class="value">${ackRate}%</div></div>
            </div>
            <table><thead><tr><th>Memo</th><th>Recipient</th><th>Status</th><th>Date</th></tr></thead><tbody>
              ${rows.map((r) => `<tr><td>${r.memo}</td><td>${r.user}</td><td><span class="badge badge-${r.acknowledged ? "approved" : "pending"}">${r.acknowledged ? "Acknowledged" : "Pending"}</span></td><td>${r.acknowledgedAt ? format(new Date(r.acknowledgedAt), "MMM d, p") : "—"}</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      case "approval_status": {
        const rows = filteredMemos.flatMap((m) =>
          m.recipientStatuses.map((s) => ({
            memo: m.title,
            user: getUserById(s.userId)?.name || "?",
            approved: s.approved,
            approvedAt: s.approvedAt,
          })),
        );
        return {
          title: "Approval Status Report",
          html: `
            <h1>Approval Status Report</h1>
            <div class="subtitle">${dateRange} · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>Memo</th><th>Recipient</th><th>Status</th><th>Date</th></tr></thead><tbody>
              ${rows.map((r) => `<tr><td>${r.memo}</td><td>${r.user}</td><td><span class="badge badge-${r.approved ? "approved" : "pending"}">${r.approved ? "Approved" : "Pending"}</span></td><td>${r.approvedAt ? format(new Date(r.approvedAt), "MMM d, p") : "—"}</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      case "group_activity": {
        const groupStats = groups.map((g) => {
          const gMemos = filteredMemos.filter((m) => m.groupId === g.id);
          return {
            name: g.name,
            members: g.memberIds.length,
            memos: gMemos.length,
            type: g.type,
          };
        });
        return {
          title: "Group Activity Report",
          html: `
            <h1>Group Activity Report</h1>
            <div class="subtitle">${dateRange} · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>Group</th><th>Type</th><th>Members</th><th>Memos</th></tr></thead><tbody>
              ${groupStats.map((g) => `<tr><td>${g.name}</td><td>${g.type}</td><td>${g.members}</td><td>${g.memos}</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      case "visibility_breakdown": {
        const pub = filteredMemos.filter(
          (m) => m.visibility === "public",
        ).length;
        const priv = filteredMemos.filter(
          (m) => m.visibility === "private",
        ).length;
        const prot = filteredMemos.filter(
          (m) => m.visibility === "protected",
        ).length;
        return {
          title: "Visibility Breakdown",
          html: `
            <h1>Visibility Breakdown</h1>
            <div class="subtitle">${dateRange} · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <div class="summary-grid" style="grid-template-columns: repeat(3, 1fr);">
              <div class="summary-card"><div class="label">Public</div><div class="value">${pub}</div></div>
              <div class="summary-card"><div class="label">Private</div><div class="value">${priv}</div></div>
              <div class="summary-card"><div class="label">Protected</div><div class="value">${prot}</div></div>
            </div>
            <table><thead><tr><th>Title</th><th>Visibility</th><th>Creator</th><th>Recipients</th><th>Date</th></tr></thead><tbody>
              ${filteredMemos.map((m) => `<tr><td>${m.title}</td><td><span class="badge badge-${m.visibility}">${m.visibility}</span></td><td>${getUserById(m.creatorId)?.name || "?"}</td><td>${m.recipientIds.length}</td><td>${format(new Date(m.createdAt), "MMM d, yyyy")}</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      case "workflow_report": {
        const wfMemos = filteredMemos.filter((m) => m.workflow?.enabled);
        return {
          title: "Workflow Report",
          html: `
            <h1>Workflow Report</h1>
            <div class="subtitle">${dateRange} · ${wfMemos.length} workflow memos · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>Memo</th><th>Steps</th><th>Approved</th><th>Pending</th><th>Rejected</th></tr></thead><tbody>
              ${wfMemos
                .map((m) => {
                  const chain = m.workflow!.approvalChain;
                  return `<tr><td>${m.title}</td><td>${chain.length}</td><td>${chain.filter((s) => s.status === "approved").length}</td><td>${chain.filter((s) => s.status === "pending").length}</td><td>${chain.filter((s) => s.status === "rejected").length}</td></tr>`;
                })
                .join("")}
            </tbody></table>`,
        };
      }
      case "overdue_approvals": {
        const now = Date.now();
        const overdue = filteredMemos.filter((m) => {
          if (!m.workflow?.enabled) return false;
          const pending = m.workflow.approvalChain.find(
            (s) => s.status === "pending",
          );
          if (!pending) return false;
          const created = new Date(m.createdAt).getTime();
          return now - created > 48 * 60 * 60 * 1000;
        });
        return {
          title: "Overdue Approvals",
          html: `
            <h1>Overdue Approvals</h1>
            <div class="subtitle">${dateRange} · ${overdue.length} overdue · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>Memo</th><th>Creator</th><th>Pending Approver</th><th>Created</th><th>Days Pending</th></tr></thead><tbody>
              ${overdue
                .map((m) => {
                  const pending = m.workflow!.approvalChain.find(
                    (s) => s.status === "pending",
                  )!;
                  const days = Math.floor(
                    (now - new Date(m.createdAt).getTime()) /
                      (1000 * 60 * 60 * 24),
                  );
                  return `<tr><td>${m.title}</td><td>${getUserById(m.creatorId)?.name || "?"}</td><td>${getUserById(pending.approverId)?.name || "?"}</td><td>${format(new Date(m.createdAt), "MMM d")}</td><td style="color: ${days > 5 ? "red" : "orange"}; font-weight: 600;">${days}d</td></tr>`;
                })
                .join("")}
            </tbody></table>`,
        };
      }
      case "tag_analysis": {
        const tagMap: Record<string, number> = {};
        filteredMemos.forEach((m) =>
          m.tags.forEach((t) => {
            tagMap[t] = (tagMap[t] || 0) + 1;
          }),
        );
        const sorted = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
        return {
          title: "Tag Analysis",
          html: `
            <h1>Tag Analysis</h1>
            <div class="subtitle">${dateRange} · ${sorted.length} unique tags · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>Tag</th><th>Usage Count</th><th>Percentage</th></tr></thead><tbody>
              ${sorted.map(([tag, count]) => `<tr><td>${tag}</td><td>${count}</td><td>${Math.round((count / filteredMemos.length) * 100)}%</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      case "user_engagement": {
        const stats = allUsers
          .map((u) => {
            const reactionCount = filteredMemos.reduce(
              (sum, m) =>
                sum +
                m.reactions.reduce(
                  (s, r) => s + (r.users.includes(u.id) ? 1 : 0),
                  0,
                ),
              0,
            );
            const commentCount = filteredMemos.reduce(
              (sum, m) =>
                sum +
                m.activityLog.filter(
                  (a) => a.userId === u.id && a.action === "commented",
                ).length,
              0,
            );
            const starred = filteredMemos.filter((m) =>
              (m.starredBy || []).includes(u.id),
            ).length;
            return {
              name: u.name,
              dept: u.department,
              reactionCount,
              commentCount,
              starred,
            };
          })
          .filter(
            (u) => u.reactionCount > 0 || u.commentCount > 0 || u.starred > 0,
          );
        return {
          title: "User Engagement Metrics",
          html: `
            <h1>User Engagement Metrics</h1>
            <div class="subtitle">${dateRange} · Generated ${format(new Date(), "PPP 'at' p")}</div>
            <table><thead><tr><th>User</th><th>Department</th><th>Reactions</th><th>Comments</th><th>Starred</th></tr></thead><tbody>
              ${stats.map((u) => `<tr><td>${u.name}</td><td>${u.dept}</td><td>${u.reactionCount}</td><td>${u.commentCount}</td><td>${u.starred}</td></tr>`).join("")}
            </tbody></table>`,
        };
      }
      default:
        return { title: "Report", html: "<p>Select a report type</p>" };
    }
  };

  const handlePrint = () => {
    const { title, html } = generateReportHtml();
    printHtmlReport(title, html);
    toast.success("Report sent to printer");
  };

  const handlePrintAllMemos = () => {
    if (!isAdmin) return;
    const { title, html } = generateReportHtml();
    printHtmlReport(`All Memos - ${title}`, html);
    toast.success("Printing all memos report");
  };

  const currentReport = REPORT_TYPES.find((r) => r.id === selectedReport)!;

  if (!canAccessReports) {
    return (
      <AppLayout title="Reports">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Reports Access Required</CardTitle>
              <CardDescription>
                Your current role does not have permission to access reports.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reports">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live database-backed reports with realtime sync
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isSyncing
                ? "Syncing from database..."
                : lastSyncedAt
                  ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
                  : "Waiting for first sync..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handlePrintAllMemos}
              >
                <Download className="h-4 w-4" /> Print All Memos
              </Button>
            )}
            <Button className="gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Generate & Print
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar - Report Selection */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileBarChart className="h-4 w-4" /> Report Type
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px] lg:h-[420px]">
                  <div className="space-y-0.5 p-2">
                    {availableReports.map((r) => {
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedReport(r.id)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start gap-2.5",
                            selectedReport === r.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "hover:bg-secondary/80 text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-xs">{r.title}</div>
                            <div
                              className={cn(
                                "text-[10px] mt-0.5 line-clamp-2",
                                selectedReport === r.id
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground",
                              )}
                            >
                              {r.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main - Filters + Preview */}
          <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Date From */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">From Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left text-xs font-normal h-9",
                            !dateFrom && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {dateFrom
                            ? format(dateFrom, "MMM d, yyyy")
                            : "Start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* Date To */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">To Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left text-xs font-normal h-9",
                            !dateTo && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {dateTo ? format(dateTo, "MMM d, yyyy") : "End date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {/* User Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">User</Label>
                    <Select value={filterUser} onValueChange={setFilterUser}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {allUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Visibility */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Visibility</Label>
                    <Select
                      value={filterVisibility}
                      onValueChange={setFilterVisibility}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="protected">Protected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Group */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Group</Label>
                    <Select value={filterGroup} onValueChange={setFilterGroup}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={filterStatus}
                      onValueChange={setFilterStatus}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="pinned">Pinned</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setDateFrom(subDays(new Date(), 7));
                      setDateTo(new Date());
                    }}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setDateFrom(subMonths(new Date(), 1));
                      setDateTo(new Date());
                    }}
                  >
                    Last month
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setDateFrom(subMonths(new Date(), 3));
                      setDateTo(new Date());
                    }}
                  >
                    Last 3 months
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setFilterUser("all");
                      setFilterVisibility("all");
                      setFilterGroup("all");
                      setFilterStatus("all");
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    Clear all
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <currentReport.icon className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">
                      {currentReport.title}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {filteredMemos.length} memos
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {currentReport.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-secondary/30 rounded-lg p-4 min-h-[200px]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-card rounded-lg border p-3">
                      <div className="text-[10px] text-muted-foreground">
                        Total Memos
                      </div>
                      <div className="text-xl font-bold mt-1">
                        {filteredMemos.length}
                      </div>
                    </div>
                    <div className="bg-card rounded-lg border p-3">
                      <div className="text-[10px] text-muted-foreground">
                        With Workflow
                      </div>
                      <div className="text-xl font-bold mt-1">
                        {
                          filteredMemos.filter((m) => m.workflow?.enabled)
                            .length
                        }
                      </div>
                    </div>
                    <div className="bg-card rounded-lg border p-3">
                      <div className="text-[10px] text-muted-foreground">
                        Avg Recipients
                      </div>
                      <div className="text-xl font-bold mt-1">
                        {filteredMemos.length > 0
                          ? Math.round(
                              filteredMemos.reduce(
                                (s, m) => s + m.recipientIds.length,
                                0,
                              ) / filteredMemos.length,
                            )
                          : 0}
                      </div>
                    </div>
                    <div className="bg-card rounded-lg border p-3">
                      <div className="text-[10px] text-muted-foreground">
                        Unique Tags
                      </div>
                      <div className="text-xl font-bold mt-1">
                        {new Set(filteredMemos.flatMap((m) => m.tags)).size}
                      </div>
                    </div>
                  </div>

                  {/* Mini table preview */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                            #
                          </th>
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                            Title
                          </th>
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                            Creator
                          </th>
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                            Visibility
                          </th>
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMemos.slice(0, 8).map((m, i) => (
                          <tr key={m.id} className="border-b border-border/30">
                            <td className="py-2 px-2 text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="py-2 px-2 font-medium max-w-[200px] truncate">
                              {m.title}
                            </td>
                            <td className="py-2 px-2">
                              {getUserById(m.creatorId)?.name || "?"}
                            </td>
                            <td className="py-2 px-2">
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0"
                              >
                                {m.visibility}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-muted-foreground">
                              {format(new Date(m.createdAt), "MMM d")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredMemos.length > 8 && (
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        + {filteredMemos.length - 8} more memos in full report
                      </p>
                    )}
                    {filteredMemos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No memos match the current filters
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button className="gap-2" onClick={handlePrint}>
                    <Printer className="h-4 w-4" /> Generate & Print Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
