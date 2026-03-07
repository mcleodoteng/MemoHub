import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { MemoVisibility, Memo } from '@/types';
import { tags } from '@/data/mock';
import { Globe, Lock, Shield, Save } from 'lucide-react';
import { useMemos } from '@/context/MemoContext';
import { currentUser } from '@/data/mock';
import { toast } from 'sonner';

interface MemoEditDialogProps {
  memo: Memo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemoEditDialog({ memo, open, onOpenChange }: MemoEditDialogProps) {
  const { editMemo } = useMemos();
  const [title, setTitle] = useState(memo.title);
  const [body, setBody] = useState(memo.body);
  const [visibility, setVisibility] = useState<MemoVisibility>(memo.visibility);
  const [selectedTags, setSelectedTags] = useState<string[]>(memo.tags);

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]);
  };

  const handleSave = () => {
    editMemo(memo.id, { title, body, tags: selectedTags, visibility }, currentUser.id);
    toast.success('Memo updated successfully!');
    onOpenChange(false);
  };

  const visIcons = { public: Globe, private: Lock, protected: Shield };
  const VisIcon = visIcons[visibility];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Memo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="font-display" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Visibility</label>
            <Select value={visibility} onValueChange={v => setVisibility(v as MemoVisibility)}>
              <SelectTrigger className="w-48">
                <div className="flex items-center gap-2">
                  <VisIcon className="h-4 w-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Public</span></SelectItem>
                <SelectItem value="private"><span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Private</span></SelectItem>
                <SelectItem value="protected"><span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Protected</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? 'default' : 'secondary'}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <RichTextEditor content={body} onChange={setBody} placeholder="Edit memo content..." minHeight="150px" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
