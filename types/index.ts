export interface UserData {
  uid: string;
  fullName: string;
  email: string;
  onboardingCompleted: boolean;
  phone?: string;
  area?: string;
  bio?: string;
  role?: 'admin' | 'user';
  coordinates?: { lat: number; lng: number } | null;
  createdAt: string;
  updatedAt?: string;
}

export type HelpPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type HelpStatus = 'OPEN' | 'OFFER_RECEIVED' | 'ACCEPTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TaskReview {
  rating: number;
  comment: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: 'requester' | 'helper';
  createdAt: string;
}

export interface HelpRequest {
  id?: string;
  requesterId: string;
  requesterName: string;
  title: string;
  description: string;
  categoryId: string;
  priority: HelpPriority;
  date: string;
  startTime: string;
  location: string;
  coordinates?: { lat: number; lng: number } | null;
  status: HelpStatus;
  selectedHelperId?: string;
  selectedHelperName?: string;
  completionCode?: string;
  review?: TaskReview;
  requesterReview?: TaskReview;
  helperReview?: TaskReview;
  createdAt: string;
  updatedAt: string;
}

export interface HelpOffer {
  id?: string;
  requestId: string;
  helperId: string;
  helperName: string;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface AppNotification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'OFFER_RECEIVED' | 'OFFER_ACCEPTED' | 'TASK_COMPLETED' | 'SYSTEM';
  relatedId?: string;
  createdAt: string;
}

export interface HelpTask {
  id?: string;
  requestId: string;
  requesterId: string;
  requesterName?: string;
  helperId: string;
  helperName?: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completionCode?: string;
  review?: TaskReview;
  requesterReview?: TaskReview;
  helperReview?: TaskReview;
  createdAt: string;
}
