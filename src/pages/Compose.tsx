import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { users, tags, currentUser } from "@/data/mock";
import { useState } from "react";
import { Globe, Lock, Shield, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Compose = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<string>("public");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const otherUsers = users.filter((u) => u.id !== currentUser.id);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Please fill in title and body");
      return;
    }
    toast.success("Memo sent successfully!");
    navigate("/memos");
  };

  const visIcons = { public: Globe, private: Lock, protected: Shield };
  const VisIcon = visIcons[visibility as keyof typeof visIcons] || Globe;

  return (
    <AppLayout title="Compose Memo">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="widget-card space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              placeholder="Enter memo title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-display text-lg"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Visibility</label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="w-48">
                <div className="flex items-center gap-2">
                  <VisIcon className="h-4 w-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Public</span>
                </SelectItem>
                <SelectItem value="private">
                  <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Private</span>
                </SelectItem>
                <SelectItem value="protected">
                  <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Protected</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Recipients</label>
            <div className="flex flex-wrap gap-2">
              {otherUsers.map((user) => (
                <Badge
                  key={user.id}
                  variant={selectedRecipients.includes(user.id) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleRecipient(user.id)}
                >
                  {user.name}
                  {selectedRecipients.includes(user.id) && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? "default" : "secondary"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <Textarea
              placeholder="Write your memo content..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" className="gap-2">
              <Paperclip className="h-4 w-4" />
              Attach File
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => navigate("/memos")}>
              Cancel
            </Button>
            <Button onClick={handleSend} className="gap-2">
              <Send className="h-4 w-4" />
              Send Memo
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Compose;
