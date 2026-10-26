import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { accountLabel } from '@/components/ExpenseForm';
import { Body, Button, Card, ErrorText, Heading, Screen } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { deleteExpense, friendlyDate, getExpense, receiptUrl, type Expense } from '@/lib/expenses';
import { useHousehold } from '@/lib/household';
import { useLiveChanges } from '@/lib/live';
import { formatMoney } from '@/lib/money';
import { radius, space, type } from '@/theme';

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, members, me } = useHousehold();
  const { accounts, categories, rules } = useCatalog();
  const [expense, setExpense] = useState<Expense | null | undefined>(undefined);
  const [photo, setPhoto] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const e = await getExpense(id).catch(() => null);
    setExpense(e);
    setPhoto(e?.receipt_path ? await receiptUrl(e.receipt_path) : null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useLiveChanges(household?.id, ['expenses'], load);

  if (expense === undefined) return <Screen underHeader>{null}</Screen>;
  if (expense === null) {
    return (
      <Screen underHeader>
        <Body muted>This expense was deleted.</Body>
      </Screen>
    );
  }

  const currency = household?.currency;
  const category = categories.find((c) => c.id === expense.category_id);
  const account = accounts.find((a) => a.id === expense.paid_from_account_id);
  const rule = rules.find((r) => r.id === expense.split_rule_id);

  async function remove() {
    try {
      await deleteExpense(expense!.id);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen underHeader>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <Text style={{ fontSize: 40 }}>{category?.emoji ?? '✨'}</Text>
        <Text style={type.big}>{formatMoney(expense.amount_cents, currency)}</Text>
        <Heading>{expense.title}</Heading>
        <Body muted>
          {friendlyDate(expense.spent_on)}
          {category ? ` · ${category.name}` : ''}
        </Body>
      </View>

      <Card>
        <Body>Paid from {account ? accountLabel(account, me, members) : 'an old account'}</Body>
        <Body muted>{rule ? `Split ${rule.name}` : 'Not split'}</Body>
        {members.map((m) => {
          const share = expense.expense_shares.find((s) => s.member_id === m.id)?.amount_cents ?? 0;
          return (
            <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Body>{m.id === me?.id ? 'You' : m.display_name}</Body>
              <Body>{formatMoney(share, currency)}</Body>
            </View>
          );
        })}
      </Card>

      {expense.note && (
        <Card>
          <Body>{expense.note}</Body>
        </Card>
      )}

      {photo && (
        <Image source={{ uri: photo }} style={{ height: 360, borderRadius: radius.md }} resizeMode="contain" />
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Edit" onPress={() => router.push(`/expense/${expense.id}/edit`)} />
      {confirming ? (
        <>
          <Body muted>Delete this expense for both of you?</Body>
          <Button title="Yes, delete it" variant="secondary" onPress={remove} />
          <Button title="Keep it" variant="link" onPress={() => setConfirming(false)} />
        </>
      ) : (
        <Button title="Delete" variant="link" onPress={() => setConfirming(true)} />
      )}
    </Screen>
  );
}
