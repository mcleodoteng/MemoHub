import { AppLayout } from "@/components/layout/AppLayout";
import { useTemplates } from "@/context/TemplateContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Edit3, Trash2, LayoutTemplate, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const Templates = () => {
  const { currentUser } = useAuth();
  const { templates, editTemplate, deleteTemplate } = useTemplates();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{
    name: string;
    description: string;
    title: string;
    body: string;
    tags: string[];
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // Filter to only show user's custom templates
  const userTemplates = templates.filter(
    (t) => !t.isBuiltIn && t.createdBy === currentUser?.id,
  );

  const handleEdit = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setEditingId(templateId);
      setEditingData({
        name: tpl.name,
        description: tpl.description || "",
        title: tpl.title,
        body: tpl.body,
        tags: Array.isArray(tpl.tags) ? tpl.tags : [],
      });
      setTagInput("");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingData) return;

    if (!editingData.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (!editingData.title.trim()) {
      toast.error("Template title is required");
      return;
    }

    if (!editingData.body.trim()) {
      toast.error("Template body is required");
      return;
    }

    try {
      setIsSaving(true);
      await editTemplate(editingId, editingData);
      setEditingId(null);
      setEditingData(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (templateId: string) => {
    setTemplateToDelete(templateId);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;

    try {
      setIsDeleting(true);
      await deleteTemplate(templateToDelete);
      setTemplateToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && editingData) {
      if (!editingData.tags.includes(tagInput.trim())) {
        setEditingData((prev) =>
          prev ? { ...prev, tags: [...prev.tags, tagInput.trim()] } : null,
        );
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    if (editingData) {
      setEditingData((prev) =>
        prev ? { ...prev, tags: prev.tags.filter((t) => t !== tag) } : null,
      );
    }
  };

  return (
    <AppLayout title="Memo Templates">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage your custom memo templates {userTemplates.length > 0 && `(${userTemplates.length})`}
          </p>
        </div>

        {userTemplates.length === 0 ? (
          <div className="widget-card text-center py-12">
            <LayoutTemplate className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              No custom templates yet. Create your first template from the
              <span className="font-semibold"> Compose </span>
              page by clicking <span className="font-semibold">"Save as Template"</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {userTemplates.map((template) => (
              <div
                key={template.id}
                className="widget-card p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">
                      {template.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 capitalize"
                    >
                      {template.visibility}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {template.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  {Array.isArray(template.tags) && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[9px] h-4"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(template.id)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editingId)} onOpenChange={(open) => {
        if (!open) {
          setEditingId(null);
          setEditingData(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>

          {editingData && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Name
                </label>
                <Input
                  value={editingData.name}
                  onChange={(e) =>
                    setEditingData((prev) =>
                      prev ? { ...prev, name: e.target.value } : null,
                    )
                  }
                  placeholder="Template name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Description
                </label>
                <Input
                  value={editingData.description}
                  onChange={(e) =>
                    setEditingData((prev) =>
                      prev ? { ...prev, description: e.target.value } : null,
                    )
                  }
                  placeholder="Template description"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Title
                </label>
                <Input
                  value={editingData.title}
                  onChange={(e) =>
                    setEditingData((prev) =>
                      prev ? { ...prev, title: e.target.value } : null,
                    )
                  }
                  placeholder="Memo title"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Content
                </label>
                <RichTextEditor
                  content={editingData.body}
                  onChange={(body) =>
                    setEditingData((prev) =>
                      prev ? { ...prev, body } : null,
                    )
                  }
                  placeholder="Template content"
                  minHeight="200px"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addTag())
                    }
                    placeholder="Add tag..."
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addTag}
                    className="h-8"
                    disabled={!tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                {editingData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {editingData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => removeTag(tag)}
                      >
                        {tag}
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setEditingData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(templateToDelete)}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The template will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Templates;
