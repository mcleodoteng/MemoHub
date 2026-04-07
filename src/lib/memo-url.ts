type MemoLike = {
  id: string;
  slug?: string | null;
};

export const memoPath = (memo: MemoLike): string => {
  return `/memos/${memo.slug || memo.id}`;
};
