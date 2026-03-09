import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowStatus } from "@/components/memo/WorkflowStatus";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMemos } from "@/context/MemoContext";
import { currentUser, getUserById, users } from "@/data/mock";
import {
  getActiveWorkflowMemos,
  getCurrentPendingApprovalStep,
  getWorkflowState,
  isPendingWorkflowApprovalForUser,
  type WorkflowState,
} from "@/lib/workflow";
import { CheckCircle2, Clock, Filter, GitMerge, Search, XCircle } from "lucide-react";

const WorkflowDashboard = () => {
  const navigate = useNavigate();
  const { memos, approveWorkflowStep } = useMemos();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const activeWorkflowMemos = useMemo(
    () =>
      getActiveWorkflowMemos(memos)
        .filter((memo) => !memo.archived && !(memo.hiddenBy || []).includes(currentUser.id))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [memos],
  );

  // Collect all approvers across active workflows for the assignee filter
  const approverOptions = useMemo(() => {
    const approverIds = new Set<string>();
    activeWorkflowMemos.forEach((memo) => {
      memo.workflow?.approvalChain.forEach((step) => approverIds.add(step.approverId));
    });
    return Array.from(approverIds)
      .map((id) => getUserById(id))
      .filter(Boolean) as { id: string; name: string }[];
  }, [activeWorkflowMemos]);

  const filteredMemos = useMemo(() => {
    let result = activeWorkflowMemos;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((memo) => getWorkflowState(memo) === statusFilter);
    }

    // Assignee filter
    if (assigneeFilter === "mine") {
      result = result.filter((memo) => isPendingWorkflowApprovalForUser(memo, currentUser.id));
    } else if (assigneeFilter !== "all") {
      result = result.filter((memo) =>
        memo.workflow?.approvalChain.some((step) => step.approverId === assigneeFilter),
      );
    }

    // Text search
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (memo) =>
          memo.title.toLowerCase().includes(query) ||
          memo.body.toLowerCase().includes(query) ||
          memo.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [activeWorkflowMemos, search, statusFilter, assigneeFilter]);

  const summary = useMemo(() => {
    const inProgress = activeWorkflowMemos.filter((memo) => getWorkflowState(memo) === "pending").length;
    const approved = activeWorkflowMemos.filter((memo) => getWorkflowState(memo) === "approved").length;
    const rejected = activeWorkflowMemos.filter((memo) => getWorkflowState(memo) === "rejected").length;
    const awaitingMine = activeWorkflowMemos.filter((memo) => isPendingWorkflowApprovalForUser(memo, currentUser.id)).length;

    return {
      total: activeWorkflowMemos.length,
      inProgress,
      approved,
      rejected,
      awaitingMine,
    };
  }, [activeWorkflowMemos]);

  return (
    <AppLayout title="Workflow Dashboard">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Approval Chains</p>
            <h2 className="font-display text-lg font-semibold">Track active memo workflows in one place</h2>
            <p className="text-xs text-muted-foreground">Monitor each step, spot blockers, and approve pending items instantly.</p>
          </div>
          {summary.awaitingMine > 0 && (
            <Badge className="gap-1.5 self-start bg-warning/15 text-warning border-warning/30 sm:self-center">
              <Clock className="h-3.5 w-3.5" />
              {summary.awaitingMine} awaiting your approval
            </Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Chains</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-display font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">In Progress</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-display font-bold">{summary.inProgress}</p>
              <Clock className="h-4 w-4 text-warning" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Approved</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-display font-bold">{summary.approved}</p>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rejected</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-display font-bold">{summary.rejected}</p>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search workflows by title, content, or tags..."
            className="bg-secondary pl-9"
          />
        </div>

        {filteredMemos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GitMerge className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">No active workflows found</p>
              <p className="text-sm text-muted-foreground">Try changing your search or send a memo with approvals enabled.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredMemos.map((memo) => {
              const state = getWorkflowState(memo);
              const currentStep = getCurrentPendingApprovalStep(memo);
              const totalSteps = memo.workflow?.approvalChain.length || 0;
              const completedSteps = memo.workflow?.approvalChain.filter((step) => step.status !== "pending").length || 0;
              const currentApprover = currentStep ? getUserById(currentStep.approverId) : undefined;

              return (
                <Card key={memo.id}>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{memo.title}</CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          state === "approved"
                            ? "border-success/30 bg-success/10 text-success"
                            : state === "rejected"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-warning/30 bg-warning/10 text-warning"
                        }
                      >
                        {state === "approved" ? "Approved" : state === "rejected" ? "Rejected" : "In Progress"}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        {completedSteps}/{totalSteps} steps decided
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Created by {getUserById(memo.creatorId)?.name || "Unknown"}</span>
                      {currentApprover && state === "pending" && (
                        <span>Current approver: {currentApprover.name}</span>
                      )}
                      <span>Updated {new Date(memo.updatedAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/memos/${memo.id}`)}>
                        Open memo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <WorkflowStatus
                      memo={memo}
                      currentUserId={currentUser.id}
                      onApprove={(stepId, approved, comment) =>
                        approveWorkflowStep(memo.id, stepId, currentUser.id, approved, comment)
                      }
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default WorkflowDashboard;
