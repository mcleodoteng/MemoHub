import { AppLayout } from "@/components/layout/AppLayout";
import { useMessages } from "@/context/MessageContext";
import { useMemos } from "@/context/MemoContext";
import { currentUser, getUserById, getUserInitials } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Users as UsersIcon, SmilePlus, FileText, Share2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '👏', '🔥', '💡'];

const Messages = () => {
  const {
    conversations, sendMessage, addReaction, markAsRead,
    getConversationMessages, typingUsers,
  } = useMessages();
  const { memos } = useMemos();

  const [selectedConv, setSelectedConv] = useState(conversations[0]?.id || "");
  const [newMessage, setNewMessage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
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
    const other = conv.participantIds.find(id => id !== currentUser.id);
    return other ? getUserById(other)?.name || "Unknown" : "Unknown";
  };

  const getConvInitials = (conv: typeof conversations[0]) => {
    if (conv.type === "group") return conv.name?.[0] || "G";
    const other = conv.participantIds.find(id => id !== currentUser.id);
    const user = other ? getUserById(other) : null;
    return user ? getUserInitials(user.name) : "?";
  };

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessage(selectedConv, newMessage);
    setNewMessage("");
  };

  const handleShareMemo = (memoId: string, memoTitle: string) => {
    sendMessage(selectedConv, `📋 Shared memo: ${memoTitle}`, { memoId, title: memoTitle });
    setShareOpen(false);
  };

  return (
    <AppLayout title="Messages">
      <div className="max-w-5xl mx-auto">
        <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-card overflow-hidden">
          {/* Conversation List */}
          <div className="w-72 border-r flex flex-col shrink-0">
            <div className="p-3 border-b">
              <Input placeholder="Search conversations..." className="h-8 text-sm bg-secondary border-none" />
            </div>
            <div className="flex-1 overflow-auto scrollbar-thin">
              {conversations.map(conv => {
                const isUnread = conv.lastMessage && !conv.lastMessage.readBy.includes(currentUser.id);
                const typing = typingUsers[conv.id] || [];
                return (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                      selectedConv === conv.id ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                    onClick={() => setSelectedConv(conv.id)}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className={`text-xs font-semibold ${conv.type === 'group' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                        {conv.type === "group" ? <UsersIcon className="h-4 w-4" /> : getConvInitials(conv)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${isUnread ? "font-semibold" : "font-medium"}`}>
                          {getConvName(conv)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.lastMessage && formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false })}
                        </span>
                      </div>
                      {typing.length > 0 ? (
                        <p className="text-xs text-primary italic">typing...</p>
                      ) : (
                        <p className={`text-xs truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                          {conv.lastMessage?.body}
                        </p>
                      )}
                    </div>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {activeConv ? (
              <>
                <div className="p-3 border-b flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {getConvInitials(activeConv)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{getConvName(activeConv)}</p>
                    <p className="text-xs text-muted-foreground">{activeConv.participantIds.length} participants</p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-3 scrollbar-thin">
                  {convMessages.map(msg => {
                    const sender = getUserById(msg.senderId);
                    const isMe = msg.senderId === currentUser.id;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} group`}>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                            {sender ? getUserInitials(sender.name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="max-w-[70%] space-y-1">
                          <div className={`rounded-xl px-3 py-2 text-sm ${
                            isMe ? "bg-primary text-primary-foreground" : "bg-secondary"
                          }`}>
                            {!isMe && (
                              <p className="text-xs font-semibold mb-0.5 opacity-70">{sender?.name}</p>
                            )}
                            {msg.sharedMemo ? (
                              <div className={`flex items-center gap-2 p-2 rounded-lg ${isMe ? 'bg-primary-foreground/10' : 'bg-background'}`}>
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="text-xs font-medium">{msg.sharedMemo.title}</span>
                              </div>
                            ) : (
                              <p>{msg.body}</p>
                            )}
                            <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </p>
                          </div>

                          {/* Reactions */}
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

                          {/* Reaction picker (shows on hover) */}
                          <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 ${isMe ? 'justify-end' : ''}`}>
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
                    );
                  })}

                  {/* Typing indicator */}
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

                {/* Message Input */}
                <div className="p-3 border-t flex gap-2">
                  <Popover open={shareOpen} onOpenChange={setShareOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
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
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    className="flex-1"
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                  />
                  <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
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
