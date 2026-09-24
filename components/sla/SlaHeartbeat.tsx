"use client";

import { useEffect, useRef } from 'react';

/**
 * SlaHeartbeat
 * Automatically checks for SLA breaches every 60 seconds when the app is active in any browser.
 * This guarantees that even when running locally on localhost:3000 without external cron services,
 * tasks nearing their deadline are automatically evaluated, escalated, and emails are dispatched.
 */
export default function SlaHeartbeat() {
  const isRunningRef = useRef(false);

  useEffect(() => {
    // Initial check 5 seconds after page load
    const initialTimer = setTimeout(() => {
      triggerHeartbeat();
    }, 5000);

    // Periodic check every 60 seconds
    const interval = setInterval(() => {
      triggerHeartbeat();
    }, 60000);

    async function triggerHeartbeat() {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      try {
        await fetch('/api/cron/check-sla', {
          method: 'GET',
          headers: {
            'x-heartbeat-source': 'localend-client-heartbeat'
          }
        });
      } catch (err) {
        // Silently catch network drops to avoid interrupting UI
      } finally {
        isRunningRef.current = false;
      }
    }

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return null;
}
