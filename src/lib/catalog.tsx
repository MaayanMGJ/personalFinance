// The household's editable lists: accounts, categories and split rules.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { useHousehold } from './household';
import type { SplitRule } from './splits';
import { supabase } from './supabase';

export type Account = {
  id: string;
  kind: 'joint' | 'personal';
  owner_member_id: string | null;
  name: string;
  sort_order: number;
  archived_at: string | null;
};

export type Category = {
  id: string;
  name: string;
  emoji: string | null;
  sort_order: number;
  archived_at: string | null;
};

type CatalogState = {
  accounts: Account[];
  categories: Category[];
  rules: SplitRule[];
  defaultRuleId: string | null;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id;
  const [state, setState] = useState<Omit<CatalogState, 'refresh'>>({
    accounts: [],
    categories: [],
    rules: [],
    defaultRuleId: null,
  });

  const refresh = useCallback(async () => {
    if (!householdId) return;
    const [accounts, categories, rules, home] = await Promise.all([
      supabase.from('accounts').select('*').eq('household_id', householdId).order('sort_order'),
      supabase.from('categories').select('*').eq('household_id', householdId).order('sort_order'),
      supabase
        .from('split_rules')
        .select('id, name, kind, sort_order, archived_at, split_rule_weights (member_id, weight)')
        .eq('household_id', householdId)
        .order('sort_order'),
      supabase.from('households').select('default_split_rule_id').eq('id', householdId).single(),
    ]);
    setState({
      accounts: (accounts.data ?? []) as Account[],
      categories: (categories.data ?? []) as Category[],
      rules: ((rules.data ?? []) as SplitRule[]).map((r) => ({
        ...r,
        split_rule_weights: r.split_rule_weights.map((w) => ({ ...w, weight: Number(w.weight) })),
      })),
      defaultRuleId: home.data?.default_split_rule_id ?? null,
    });
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <CatalogContext.Provider value={{ ...state, refresh }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider');
  return value;
}

export const active = <T extends { archived_at: string | null }>(items: T[]) =>
  items.filter((i) => !i.archived_at);
