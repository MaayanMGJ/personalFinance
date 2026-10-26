import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useCatalog } from '@/lib/catalog';
import { friendlyDate, type Expense } from '@/lib/expenses';
import { useHousehold } from '@/lib/household';
import { formatMoney } from '@/lib/money';
import { colors, space, type } from '@/theme';

import { accountLabel } from './ExpenseForm';

export function ExpenseRow({ expense }: { expense: Expense }) {
  const { household, members, me } = useHousehold();
  const { accounts, categories } = useCatalog();
  const category = categories.find((c) => c.id === expense.category_id);
  const account = accounts.find((a) => a.id === expense.paid_from_account_id);
  const myShare = expense.expense_shares.find((s) => s.member_id === me?.id)?.amount_cents ?? 0;

  return (
    <Pressable
      onPress={() => router.push(`/expense/${expense.id}`)}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
        pressed && { opacity: 0.6 },
      ]}>
      <Text style={{ fontSize: 26, width: 34, textAlign: 'center' }}>{category?.emoji ?? '✨'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={type.body} numberOfLines={1}>
          {expense.title}
          {expense.receipt_path ? '  🧾' : ''}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {friendlyDate(expense.spent_on)}
          {account ? ` · ${accountLabel(account, me, members)}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[type.body, { fontWeight: '600' }]}>
          {formatMoney(expense.amount_cents, household?.currency)}
        </Text>
        <Text style={[type.small, { color: myShare ? colors.muted : colors.sage }]}>
          {myShare ? `yours ${formatMoney(myShare, household?.currency)}` : 'not yours'}
        </Text>
      </View>
    </Pressable>
  );
}
