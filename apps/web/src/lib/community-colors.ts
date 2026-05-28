export const COMMUNITY_GRADIENTS = [
  'linear-gradient(135deg,#E8593C,#F4845A)',
  'linear-gradient(135deg,#5C7F6A,#7BA390)',
  'linear-gradient(135deg,#6366F1,#8B5CF6)',
  'linear-gradient(135deg,#0EA5E9,#38BDF8)',
  'linear-gradient(135deg,#F59E0B,#FCD34D)',
  'linear-gradient(135deg,#10B981,#34D399)',
  'linear-gradient(135deg,#EC4899,#F472B6)',
  'linear-gradient(135deg,#8B5CF6,#C084FC)',
] as const

export const GRADIENT_LABELS = [
  'Mercan', 'Orman', 'Mor', 'Mavi', 'Sarı', 'Yeşil', 'Pembe', 'Lila',
] as const

export function communityGradient(colorIndex: number): string {
  return COMMUNITY_GRADIENTS[colorIndex % COMMUNITY_GRADIENTS.length]!
}
