import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { useSession } from './session';
import { supabase } from './supabase';

export type Household = { id: string; name: string; currency: string };

export type Member = {
  id: string;
  user_id: string;
  display_name: string;
  monthly_income_cents: number | null;
  sort_order: number;
};

type HouseholdState = {
  household: Household | null;
  members: Member[];
  me: Member | null;
  partner: Member | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setHousehold(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    setError(null);
    // One household per person for now. The schema allows more later.
    const mine = await supabase
      .from('members')
      .select('household_id, households (id, name, currency)')
      .eq('user_id', userId)
      .order('joined_at')
      .limit(1)
      .maybeSingle();
    if (mine.error) {
      setError(mine.error.message);
      setLoading(false);
      return;
    }
    const found = (mine.data?.households ?? null) as unknown as Household | null;
    setHousehold(found);
    if (found) {
      const all = await supabase
        .from('members')
        .select('id, user_id, display_name, monthly_income_cents, sort_order')
        .eq('household_id', found.id)
        .order('sort_order');
      if (all.error) setError(all.error.message);
      setMembers((all.data ?? []) as Member[]);
    } else {
      setMembers([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Pick up the partner joining (or renaming) without a reload.
  const householdId = household?.id;
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`members:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${householdId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, refresh]);

  const me = members.find((m) => m.user_id === userId) ?? null;
  const partner = members.find((m) => m.user_id !== userId) ?? null;

  return (
    <HouseholdContext.Provider
      value={{ household, members, me, partner, loading, error, refresh }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('useHousehold must be used inside HouseholdProvider');
  return value;
}
