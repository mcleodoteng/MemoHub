// Utility functions
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const formatDate = (date: Date) => {
  return date.toISOString();
};
