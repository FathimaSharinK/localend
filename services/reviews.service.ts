import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { TaskReview } from '../types';

export const submitTaskReview = async (params: {
  requestId?: string;
  taskId?: string;
  missionTitle: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: 'requester' | 'helper';
  rating: number;
  comment: string;
  targetUserId?: string;
}): Promise<void> => {
  const reviewData: TaskReview = {
    rating: params.rating,
    comment: params.comment.trim() || 'Great experience working together!',
    reviewerId: params.reviewerId,
    reviewerName: params.reviewerName,
    reviewerRole: params.reviewerRole,
    createdAt: new Date().toISOString()
  };

  const updates: Record<string, any> = {
    review: reviewData
  };
  if (params.reviewerRole === 'requester') {
    updates.requesterReview = reviewData;
  } else {
    updates.helperReview = reviewData;
  }

  // 1. Verify that request is completed if requestId is provided
  if (params.requestId) {
    const { getDoc } = await import('firebase/firestore');
    const reqSnap = await getDoc(doc(db, 'helpRequests', params.requestId));
    if (reqSnap.exists()) {
      const data = reqSnap.data();
      if (data.status !== 'COMPLETED') {
        throw new Error('Reviews can only be submitted once the task is marked as COMPLETED.');
      }
      if (params.reviewerRole === 'requester' && data.requesterReview) {
        throw new Error('You have already reviewed this task.');
      }
      if (params.reviewerRole === 'helper' && data.helperReview) {
        throw new Error('You have already reviewed this task.');
      }
    }
    await updateDoc(doc(db, 'helpRequests', params.requestId), updates);
  }

  // 2. Update helpTasks if provided
  if (params.taskId) {
    await updateDoc(doc(db, 'helpTasks', params.taskId), updates);
  }

  // 3. Add to global reviews collection
  await addDoc(collection(db, 'reviews'), {
    ...reviewData,
    requestId: params.requestId || null,
    taskId: params.taskId || null,
    missionTitle: params.missionTitle,
    targetUserId: params.targetUserId || null
  });

  // 4. Send notification to target user
  if (params.targetUserId) {
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      userId: params.targetUserId,
      title: 'New Feedback & Rating! ⭐',
      message: `${params.reviewerName} left you a ${params.rating}-star review for "${params.missionTitle}".`,
      read: false,
      type: 'TASK_COMPLETED',
      relatedId: params.requestId || params.taskId,
      createdAt: new Date().toISOString()
    });
  }
};
