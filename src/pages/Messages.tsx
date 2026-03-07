import { AppLayout } from "@/components/layout/AppLayout";
import { conversations, currentUser, getUserById, getUserInitials, messages } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

const Messages = () => {
  const [selectedConv, setSelectedConv] = useState(conversations[0]?.id || "");
  const [newMessage, setNewMessage] = useState("");

  const activeConv = conversations.find((c) => c.id === selectedConv);
  const convMessages = messages.filter((m) => m.conversationId === selectedConv);

  const getConvName = (conv: typeof conversations[0]) => {
    if (conv.name) return conv.name;
    const other = conv.participantIds.find((id) => id !== currentUser.id);
    return other ? getUserById(other)?.name || "Unknown" : "Unknown";
  };

  const getConvInitials = (conv: typeof conversations[0]) => {
    if (conv.type === "group") return conv.name?.[0] || "G";
    const other = conv.participantIds.find((id) => id !== currentUser.id);
    const user = other ? getUserById(other) : null;
    return user ? getUserInitials(user.name) : "?";
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
              {conversations.map((conv) => {
                const isUnread = conv.lastMessage && !conv.lastMessage.readBy.includes(currentUser.id);
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
                          {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false })}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                        {conv.lastMessage?.body}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
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
                    <p className="text-xs text-muted-foreground">
                      {activeConv.participantIds.length} participants
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4 scrollbar-thin">
                  {convMessages.map((msg) => {
                    const sender = getUserById(msg.senderId);
                    const isMe = msg.senderId === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                            {sender ? getUserInitials(sender.name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
                            isMe
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          {!isMe && (
                            <p className="text-xs font-semibold mb-0.5 opacity-70">
                              {sender?.name}
                            </p>
                          )}
                          <p>{msg.body}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 border-t flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && setNewMessage("")}
                  />
                  <Button size="icon" onClick={() => setNewMessage("")}>
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
