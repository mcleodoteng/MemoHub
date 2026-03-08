import { Memo, ApprovalStep } from "@/types";

export type WorkflowState = "inactive" | "pending" | "approved" | "rejected";

export function isWorkflowEnabledMemo(memo: Memo) {
  return memo.status === "sent" && !!memo.workflow?.enabled && memo.workflow.approvalChain.length > 0;
}

export function getCurrentPendingApprovalStep(memo: Memo): ApprovalStep | undefined {
  if (!isWorkflowEnabledMemo(memo)) return undefined;

  const sortedSteps = [...memo.workflow!.approvalChain].sort((a, b) => a.order - b.order);

  for (const step of sortedSteps) {
    if (step.status !== "pending") continue;

    const allPriorApproved = sortedSteps
      .filter((candidate) => candidate.order < step.order)
      .every((candidate) => candidate.status === "approved");

    if (allPriorApproved) return step;
  }

  return undefined;
}

export function getWorkflowState(memo: Memo): WorkflowState {
  if (!isWorkflowEnabledMemo(memo)) return "inactive";

  const chain = memo.workflow!.approvalChain;

  if (chain.some((step) => step.status === "rejected")) return "rejected";
  if (chain.every((step) => step.status === "approved")) return "approved";
  return "pending";
}

export function isPendingWorkflowApprovalForUser(memo: Memo, userId: string) {
  const pendingStep = getCurrentPendingApprovalStep(memo);
  return !!pendingStep && pendingStep.approverId === userId;
}

export function getWorkflowPendingCountForUser(memos: Memo[], userId: string) {
  return memos.filter((memo) => isPendingWorkflowApprovalForUser(memo, userId)).length;
}

export function getActiveWorkflowMemos(memos: Memo[]) {
  return memos.filter((memo) => isWorkflowEnabledMemo(memo));
}
