import { useEffect, useRef } from 'react';

import { supabase } from './supabase';

/**
 * Calls `onChange` whenever either partner changes one of these tables in
 * this household, so both phones stay in step without pulling to refresh.
 */
export function useLiveChanges(
  householdId: string | undefined,
  tables: string[],
  onChange: () => void,
) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const key = tables.join(',');

  useEffect(() => {
    if (!householdId) return;
    let channel = supabase.channel(`live:${householdId}:${key}:${Math.random()}`);
    for (const table of key.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        () => callback.current(),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, key]);
}
