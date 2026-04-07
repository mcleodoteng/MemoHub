import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Tag, TagCategory } from "@/types";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface TagContextType {
  tags: Tag[];
  categories: TagCategory[];
  isLoading: boolean;
  refreshTags: () => Promise<void>;
}

const TagContext = createContext<TagContextType | undefined>(undefined);

export function TagProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshTags = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest<{ tags: Tag[]; categories?: string[] }>(
        "/tags",
      );
      const loadedTags = response.data.tags || [];
      const loadedCategories = (response.data.categories || [])
        .filter(Boolean)
        .map((name, index) => ({ id: `category-${index}-${name}`, name }));

      setTags(loadedTags);
      setCategories(loadedCategories);
    } catch (error) {
      console.error("Failed to load tags:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setTags([]);
      setCategories([]);
      return;
    }

    void refreshTags();
  }, [isAuthenticated, refreshTags]);

  const value = useMemo(
    () => ({
      tags,
      categories,
      isLoading,
      refreshTags,
    }),
    [tags, categories, isLoading, refreshTags],
  );

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
}

export function useTags() {
  const context = useContext(TagContext);
  if (!context) throw new Error("useTags must be used within TagProvider");
  return context;
}
