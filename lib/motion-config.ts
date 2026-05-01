export const springs = {
  soft: { type: "spring", stiffness: 100, damping: 20 } as const,
  snappy: { type: "spring", stiffness: 220, damping: 24 } as const,
  overshoot: { type: "spring", stiffness: 200, damping: 14 } as const,
} as const;

export const easings = {
  elegant: [0.16, 1, 0.3, 1] as const,
  overshoot: [0.34, 1.56, 0.64, 1] as const,
};
