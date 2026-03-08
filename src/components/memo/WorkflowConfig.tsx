import { useState } from 'react';
import { ApprovalStep, WorkflowConfig as WorkflowConfigType } from '@/types';
import { users, currentUser, getUserById, getUserInitials } from '@/data/mock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  GitBranch, Plus, X, GripVertical, Clock, AlertTriangle,
  ChevronDown, ArrowRight, CalendarClock, Users,
} from 'lucide-react';
import { UserHoverCard } from '@/components/user/UserHoverCard';

interface WorkflowConfigProps {
  workflow: WorkflowConfigType;
  onChange: (workflow: WorkflowConfigType) => void;
}

export function WorkflowConfigPanel({ workflow, onChange }: WorkflowConfigProps) {
  const [isOpen, setIsOpen] = useState(workflow.enabled);
  const otherUsers = users.filter(u => u.id !== currentUser.id);

  const toggleEnabled = (enabled: boolean) => {
    onChange({ ...workflow, enabled });
    setIsOpen(enabled);
  };

  const addApprovalStep = (userId: string) => {
    if (workflow.approvalChain.some(s => s.approverId === userId)) return;
    const newStep: ApprovalStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      approverId: userId,
      order: workflow.approvalChain.length + 1,
      status: 'pending',
    };
    onChange({
      ...workflow,
      approvalChain: [...workflow.approvalChain, newStep],
    });
  };

  const removeStep = (stepId: string) => {
    const updated = workflow.approvalChain
      .filter(s => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    onChange({ ...workflow, approvalChain: updated });
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const idx = workflow.approvalChain.findIndex(s => s.id === stepId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === workflow.approvalChain.length - 1) return;

    const newChain = [...workflow.approvalChain];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newChain[idx], newChain[swapIdx]] = [newChain[swapIdx], newChain[idx]];
    onChange({
      ...workflow,
      approvalChain: newChain.map((s, i) => ({ ...s, order: i + 1 })),
    });
  };

  const toggleEscalation = (enabled: boolean) => {
    onChange({
      ...workflow,
      escalation: {
        enabled,
        hoursUntilEscalation: workflow.escalation?.hoursUntilEscalation || 24,
        escalateToUserId: workflow.escalation?.escalateToUserId,
      },
    });
  };

  const updateEscalationHours = (hours: string) => {
    const h = parseInt(hours, 10);
    if (isNaN(h) || h < 1) return;
    onChange({
      ...workflow,
      escalation: { ...workflow.escalation!, enabled: true, hoursUntilEscalation: h },
    });
  };

  const updateEscalationTarget = (userId: string) => {
    onChange({
      ...workflow,
      escalation: { ...workflow.escalation!, enabled: true, escalateToUserId: userId },
    });
  };

  const updateScheduledSend = (datetime: string) => {
    onChange({
      ...workflow,
      scheduledSendAt: datetime ? new Date(datetime).toISOString() : undefined,
    });
  };

  const availableApprovers = otherUsers.filter(
    u => !workflow.approvalChain.some(s => s.approverId === u.id)
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <GitBranch className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Workflow Automation</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <Switch checked={workflow.enabled} onCheckedChange={toggleEnabled} />
        </div>

        <CollapsibleContent className="space-y-5">
          {/* Approval Chain */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approval Chain</Label>
            </div>

            {workflow.approvalChain.length > 0 ? (
              <div className="space-y-2">
                {workflow.approvalChain.map((step, idx) => {
                  const user = getUserById(step.approverId);
                  if (!user) return null;
                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      {idx > 0 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground -ml-0.5 -mt-6" />
                      )}
                      <div className="flex items-center gap-2 flex-1 p-2 rounded-lg bg-secondary/50 group">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                        <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {step.order}
                        </Badge>
                        <UserHoverCard user={user}>
                          <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                {getUserInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{user.name}</p>
                              <p className="text-[10px] text-muted-foreground">{user.role} · {user.department}</p>
                            </div>
                          </div>
                        </UserHoverCard>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx > 0 && (
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveStep(step.id, 'up')}>
                              <span className="text-[10px]">↑</span>
                            </Button>
                          )}
                          {idx < workflow.approvalChain.length - 1 && (
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveStep(step.id, 'down')}>
                              <span className="text-[10px]">↓</span>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeStep(step.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No approval steps added yet. Add approvers in order.</p>
            )}

            {availableApprovers.length > 0 && (
              <Select onValueChange={addApprovalStep}>
                <SelectTrigger className="h-8 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Plus className="h-3 w-3" />
                    <SelectValue placeholder="Add approver..." />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableApprovers.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                            {getUserInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        {u.name} <span className="text-muted-foreground">· {u.role}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Escalation */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auto-Escalation</Label>
              </div>
              <Switch
                checked={workflow.escalation?.enabled || false}
                onCheckedChange={toggleEscalation}
              />
            </div>

            {workflow.escalation?.enabled && (
              <div className="space-y-2 pl-5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Escalate after</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={workflow.escalation.hoursUntilEscalation}
                    onChange={e => updateEscalationHours(e.target.value)}
                    className="h-7 w-16 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Notify</Label>
                  <Select
                    value={workflow.escalation.escalateToUserId || ''}
                    onValueChange={updateEscalationTarget}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Select person..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherUsers.map(u => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          {u.name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Scheduled Send */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-info" />
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scheduled Delivery</Label>
            </div>
            <Input
              type="datetime-local"
              value={workflow.scheduledSendAt ? new Date(workflow.scheduledSendAt).toISOString().slice(0, 16) : ''}
              onChange={e => updateScheduledSend(e.target.value)}
              className="h-8 text-xs"
              min={new Date().toISOString().slice(0, 16)}
            />
            {workflow.scheduledSendAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-info" />
                <p className="text-xs text-muted-foreground">
                  Will be sent automatically on {new Date(workflow.scheduledSendAt).toLocaleString()}
                </p>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => updateScheduledSend('')}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
