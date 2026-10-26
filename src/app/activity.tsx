import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { ExpenseRow } from '@/components/ExpenseRow';
import { Body, Card, Chip, ChipRow, Screen } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { listExpenses, type Expense } from '@/lib/expenses';
import { useHousehold } from '@/lib/household';
import { useLiveChanges } from '@/lib/live';
import { formatMoney } from '@/lib/money';
import { space, type } from '@/theme';

type Filter = { kind: 'all' } | { kind: 'joint' } | { kind: 'member'; memberId: string };

export default function Activity() {
  const { household, members, me } = useHousehold();
  const { accounts } = useCatalog();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });

  const load = useCallback(() => {
    if (!household) return;
    listExpenses(household.id).then(setExpenses, () => setExpenses([]));
  }, [household]);

  useFocusEffect(load);
  useLiveChanges(household?.id, ['expenses'], load);

  const months = useMemo(() => {
    const ownerOf = (e: Expense) => accounts.find((a) => a.id === e.paid_from_account_id);
    const shown = (expenses ?? []).filter((e) => {
      const account = ownerOf(e);
      if (filter.kind === 'joint') return account?.kind === 'joint';
      if (filter.kind === 'member') return account?.owner_member_id === filter.memberId;
      return true;
    });
    const groups = new Map<string, Expense[]>();
    for (const e of shown) {
      const key = e.spent_on.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()];
  }, [expenses, filter, accounts]);

  return (
    <Screen underHeader>
      <ChipRow>
        <Chip label="All" selected={filter.kind === 'all'} onPress={() => setFilter({ kind: 'all' })} />
        <Chip label="Joint" selected={filter.kind === 'joint'} onPress={() => setFilter({ kind: 'joint' })} />
        {members.map((m) => (
          <Chip
            key={m.id}
            label={m.id === me?.id ? 'Paid by me' : `Paid by ${m.display_name}`}
            selected={filter.kind === 'member' && filter.memberId === m.id}
            onPress={() => setFilter({ kind: 'member', memberId: m.id })}
          />
        ))}
      </ChipRow>

      {expenses && months.length === 0 && <Body muted>Nothing here yet.</Body>}

      {months.map(([month, items]) => {
        const [y, m] = month.split('-').map(Number);
        const total = items.reduce((s, e) => s + e.amount_cents, 0);
        return (
          <Card key={month}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xs }}>
              <Text style={type.heading}>
                {new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <Text style={type.small}>{formatMoney(total, household?.currency)}</Text>
            </View>
            {items.map((e) => (
              <ExpenseRow key={e.id} expense={e} />
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}
