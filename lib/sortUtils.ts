/**
 * Utility for sorting items by status priority and scheduled delivery date/time.
 * 
 * Hierarchy:
 * 1. Newly added / Open requests (OPEN, OFFER_RECEIVED) -> Top / First
 * 2. In-progress tasks (IN_PROGRESS, SCHEDULED, ACCEPTED) -> Middle / Second
 * 3. Completed tasks (COMPLETED, CANCELLED) -> Bottom / Last
 * 
 * Within each status group, items are sorted by latest scheduled delivery date & time (descending).
 * Falls back to createdAt or 0 if date/time are missing.
 */

export function getStatusPriority(status?: string): number {
  if (!status) return 1;
  const upper = status.toUpperCase();
  if (upper === 'OPEN' || upper === 'OFFER_RECEIVED') {
    return 1; // 1. Puthiya add cheythath (New / Open)
  }
  if (upper === 'IN_PROGRESS' || upper === 'SCHEDULED' || upper === 'ACCEPTED') {
    return 2; // 2. Progress-il ullath (In-progress)
  }
  if (upper === 'COMPLETED' || upper === 'CANCELLED') {
    return 3; // 3. Complete aayath (Completed / Avasanam)
  }
  return 1;
}

export function getScheduledTimestamp(item: {
  date?: string;
  startTime?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  createdAt?: string;
}): number {
  const d = item.date || item.scheduledDate;
  const t = item.startTime || item.scheduledTime;
  if (d) {
    // If time is provided, combine 'YYYY-MM-DDTHH:mm'
    const dateTimeStr = t ? `${d}T${t}` : d;
    const time = new Date(dateTimeStr).getTime();
    if (!isNaN(time)) return time;
  }
  if (item.createdAt) {
    const time = new Date(item.createdAt).getTime();
    if (!isNaN(time)) return time;
  }
  return 0;
}

export function sortByLatestScheduled<T extends {
  status?: string;
  date?: string;
  startTime?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  createdAt?: string;
}>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const priorityA = getStatusPriority(a.status);
    const priorityB = getStatusPriority(b.status);
    
    // Status ranking first
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Within same status group: latest scheduled delivery date & time first (descending)
    return getScheduledTimestamp(b) - getScheduledTimestamp(a);
  });
}
