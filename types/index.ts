export type UserRole = 'admin' | 'employee' | 'user';
export type Department = 'Medical' | 'Groceries' | 'Electrical' | 'Plumbing' | string;
export type UserStatus = 'active' | 'inactive';

export interface DepartmentItem {
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  slaHours?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserData {
  uid: string;
  fullName: string;
  email: string;
  onboardingCompleted: boolean;
  phone?: string;
  area?: string;
  bio?: string;
  role?: UserRole;
  department?: Department;
  status?: UserStatus;
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

export interface TaskChatMessage {
  id?: string;
  requestId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  type: 'text' | 'voice';
  text?: string;
  audioData?: string; // base64 data URI
  audioDuration?: number; // duration in seconds
  createdAt: string;
}

export interface HelpRequest {
  id?: string;
  requesterId: string;
  requesterName: string;
  title: string;
  description: string;
  categoryId: Department | string;
  priority: HelpPriority;
  date: string;
  startTime: string;
  location: string;
  coordinates?: { lat: number; lng: number } | null;
  status: HelpStatus;
  selectedHelperId?: string;
  selectedHelperName?: string;
  completionCode?: string;
  isEscalated?: boolean;
  escalatedAt?: string;
  dispatchedByAdmin?: boolean;
  unreadCounts?: Record<string, number>;
  lastMessage?: string;
  lastMessageSenderId?: string;
  lastMessageAt?: string;
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
  helperDepartment?: Department;
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
  type: 'OFFER_RECEIVED' | 'OFFER_ACCEPTED' | 'TASK_COMPLETED' | 'SLA_BREACH' | 'DISPATCH_ASSIGNED' | 'CHAT_MESSAGE' | 'SYSTEM';
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
  description?: string;
  category?: Department | string;
  priority?: HelpPriority;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completionCode?: string;
  unreadCounts?: Record<string, number>;
  lastMessage?: string;
  review?: TaskReview;
  requesterReview?: TaskReview;
  helperReview?: TaskReview;
  createdAt: string;
}

