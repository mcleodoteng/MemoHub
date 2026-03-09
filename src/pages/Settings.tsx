import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { useRoles, roleLabels, roleHierarchy, UserRole } from '@/context/RoleContext';
import { useOnlineStatuses } from '@/hooks/useOnlineStatus';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  User, Shield, Bell, Palette, Lock, Users, Settings2, Code,
  Save, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { getUserInitials } from '@/data/mock';

// ===== Persistence helpers =====
const SETTINGS_KEY = 'memohub_settings';

interface PersistedSettings {
  profile: { name: string; email: string; department: string; bio: string };
  notifications: {
    email: boolean; push: boolean; memo: boolean; mention: boolean; workflow: boolean;
    digestFrequency: string;
  };
  appearance: { theme: string; compactMode: boolean; animations: boolean };
  security: { twoFactor: boolean; sessionTimeout: string };
  system: {
    allowPublicMemos: boolean; requireApproval: boolean;
    maxAttachmentSize: string; auditRetention: string;
  };
  developer: { debugMode: boolean; rateLimit: string; maintenanceMode: boolean };
}

function loadSettings(userId: string): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSettingsSection(userId: string, section: string, data: any) {
  const all = loadSettings(userId);
  (all as any)[section] = data;
  localStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(all));
}

// ===== Component =====
const Settings = () => {
  const { currentUser } = useAuth();
  const { permissions, currentRole, hasPermission } = useRoles();
  const { getUserStatus } = useOnlineStatuses();
  const userId = currentUser?.id || '';

  const saved = loadSettings(userId);

  // Profile state
  const [profileName, setProfileName] = useState(saved.profile?.name ?? currentUser?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(saved.profile?.email ?? currentUser?.email ?? '');
  const [profileDept, setProfileDept] = useState(saved.profile?.department ?? currentUser?.department ?? '');
  const [profileBio, setProfileBio] = useState(saved.profile?.bio ?? '');

  // Notification prefs
  const [emailNotifs, setEmailNotifs] = useState(saved.notifications?.email ?? true);
  const [pushNotifs, setPushNotifs] = useState(saved.notifications?.push ?? true);
  const [memoNotifs, setMemoNotifs] = useState(saved.notifications?.memo ?? true);
  const [mentionNotifs, setMentionNotifs] = useState(saved.notifications?.mention ?? true);
  const [workflowNotifs, setWorkflowNotifs] = useState(saved.notifications?.workflow ?? true);
  const [digestFrequency, setDigestFrequency] = useState(saved.notifications?.digestFrequency ?? 'daily');

  // Appearance
  const [theme, setTheme] = useState(saved.appearance?.theme ?? 'system');
  const [compactMode, setCompactMode] = useState(saved.appearance?.compactMode ?? false);
  const [animationsEnabled, setAnimationsEnabled] = useState(saved.appearance?.animations ?? true);

  // Security
  const [twoFactor, setTwoFactor] = useState(saved.security?.twoFactor ?? false);
  const [sessionTimeout, setSessionTimeout] = useState(saved.security?.sessionTimeout ?? '30');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // System (admin+)
  const [allowPublicMemos, setAllowPublicMemos] = useState(saved.system?.allowPublicMemos ?? true);
  const [requireApproval, setRequireApproval] = useState(saved.system?.requireApproval ?? false);
  const [maxAttachmentSize, setMaxAttachmentSize] = useState(saved.system?.maxAttachmentSize ?? '10');
  const [auditRetention, setAuditRetention] = useState(saved.system?.auditRetention ?? '90');

  // Developer (super_admin)
  const [debugMode, setDebugMode] = useState(saved.developer?.debugMode ?? false);
  const [rateLimit, setRateLimit] = useState(saved.developer?.rateLimit ?? 'standard');
  const [maintenanceMode, setMaintenanceMode] = useState(saved.developer?.maintenanceMode ?? false);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('compact-mode', compactMode);
  }, [compactMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--transition-speed', animationsEnabled ? '1' : '0');
  }, [animationsEnabled]);

  const handleSaveProfile = () => {
    saveSettingsSection(userId, 'profile', { name: profileName, email: profileEmail, department: profileDept, bio: profileBio });
    toast.success('Profile saved successfully');
  };

  const handleSaveNotifications = () => {
    saveSettingsSection(userId, 'notifications', {
      email: emailNotifs, push: pushNotifs, memo: memoNotifs,
      mention: mentionNotifs, workflow: workflowNotifs, digestFrequency,
    });
    toast.success('Notification preferences saved');
  };

  const handleSaveAppearance = () => {
    saveSettingsSection(userId, 'appearance', { theme, compactMode, animations: animationsEnabled });
    toast.success('Appearance settings saved');
  };

  const handleSaveSecurity = () => {
    if (currentPassword || newPassword) {
      if (currentPassword !== 'password') {
        toast.error('Current password is incorrect');
        return;
      }
      if (newPassword.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    }
    saveSettingsSection(userId, 'security', { twoFactor, sessionTimeout });
    toast.success('Security settings saved');
  };

  const handleSaveSystem = () => {
    saveSettingsSection(userId, 'system', { allowPublicMemos, requireApproval, maxAttachmentSize, auditRetention });
    toast.success('System settings saved');
  };

  const handleSaveDeveloper = () => {
    saveSettingsSection(userId, 'developer', { debugMode, rateLimit, maintenanceMode });
    toast.success('Developer settings saved');
  };

  const settingsTabs = [
    { id: 'profile', label: 'Profile', icon: User, minRole: 'member' as UserRole },
    { id: 'notifications', label: 'Notifications', icon: Bell, minRole: 'member' as UserRole },
    { id: 'appearance', label: 'Appearance', icon: Palette, minRole: 'member' as UserRole },
    { id: 'security', label: 'Security', icon: Lock, minRole: 'member' as UserRole },
    { id: 'users', label: 'Users', icon: Users, minRole: 'admin' as UserRole },
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Horizontal scrollable tabs on mobile, vertical sidebar on desktop */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Mobile: horizontal scrollable tab bar */}
            <div className="md:hidden">
              <ScrollArea className="w-full">
                <TabsList className="inline-flex w-max h-auto bg-card border border-border/50 p-1 rounded-xl gap-1">
                  {visibleTabs.map(t => (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Desktop: vertical sidebar tabs */}
            <div className="hidden md:block">
              <TabsList className="flex flex-col h-auto w-52 bg-card border border-border/50 p-1.5 rounded-xl gap-0.5">
                {visibleTabs.map(t => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="w-full justify-start gap-2.5 px-3 py-2.5 text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 min-w-0">
              {/* PROFILE */}
              <TabsContent value="profile" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display">Personal Profile</CardTitle>
                    <CardDescription>Manage your profile information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-16 w-16">
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                            {getUserInitials(profileName || currentUser?.name || '')}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                          getUserStatus(userId) === 'online' ? 'bg-emerald-500' : getUserStatus(userId) === 'away' ? 'bg-amber-500' : 'bg-muted-foreground/40'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{profileName}</p>
                        <p className="text-sm text-muted-foreground">{profileEmail}</p>
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
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Bio</Label>
                        <Input value={profileBio} onChange={e => setProfileBio(e.target.value)} placeholder="Tell others about yourself..." />
                      </div>
                    </div>

                    <Button onClick={handleSaveProfile} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Profile
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* NOTIFICATIONS */}
              <TabsContent value="notifications" className="mt-0">
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

                    <Button onClick={handleSaveNotifications} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Preferences
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* APPEARANCE */}
              <TabsContent value="appearance" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display">Appearance</CardTitle>
                    <CardDescription>Customize the look and feel</CardDescription>
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

                    <Button onClick={handleSaveAppearance} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Appearance
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SECURITY */}
              <TabsContent value="security" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display">Security</CardTitle>
                    <CardDescription>Manage your account security</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label>Change Password</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                        <Input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      </div>
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

                    <Button onClick={handleSaveSecurity} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Security Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* USER MANAGEMENT (admin+) */}
              <TabsContent value="users" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Shield className="h-4 w-4 text-warning" /> User Management
                    </CardTitle>
                    <CardDescription>Manage user accounts, roles, and access levels</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground">
                        <span>User</span>
                        <span>Role</span>
                        <span>Status</span>
                      </div>
                      {users.map(u => {
                        const uStatus = getUserStatus(u.id);
                        return (
                          <div key={u.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 items-start sm:items-center p-3 border-t border-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative shrink-0">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                    {getUserInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                                  uStatus === 'online' ? 'bg-emerald-500' : uStatus === 'away' ? 'bg-amber-500' : 'bg-muted-foreground/40'
                                }`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                              </div>
                            </div>
                            <Badge className={`text-[9px] ${roleBadgeColor(u.role)}`}>
                              {roleLabels[u.role as UserRole] || u.role}
                            </Badge>
                            <span className={`text-[10px] font-medium capitalize ${
                              uStatus === 'online' ? 'text-success' : uStatus === 'away' ? 'text-warning' : 'text-muted-foreground'
                            }`}>
                              {uStatus}
                            </span>
                          </div>
                        );
                      })}
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
              <TabsContent value="system" className="mt-0">
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

                    <Button onClick={handleSaveSystem} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save System Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* DEVELOPER (super_admin only) */}
              <TabsContent value="developer" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Code className="h-4 w-4 text-destructive" /> Developer Tools
                    </CardTitle>
                    <CardDescription>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        Super Admin only — affects core platform behavior
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
                        <Switch checked={debugMode} onCheckedChange={setDebugMode} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">API Rate Limiting</p>
                          <p className="text-xs text-muted-foreground">Control request throttling</p>
                        </div>
                        <Select value={rateLimit} onValueChange={setRateLimit}>
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
                        <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Integration Endpoints</p>
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground">Webhook URL</span>
                          <code className="text-[10px] bg-muted px-2 py-1 rounded break-all">https://api.memohub.com/webhooks</code>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground">API Version</span>
                          <code className="text-[10px] bg-muted px-2 py-1 rounded">v2.1.0</code>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleSaveDeveloper} variant="destructive" className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Developer Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
