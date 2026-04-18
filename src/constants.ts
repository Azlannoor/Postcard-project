export type PoseCategory = 'Casual' | 'Couple' | 'Professional' | 'Streetwear';

export interface PoseReference {
  id: string;
  name: string;
  category: PoseCategory;
  image: string; // URL
  skeleton: any; // We might define a specific shape or just use the image
}

export const POSE_CATEGORIES: PoseCategory[] = ['Casual', 'Couple', 'Professional', 'Streetwear'];

export const SAMPLE_POSES: PoseReference[] = [
  {
    id: 'casual-1',
    name: 'Natural Relaxed',
    category: 'Casual',
    image: 'https://picsum.photos/seed/pose1/400/600',
    skeleton: null
  },
  {
    id: 'casual-2',
    name: 'Walking Forward',
    category: 'Casual',
    image: 'https://picsum.photos/seed/pose2/400/600',
    skeleton: null
  },
  {
    id: 'prof-1',
    name: 'Confident Lead',
    category: 'Professional',
    image: 'https://picsum.photos/seed/pose3/400/600',
    skeleton: null
  },
  {
    id: 'couple-1',
    name: 'Romantic Stroll',
    category: 'Couple',
    image: 'https://picsum.photos/seed/pose4/400/600',
    skeleton: null
  },
  {
    id: 'street-1',
    name: 'Urban Lean',
    category: 'Streetwear',
    image: 'https://picsum.photos/seed/pose5/400/600',
    skeleton: null
  }
];
