"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, addDoc, collection, setDoc } from 'firebase/firestore';
import { Star, X, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId?: string;
  taskId?: string;
  missionTitle: string;
  reviewerRole?: 'requester' | 'helper';
  targetUserName?: string;
  targetUserId?: string;
  onSuccess?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  requestId,
  taskId,
  missionTitle,
  reviewerRole = 'requester',
  targetUserName,
  targetUserId,
  onSuccess
}: ReviewModalProps) {
  const { user, profile } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError('');

    const reviewData = {
      rating,
      comment: comment.trim() || 'Great experience working together!',
      reviewerId: user.uid,
      reviewerName: profile?.fullName || user.displayName || 'Neighbor',
      reviewerRole,
      createdAt: new Date().toISOString()
    };

    try {
      const updates: any = {
        review: reviewData
      };
      if (reviewerRole === 'requester') {
        updates.requesterReview = reviewData;
      } else {
        updates.helperReview = reviewData;
      }

      // 1. Update helpRequests if provided
      if (requestId) {
        await updateDoc(doc(db, 'helpRequests', requestId), updates);
      }

      // 2. Update helpTasks if provided
      if (taskId) {
        await updateDoc(doc(db, 'helpTasks', taskId), updates);
      }

      // 3. Add to global reviews collection
      await addDoc(collection(db, 'reviews'), {
        ...reviewData,
        requestId: requestId || null,
        taskId: taskId || null,
        missionTitle,
        targetUserId: targetUserId || null,
        targetUserName: targetUserName || null
      });

      // 4. Send notification to target user if known
      if (targetUserId) {
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          userId: targetUserId,
          title: 'New Feedback & Rating! ⭐',
          message: `${profile?.fullName || 'Your peer'} left you a ${rating}-star review for "${missionTitle}".`,
          read: false,
          type: 'TASK_COMPLETED',
          relatedId: requestId || taskId,
          createdAt: new Date().toISOString()
        });
      }

      setSubmitted(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-label="Close modal backdrop" 
      />

      <div 
        className="relative bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 z-10 animate-in zoom-in-95 duration-200 text-left"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Review & Community Rating</h3>
            <p className="text-[11px] text-slate-500 line-clamp-1">{missionTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center space-y-2 animate-in zoom-in-95">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Thank You for Your Feedback!</h4>
            <p className="text-[11px] text-slate-500">Your review helps strengthen trust in our local community.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {targetUserName && (
              <p className="text-xs text-slate-600">
                Rate your experience with <strong className="text-slate-900 font-semibold">{targetUserName}</strong>:
              </p>
            )}

            {/* Interactive Stars */}
            <div className="flex items-center justify-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={cn(
                        "w-6 h-6 transition-colors",
                        isFilled
                          ? "text-amber-400 fill-amber-400 drop-shadow-2xs"
                          : "text-slate-200 fill-slate-50"
                      )}
                    />
                  </button>
                );
              })}
            </div>

            <div className="text-center text-[11px] font-semibold text-amber-600">
              {rating === 5 && 'Outstanding & Prompt Assistance! 🌟'}
              {rating === 4 && 'Very Helpful & Pleasant! 👍'}
              {rating === 3 && 'Completed Satisfactorily 🙂'}
              {rating === 2 && 'Had Some Delays or Issues ⚠️'}
              {rating === 1 && 'Did Not Meet Expectations ❌'}
            </div>

            {/* Written Feedback Textarea */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-blue-600" />
                Comments / Recommendation (Optional)
              </label>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share a short note on how they helped..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-slate-900 placeholder:text-slate-400 resize-none transition-all"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="h-8 px-3 text-xs font-semibold text-slate-600 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Post Review'}
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
