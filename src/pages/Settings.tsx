import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { useRoles, roleLabels, roleHierarchy, UserRole } from '@/context/RoleContext';
import { users } from '@/data/mock';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  User, Shield, Bell, Palette, Lock, Users, Settings2, Code,
  Globe, Eye, EyeOff, Save, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { getUserInitials } from '@/data/mock';

const Settings = () => {
  const { currentUser } = useAuth();
  const { permissions, currentRole, hasPermission } = useRoles();

  // Profile state
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileDept, setProfileDept] = useState(currentUser?.department || '');

  // Notification prefs
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [memoNotifs, setMemoNotifs] = useState(true);
  const [mentionNotifs, setMentionNotifs] = useState(true);
  const [workflowNotifs, setWorkflowNotifs] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState('daily');

  // Appearance
  const [theme, setTheme] = useState('system');
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Security
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');

  // System (admin+)
  const [allowPublicMemos, setAllowPublicMemos] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [maxAttachmentSize, setMaxAttachmentSize] = useState('10');
  const [auditRetention, setAuditRetention] = useState('90');

  const handleSave = (section: string) => {
    toast.success(`${section} settings saved`);
  };

  const settingsTabs = [
    { id: 'profile', label: 'Profile', icon: User, minRole: 'member' as UserRole },
    { id: 'notifications', label: 'Notifications', icon: Bell, minRole: 'member' as UserRole },
    { id: 'appearance', label: 'Appearance', icon: Palette, minRole: 'member' as UserRole },
    { id: 'security', label: 'Security', icon: Lock, minRole: 'member' as UserRole },
    { id: 'users', label: 'User Management', icon: Users, minRole: 'admin' as UserRole },
    { id: 'system', label: 'System', icon: Settings2, minRole: 'admin' as UserRole },
    { id: 'developer', label: 'Developer', icon: Code, minRole: 'super_admin' as UserRole },
  ];

  const visibleTabs = settingsTabs.filter(t => {
    const idx = roleHierarchy.indexOf(currentRole);
    const reqIdx = roleHierarchy.indexOf(t.minRole);
    return idx <= reqIdx;
  });

  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || 'profile');

  const roleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-destructive/10 text-destructive',
      admin: 'bg-warning/10 text-warning',
      manager: 'bg-info/10 text-info',
      group_leader: 'bg-accent/10 text-accent',
      member: 'bg-muted text-muted-foreground',
    };
    return colors[role] || colors.member;
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Settings2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-lg">Settings</h2>
            <p className="text-xs text-muted-foreground">
              Logged in as <span className="font-medium">{currentUser?.name}</span>
              <Badge className={`ml-2 text-[9px] px-1.5 py-0 ${roleBadgeColor(currentRole)}`}>
                {roleLabels[currentRole]}
              </Badge>
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row gap-6">
          <TabsList className="flex md:flex-col h-auto md:w-52 bg-card border border-border/50 p-1.5 rounded-xl shrink-0">
            {visibleTabs.map(t => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="w-full justify-start gap-2 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-w-0">
            {/* PROFILE */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display">Personal Profile</CardTitle>
                  <CardDescription>Manage your profile information and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                        {getUserInitials(currentUser?.name || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{currentUser?.name}</p>
                      <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                      <Badge className={`mt-1 text-[10px] ${roleBadgeColor(currentRole)}`}>
                        {roleLabels[currentRole]}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Display Name</Label>
                      <Input value={profileName} onChange={e => setProfileName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} type="email" />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input value={profileDept} onChange={e => setProfileDept(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select defaultValue={currentUser?.status || 'online'}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">🟢 Online</SelectItem>
                          <SelectItem value="away">🟡 Away</SelectItem>
                          <SelectItem value="offline">⚫ Offline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={() => handleSave('Profile')} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save Profile
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* NOTIFICATIONS */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display">Notification Preferences</CardTitle>
                  <CardDescription>Control how and when you receive notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-4">
                    {[
                      { label: 'Email Notifications', desc: 'Receive notifications via email', state: emailNotifs, set: setEmailNotifs },
                      { label: 'Push Notifications', desc: 'Browser push notifications', state: pushNotifs, set: setPushNotifs },
                      { label: 'Memo Notifications', desc: 'New memos and updates', state: memoNotifs, set: setMemoNotifs },
                      { label: 'Mention Alerts', desc: 'When someone mentions you', state: mentionNotifs, set: setMentionNotifs },
                      { label: 'Workflow Alerts', desc: 'Pending approvals and status changes', state: workflowNotifs, set: setWorkflowNotifs },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch checked={item.state} onCheckedChange={item.set} />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Digest Frequency</Label>
                    <Select value={digestFrequency} onValueChange={setDigestFrequency}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={() => handleSave('Notification')} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save Preferences
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* APPEARANCE */}
            <TabsContent value="appearance">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display">Appearance</CardTitle>
                  <CardDescription>Customize the look and feel of the application</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">☀️ Light</SelectItem>
                        <SelectItem value="dark">🌙 Dark</SelectItem>
                        <SelectItem value="system">💻 System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Compact Mode</p>
                      <p className="text-xs text-muted-foreground">Reduce spacing for denser layouts</p>
                    </div>
                    <Switch checked={compactMode} onCheckedChange={setCompactMode} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Animations</p>
                      <p className="text-xs text-muted-foreground">Enable transition and motion effects</p>
                    </div>
                    <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
                  </div>

                  <Button onClick={() => handleSave('Appearance')} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save Appearance
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECURITY */}
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display">Security</CardTitle>
                  <CardDescription>Manage your account security settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Change Password</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input type="password" placeholder="Current password" />
                      <Input type="password" placeholder="New password" />
                    </div>
                    <Button variant="outline" size="sm">Update Password</Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                    </div>
                    <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
                  </div>

                  <div className="space-y-2">
                    <Label>Session Timeout (minutes)</Label>
                    <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={() => handleSave('Security')} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save Security Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* USER MANAGEMENT (admin+) */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Shield className="h-4 w-4 text-warning" /> User Management
                  </CardTitle>
                  <CardDescription>Manage user accounts, roles, and access levels</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground">
                      <span>User</span>
                      <span>Role</span>
                      <span>Status</span>
                    </div>
                    {users.map(u => (
                      <div key={u.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-3 border-t border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                              {getUserInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <Badge className={`text-[9px] ${roleBadgeColor(u.role)}`}>
                          {roleLabels[u.role as UserRole] || u.role}
                        </Badge>
                        <span className={`text-[10px] font-medium ${
                          u.status === 'online' ? 'text-success' : u.status === 'away' ? 'text-warning' : 'text-muted-foreground'
                        }`}>
                          {u.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {hasPermission('canAssignRoles') && (
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium">Role Hierarchy</p>
                      <div className="flex flex-wrap gap-2">
                        {roleHierarchy.map((role, i) => (
                          <div key={role} className="flex items-center gap-1">
                            <Badge className={`text-[10px] ${roleBadgeColor(role)}`}>{roleLabels[role]}</Badge>
                            {i < roleHierarchy.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Higher roles inherit all permissions of lower roles</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SYSTEM (admin+) */}
            <TabsContent value="system">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" /> System Configuration
                  </CardTitle>
                  <CardDescription>Platform-wide settings that affect all users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Allow Public Memos</p>
                      <p className="text-xs text-muted-foreground">Users can create memos visible to everyone</p>
                    </div>
                    <Switch checked={allowPublicMemos} onCheckedChange={setAllowPublicMemos} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Require Approval for Broadcasts</p>
                      <p className="text-xs text-muted-foreground">Memos sent to all must be admin-approved first</p>
                    </div>
                    <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Max Attachment Size (MB)</Label>
                      <Select value={maxAttachmentSize} onValueChange={setMaxAttachmentSize}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 MB</SelectItem>
                          <SelectItem value="10">10 MB</SelectItem>
                          <SelectItem value="25">25 MB</SelectItem>
                          <SelectItem value="50">50 MB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Audit Log Retention (days)</Label>
                      <Select value={auditRetention} onValueChange={setAuditRetention}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={() => handleSave('System')} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save System Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* DEVELOPER (super_admin only) */}
            <TabsContent value="developer">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Code className="h-4 w-4 text-destructive" /> Developer Tools
                  </CardTitle>
                  <CardDescription>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      Super Admin only — these settings affect core platform behavior
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-destructive">Danger Zone</p>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Debug Mode</p>
                        <p className="text-xs text-muted-foreground">Enable verbose logging and debug panels</p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">API Rate Limiting</p>
                        <p className="text-xs text-muted-foreground">Control request throttling</p>
                      </div>
                      <Select defaultValue="standard">
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="strict">Strict</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Maintenance Mode</p>
                        <p className="text-xs text-muted-foreground">Show maintenance page to non-admin users</p>
                      </div>
                      <Switch />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Integration Endpoints</p>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Webhook URL</span>
                        <code className="text-[10px] bg-muted px-2 py-1 rounded">https://api.memohub.com/webhooks</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">API Version</span>
                        <code className="text-[10px] bg-muted px-2 py-1 rounded">v2.1.0</code>
                      </div>
                    </div>
                  </div>

                  <Button onClick={() => handleSave('Developer')} variant="destructive" className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save Developer Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
