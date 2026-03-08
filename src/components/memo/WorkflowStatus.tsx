import { Memo, ApprovalStep } from '@/types';
import { getUserById, getUserInitials } from '@/data/mock';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserHoverCard } from '@/components/user/UserHoverCard';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight,
  GitBranch, CalendarClock, MessageSquare,
} from 'lucide-react';
import { useState } from 'react';

interface WorkflowStatusProps {
  memo: Memo;
  currentUserId: string;
  onApprove: (stepId: string, approved: boolean, comment?: string) => void;
}

export function WorkflowStatus({ memo, currentUserId, onApprove }: WorkflowStatusProps) {
  const [commentStepId, setCommentStepId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  if (!memo.workflow?.enabled || memo.workflow.approvalChain.length === 0) return null;

  const { approvalChain, escalation, scheduledSendAt, sentBySchedule } = memo.workflow;

  const allApproved = approvalChain.every(s => s.status === 'approved');
  const anyRejected = approvalChain.some(s => s.status === 'rejected');
  const currentStep = approvalChain.find(s => s.status === 'pending');

  const getStepIcon = (step: ApprovalStep) => {
    switch (step.status) {
      case 'approved': return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStepBg = (step: ApprovalStep) => {
    switch (step.status) {
      case 'approved': return 'bg-success/10 border-success/30';
      case 'rejected': return 'bg-destructive/10 border-destructive/30';
      default: return step.id === currentStep?.id ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-secondary/50 border-border';
    }
  };

  const handleSubmitDecision = (stepId: string, approved: boolean) => {
    onApprove(stepId, approved, commentText || undefined);
    setCommentStepId(null);
    setCommentText('');
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Approval Workflow</span>
        </div>
        {allApproved && (
          <Badge className="bg-success/15 text-success border-success/30 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Fully Approved
          </Badge>
        )}
        {anyRejected && (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        )}
        {!allApproved && !anyRejected && (
          <Badge className="bg-warning/15 text-warning border-warning/30 gap-1">
            <Clock className="h-3 w-3" /> In Progress
          </Badge>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {approvalChain.map((step, idx) => {
          const user = getUserById(step.approverId);
          if (!user) return null;
          const isCurrentApprover = step.id === currentStep?.id && step.approverId === currentUserId;

          return (
            <div key={step.id}>
              {idx > 0 && (
                <div className="flex items-center gap-2 py-0.5 pl-5">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getStepBg(step)}`}>
                {getStepIcon(step)}
                <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {step.order}
                </Badge>
                <UserHoverCard user={user}>
                  <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                        {getUserInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground">{user.role} · {user.department}</p>
                    </div>
                  </div>
                </UserHoverCard>
                <div className="flex items-center gap-2 shrink-0">
                  {step.decidedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(step.decidedAt).toLocaleDateString()}
                    </span>
                  )}
                  {isCurrentApprover && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => commentStepId === step.id ? handleSubmitDecision(step.id, false) : setCommentStepId(step.id)}
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => commentStepId === step.id ? handleSubmitDecision(step.id, true) : handleSubmitDecision(step.id, true)}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {/* Comment input */}
              {commentStepId === step.id && (
                <div className="ml-8 mt-2 space-y-2">
                  <Textarea
                    placeholder="Add a comment (optional)..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCommentStepId(null); setCommentText(''); }}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => handleSubmitDecision(step.id, false)}>
                      <XCircle className="h-3 w-3" /> Confirm Reject
                    </Button>
                  </div>
                </div>
              )}
              {/* Show comment if present */}
              {step.comment && (
                <div className="ml-8 mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>"{step.comment}"</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Escalation notice */}
      {escalation?.enabled && (
        <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${escalation.escalatedAt ? 'bg-warning/10 border border-warning/30' : 'bg-secondary/50'}`}>
          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${escalation.escalatedAt ? 'text-warning' : 'text-muted-foreground'}`} />
          {escalation.escalatedAt ? (
            <span className="text-warning font-medium">
              Escalation triggered — pending approval exceeded {escalation.hoursUntilEscalation}h
              {escalation.escalateToUserId && ` (notified ${getUserById(escalation.escalateToUserId)?.name})`}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Auto-escalation after {escalation.hoursUntilEscalation}h of inactivity
              {escalation.escalateToUserId && ` → ${getUserById(escalation.escalateToUserId)?.name}`}
            </span>
          )}
        </div>
      )}

      {/* Scheduled delivery */}
      {scheduledSendAt && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-info/10 border border-info/30 text-xs">
          <CalendarClock className="h-3.5 w-3.5 text-info shrink-0" />
          {sentBySchedule ? (
            <span className="text-info font-medium">Delivered automatically on schedule</span>
          ) : (
            <span className="text-info">
              Scheduled for {new Date(scheduledSendAt).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
