import { useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabase';

interface UseRealtimeRefreshOptions {
  enabled: boolean;
  channelKey: string;
  tables: string[];
  onRefresh: () => void | Promise<void>;
  intervalMs?: number;
}

export function useRealtimeRefresh({
  enabled,
  channelKey,
  tables,
  onRefresh,
  intervalMs = 60000,
}: UseRealtimeRefreshOptions) {
  const refreshRef = useRef(onRefresh);
  const tablesKey = useMemo(() => tables.join('|'), [tables]);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !tables.length || typeof (supabase as any).channel !== 'function') {
      return;
    }

    const runRefresh = () => {
      void refreshRef.current();
    };

    const channel = tables.reduce((activeChannel, table) => {
      return activeChannel.on('postgres_changes', { event: '*', schema: 'public', table }, runRefresh);
    }, (supabase as any).channel(channelKey));

    channel.subscribe();

    const intervalId = window.setInterval(runRefresh, intervalMs);
    const handleFocus = () => runRefresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRefresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (typeof (supabase as any).removeChannel === 'function') {
        (supabase as any).removeChannel(channel);
      }
    };
  }, [channelKey, enabled, intervalMs, tables.length, tablesKey]);
}
