import { useState, useRef } from 'react';
import { Attachment } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Paperclip, X, FileText, Image, Film, Music,
  File, Download, Eye, Maximize2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const fileIcons: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'image/': Image,
  'video/': Film,
  'audio/': Music,
};

function getFileIcon(type: string) {
  for (const [key, icon] of Object.entries(fileIcons)) {
    if (type.startsWith(key)) return icon;
  }
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentUploaderProps {
  attachments: Attachment[];
  onAdd: (attachments: Attachment[]) => void;
  onRemove: (id: string) => void;
  compact?: boolean;
}

export function AttachmentUploader({ attachments, onAdd, onRemove, compact }: AttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      thumbnailUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    onAdd(newAttachments);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'default'}
        className="gap-2"
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
        {compact ? 'Attach' : 'Attach Files'}
      </Button>

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => {
            const Icon = getFileIcon(att.type);
            return (
              <div
                key={att.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group"
              >
                {att.thumbnailUrl ? (
                  <img
                    src={att.thumbnailUrl}
                    alt={att.name}
                    className="h-8 w-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm flex-1 truncate">{att.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(att.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemove(att.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Attachment viewer for memo detail
interface AttachmentViewerProps {
  attachments: Attachment[];
}

export function AttachmentViewer({ attachments }: AttachmentViewerProps) {
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Attachments ({attachments.length})
        </p>
        <div className="grid gap-2">
          {attachments.map(att => {
            const Icon = getFileIcon(att.type);
            const isImage = att.type.startsWith('image/');

            return (
              <div
                key={att.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50 group hover:bg-secondary/80 transition-colors"
              >
                {att.thumbnailUrl ? (
                  <img
                    src={att.thumbnailUrl}
                    alt={att.name}
                    className="h-10 w-10 rounded object-cover shrink-0 cursor-pointer"
                    onClick={() => setPreviewAtt(att)}
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                </div>
                <div className="flex gap-1">
                  {(isImage || att.type === 'application/pdf') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPreviewAtt(att)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = att.url;
                      a.download = att.name;
                      a.click();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewAtt} onOpenChange={() => setPreviewAtt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewAtt?.name}</DialogTitle>
          </DialogHeader>
          {previewAtt?.type.startsWith('image/') && (
            <img
              src={previewAtt.url}
              alt={previewAtt.name}
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
          {previewAtt?.type === 'application/pdf' && (
            <iframe
              src={previewAtt.url}
              className="w-full h-[70vh] rounded-lg"
              title={previewAtt.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
