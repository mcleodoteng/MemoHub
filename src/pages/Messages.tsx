import { AppLayout } from "@/components/layout/AppLayout";
import { MentionInput } from "@/components/editor/MentionInput";
import { useMessages } from "@/context/MessageContext";
import { useMemos } from "@/context/MemoContext";
import { useGroups } from "@/context/GroupContext";
import { currentUser, getUserById, getUserInitials } from "@/data/mock";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Send, Users as UsersIcon, SmilePlus, FileText, Share2, Search, X,
  Star, StarOff, Hash, MessageCircle, ArrowLeft, Paperclip, Image as ImageIcon,
} from "lucide-react";
import { Attachment } from "@/types";
import { useState, useRef, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from "date-fns";
import { useNavigate } from "react-router-dom";

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '👏', '🔥', '💡'];

const Messages = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    conversations, sendMessage, addReaction, markAsRead,
    getConversationMessages, typingUsers, starMessage, starredMessages, getUnreadCount,
  } = useMessages();
  const { memos } = useMemos();
  const { groups } = useGroups();

  const [selectedConv, setSelectedConv] = useState(conversations[0]?.id || "");
  const [newMessage, setNewMessage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [tab, setTab] = useState<'direct' | 'channels' | 'starred'>('direct');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === selectedConv);
  const convMessages = getConversationMessages(selectedConv);
  const convTyping = typingUsers[selectedConv] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length, convTyping]);

  useEffect(() => {
    if (selectedConv) markAsRead(selectedConv, currentUser.id);
  }, [selectedConv, convMessages.length]);

  const getConvName = (conv: typeof conversations[0]) => {
    if (conv.name) return conv.name;
    if (conv.groupId) {
      const grp = groups.find(g => g.id === conv.groupId);
      if (grp) return grp.name;
    }
    const other = conv.participantIds.find(id => id !== currentUser.id);
    return other ? getUserById(other)?.name || "Unknown" : "Unknown";
  };

  const getConvInitials = (conv: typeof conversations[0]) => {
    if (conv.type === "group") return conv.name?.[0] || "G";
    const other = conv.participantIds.find(id => id !== currentUser.id);
    const user = other ? getUserById(other) : null;
    return user ? getUserInitials(user.name) : "?";
  };

  const getOtherUserStatus = (conv: typeof conversations[0]) => {
    if (conv.type !== 'direct') return null;
    const other = conv.participantIds.find(id => id !== currentUser.id);
    return other ? getUserById(other)?.status : null;
  };

  // Split conversations
  const directConvs = conversations.filter(c => c.type === 'direct');
  const channelConvs = conversations.filter(c => c.type === 'group');

  // Sort by latest, then filter
  const sortedDirect = useMemo(() => {
    let filtered = directConvs;
    if (convSearch.trim()) {
      const q = convSearch.toLowerCase();
      filtered = filtered.filter(c => getConvName(c).toLowerCase().includes(q) || c.lastMessage?.body.toLowerCase().includes(q));
    }
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [directConvs, convSearch]);

  const sortedChannels = useMemo(() => {
    let filtered = channelConvs;
    if (convSearch.trim()) {
      const q = convSearch.toLowerCase();
      filtered = filtered.filter(c => getConvName(c).toLowerCase().includes(q) || c.lastMessage?.body.toLowerCase().includes(q));
    }
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [channelConvs, convSearch]);

  const filteredMessages = useMemo(() => {
    if (!msgSearch.trim()) return convMessages;
    const q = msgSearch.toLowerCase();
    return convMessages.filter(msg => msg.body.toLowerCase().includes(q));
  }, [convMessages, msgSearch]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessage(selectedConv, newMessage);
    setNewMessage("");
  };

  const handleShareMemo = (memoId: string, memoTitle: string) => {
    sendMessage(selectedConv, `📋 Shared memo: ${memoTitle}`, { memoId, title: memoTitle });
    setShareOpen(false);
  };

  const renderConvItem = (conv: typeof conversations[0]) => {
    const unread = getUnreadCount(conv.id, currentUser.id);
    const typing = typingUsers[conv.id] || [];
    const otherStatus = getOtherUserStatus(conv);

    return (
      <div
        key={conv.id}
        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
          selectedConv === conv.id ? "bg-secondary" : "hover:bg-secondary/50"
        }`}
        onClick={() => { setSelectedConv(conv.id); if (isMobile) setMobileShowChat(true); }}
      >
        <div className="relative">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={`text-xs font-semibold ${conv.type === 'group' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
              {conv.type === "group" ? <Hash className="h-4 w-4" /> : getConvInitials(conv)}
            </AvatarFallback>
          </Avatar>
          {otherStatus === 'online' && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card" />
          )}
          {otherStatus === 'away' && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-warning border-2 border-card" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-sm truncate ${unread > 0 ? "font-semibold" : "font-medium"}`}>
              {getConvName(conv)}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {conv.lastMessage && format(new Date(conv.updatedAt), "MMM d")}
            </span>
          </div>
          {typing.length > 0 ? (
            <p className="text-xs text-primary italic flex items-center gap-1">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              typing...
            </p>
          ) : (
            <p className={`text-xs truncate ${unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
              {conv.lastMessage?.body}
            </p>
          )}
        </div>
        {unread > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
    );
  };

  const activeList = tab === 'direct' ? sortedDirect : tab === 'channels' ? sortedChannels : [];

  return (
    <AppLayout title="Messages">
      <div className="max-w-5xl mx-auto">
        <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-card overflow-hidden">
          {/* Conversation List */}
          <div className={`${isMobile ? 'w-full' : 'w-80'} border-r flex flex-col shrink-0 ${isMobile && mobileShowChat ? 'hidden' : ''}`}>
            <div className="p-3 border-b space-y-2">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
                <TabsList className="w-full h-8">
                  <TabsTrigger value="direct" className="flex-1 text-xs gap-1">
                    <MessageCircle className="h-3 w-3" /> Direct
                    {directConvs.some(c => getUnreadCount(c.id, currentUser.id) > 0) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="channels" className="flex-1 text-xs gap-1">
                    <Hash className="h-3 w-3" /> Channels
                  </TabsTrigger>
                  <TabsTrigger value="starred" className="flex-1 text-xs gap-1">
                    <Star className="h-3 w-3" /> Starred
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {tab !== 'starred' && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${tab === 'direct' ? 'messages' : 'channels'}...`}
                    value={convSearch}
                    onChange={e => setConvSearch(e.target.value)}
                    className="h-8 text-sm bg-secondary border-none pl-8"
                  />
                  {convSearch && (
                    <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setConvSearch("")}>
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto scrollbar-thin">
              {tab === 'starred' ? (
                starredMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No starred messages</p>
                ) : (
                  starredMessages.map(msg => {
                    const sender = getUserById(msg.senderId);
                    return (
                      <div
                        key={msg.id}
                        className="flex items-start gap-2 p-3 cursor-pointer hover:bg-secondary/50 transition-colors border-b border-border/50"
                        onClick={() => { setSelectedConv(msg.conversationId); if (isMobile) setMobileShowChat(true); }}
                      >
                        <Star className="h-3.5 w-3.5 text-warning shrink-0 mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{sender?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate">{msg.body}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )
              ) : activeList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No {tab === 'direct' ? 'conversations' : 'channels'} found</p>
              ) : (
                activeList.map(renderConvItem)
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${isMobile && !mobileShowChat ? 'hidden' : ''}`}>
            {activeConv ? (
              <>
                <div className="p-3 border-b flex items-center gap-3">
                  {isMobile && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setMobileShowChat(false)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {activeConv.type === 'group' ? <Hash className="h-4 w-4" /> : getConvInitials(activeConv)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{getConvName(activeConv)}</p>
                    <p className="text-xs text-muted-foreground">{activeConv.participantIds.length} participants</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMsgSearch(!showMsgSearch)}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Search messages in this conversation</TooltipContent>
                  </Tooltip>
                </div>

                {showMsgSearch && (
                  <div className="px-3 py-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search messages..."
                        value={msgSearch}
                        onChange={e => setMsgSearch(e.target.value)}
                        className="h-8 text-sm pl-8"
                        autoFocus
                      />
                      {msgSearch && (
                        <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setMsgSearch("")}>
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    {msgSearch && <p className="text-[10px] text-muted-foreground mt-1">{filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}</p>}
                  </div>
                )}

                <div className="flex-1 overflow-auto p-4 space-y-1 scrollbar-thin">
                  {filteredMessages.map((msg, idx) => {
                    const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
                    const msgDate = new Date(msg.createdAt);
                    const showDateSep = !prevMsg || !isSameDay(new Date(prevMsg.createdAt), msgDate);
                    const dateSepLabel = isToday(msgDate) ? "Today" : isYesterday(msgDate) ? "Yesterday" : format(msgDate, "EEEE, MMMM d");

                    if (msg.isSystem) {
                      return (
                        <div key={msg.id}>
                          {showDateSep && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[11px] font-medium text-muted-foreground bg-card px-3 py-1 rounded-full border shadow-sm">{dateSepLabel}</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div className="flex justify-center my-2">
                            <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                              {msg.body}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    const sender = getUserById(msg.senderId);
                    const isMe = msg.senderId === currentUser.id;
                    const isStarred = msg.starredBy?.includes(currentUser.id);
                    return (
                      <div key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[11px] font-medium text-muted-foreground bg-card px-3 py-1 rounded-full border shadow-sm">{dateSepLabel}</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        <div className={`flex gap-2 py-1 ${isMe ? "flex-row-reverse" : ""} group`}>
                          {sender ? (
                            <UserHoverCard user={sender}>
                              <Avatar className="h-7 w-7 shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${sender.id}`)}>
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                                  {getUserInitials(sender.name)}
                                </AvatarFallback>
                              </Avatar>
                            </UserHoverCard>
                          ) : (
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">?</AvatarFallback>
                            </Avatar>
                          )}
                          <div className="max-w-[70%] space-y-1">
                            <div className={`rounded-xl px-3 py-2 text-sm relative ${
                              isMe ? "bg-primary text-primary-foreground" : "bg-secondary"
                            }`}>
                              {isStarred && <Star className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-warning fill-warning" />}
                              {!isMe && sender && (
                                <p className="text-xs font-semibold mb-0.5 opacity-70 cursor-pointer hover:underline"
                                  onClick={() => navigate(`/profile/${sender.id}`)}>
                                  {sender.name}
                                </p>
                              )}
                              {msg.sharedMemo ? (
                                <div className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${isMe ? 'bg-primary-foreground/10' : 'bg-background'}`}
                                  onClick={() => navigate(`/memos/${msg.sharedMemo!.memoId}`)}>
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="text-xs font-medium">{msg.sharedMemo.title}</span>
                                </div>
                              ) : (
                                <p>{msg.body}</p>
                              )}
                              <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                {format(msgDate, "h:mm a")}
                              </p>
                            </div>

                            {msg.reactions.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {msg.reactions.map(r => {
                                  const isActive = r.users.includes(currentUser.id);
                                  return (
                                    <button
                                      key={r.emoji}
                                      className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                        isActive ? 'bg-primary/10 border-primary/30' : 'bg-secondary border-transparent hover:border-border'
                                      }`}
                                      onClick={() => addReaction(msg.id, r.emoji, currentUser.id)}
                                    >
                                      {r.emoji} {r.users.length}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 ${isMe ? 'justify-end' : ''}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="text-xs p-0.5 rounded hover:bg-secondary transition-colors"
                                    onClick={() => starMessage(msg.id, currentUser.id)}
                                  >
                                    {isStarred ? <StarOff className="h-3.5 w-3.5 text-warning" /> : <Star className="h-3.5 w-3.5 text-muted-foreground" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{isStarred ? "Unstar this message" : "Star this message for quick access"}</TooltipContent>
                              </Tooltip>
                              {QUICK_EMOJIS.slice(0, 4).map(emoji => (
                                <button
                                  key={emoji}
                                  className="text-xs p-0.5 rounded hover:bg-secondary transition-colors"
                                  onClick={() => addReaction(msg.id, emoji, currentUser.id)}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-xs p-0.5 rounded hover:bg-secondary transition-colors">
                                    <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2">
                                  <div className="flex gap-1 flex-wrap max-w-[180px]">
                                    {QUICK_EMOJIS.map(emoji => (
                                      <button key={emoji} className="text-lg p-1 rounded hover:bg-secondary" onClick={() => addReaction(msg.id, emoji, currentUser.id)}>
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {convTyping.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                          {getUserById(convTyping[0]) ? getUserInitials(getUserById(convTyping[0])!.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-secondary rounded-xl px-3 py-2 flex items-center gap-1">
                        <span className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t flex gap-2">
                  <Popover open={shareOpen} onOpenChange={setShareOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Share a memo in this conversation</TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-72 p-2" align="start">
                      <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Share a memo</p>
                      <div className="space-y-1 max-h-48 overflow-auto scrollbar-thin">
                        {memos.filter(m => m.status !== 'deleted').slice(0, 10).map(m => (
                          <button
                            key={m.id}
                            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-secondary text-sm flex items-center gap-2 transition-colors"
                            onClick={() => handleShareMemo(m.id, m.title)}
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{m.title}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <MentionInput
                    value={newMessage}
                    onChange={setNewMessage}
                    placeholder="Type a message... (@ to mention)"
                    className="flex-1"
                    rows={1}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send message</TooltipContent>
                  </Tooltip>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
