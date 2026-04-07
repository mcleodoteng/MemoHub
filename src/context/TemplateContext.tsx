import React, { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export interface MemoTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  body: string;
  tags: string[];
  visibility: "public" | "private" | "protected";
  isBuiltIn: boolean;
  createdBy: string;
  createdAt: string;
}

const builtInTemplates: MemoTemplate[] = [
  {
    id: "tpl-weekly",
    name: "Weekly Update",
    description: "Share progress, blockers, and plans for the week",
    title: "Weekly Update — [Date]",
    body: "<h2>✅ Completed This Week</h2><ul><li>Item 1</li><li>Item 2</li></ul><h2>🚧 In Progress</h2><ul><li>Item 1</li><li>Item 2</li></ul><h2>🔴 Blockers</h2><ul><li>None</li></ul><h2>📅 Plans for Next Week</h2><ul><li>Item 1</li></ul>",
    tags: ["Engineering"],
    visibility: "public",
    isBuiltIn: true,
    createdBy: "system",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "tpl-decision",
    name: "Decision Request",
    description: "Request approval or input on a decision",
    title: "Decision Request: [Topic]",
    body: "<h2>📋 Context</h2><p>Provide background information here.</p><h2>🔍 Options</h2><ol><li><strong>Option A:</strong> Description</li><li><strong>Option B:</strong> Description</li></ol><h2>💡 Recommendation</h2><p>State your recommended option and why.</p><h2>⏰ Decision Deadline</h2><p>[Date]</p>",
    tags: ["Request"],
    visibility: "private",
    isBuiltIn: true,
    createdBy: "system",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "tpl-announcement",
    name: "Announcement",
    description: "Broad organizational announcement",
    title: "Announcement: [Subject]",
    body: "<h2>📢 Summary</h2><p>Brief summary of the announcement.</p><h2>📝 Details</h2><p>Full details here.</p><h2>❓ Questions?</h2><p>Please reach out to [contact] for any questions.</p>",
    tags: ["Announcement"],
    visibility: "public",
    isBuiltIn: true,
    createdBy: "system",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "tpl-policy",
    name: "Policy Update",
    description: "Document a new or updated policy",
    title: "Policy Update: [Policy Name]",
    body: "<h2>📋 Policy Summary</h2><p>Brief summary of the policy change.</p><h2>🔄 What Changed</h2><ul><li>Change 1</li><li>Change 2</li></ul><h2>📅 Effective Date</h2><p>[Date]</p><h2>📞 Contact</h2><p>For questions, contact [person/department].</p>",
    tags: ["Policy"],
    visibility: "public",
    isBuiltIn: true,
    createdBy: "system",
    createdAt: "2024-01-01T00:00:00Z",
  },
];

interface TemplateContextType {
  templates: MemoTemplate[];
  addTemplate: (
    template: Omit<
      MemoTemplate,
      "id" | "createdAt" | "isBuiltIn" | "createdBy"
    >,
  ) => void;
  deleteTemplate: (id: string) => void;
  getTemplateById: (id: string) => MemoTemplate | undefined;
}

const TemplateContext = createContext<TemplateContextType | undefined>(
  undefined,
);

export function TemplateProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState<MemoTemplate[]>(builtInTemplates);

  const addTemplate = useCallback(
    (
      data: Omit<MemoTemplate, "id" | "createdAt" | "isBuiltIn" | "createdBy">,
    ) => {
      const newTemplate: MemoTemplate = {
        ...data,
        id: `tpl-${Date.now()}`,
        isBuiltIn: false,
        createdBy: currentUser?.id || "",
        createdAt: new Date().toISOString(),
      };
      setTemplates((prev) => [...prev, newTemplate]);
    },
    [currentUser?.id],
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => !(t.id === id && !t.isBuiltIn)));
  }, []);

  const getTemplateById = useCallback(
    (id: string) => {
      return templates.find((t) => t.id === id);
    },
    [templates],
  );

  return (
    <TemplateContext.Provider
      value={{ templates, addTemplate, deleteTemplate, getTemplateById }}
    >
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplates() {
  const context = useContext(TemplateContext);
  if (!context)
    throw new Error("useTemplates must be used within TemplateProvider");
  return context;
}
