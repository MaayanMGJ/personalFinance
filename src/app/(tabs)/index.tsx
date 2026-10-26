import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ExpenseRow } from '@/components/ExpenseRow';
import { Avatar, Body, Button, Card, Heading, Screen, Title } from '@/components/ui';
import { listExpenses, type Expense } from '@/lib/expenses';
import { useHousehold } from '@/lib/household';
import { useLiveChanges } from '@/lib/live';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { colors, partnerColor, space, type } from '@/theme';

export default function Home() {
  const { household, me, partner } = useHousehold();
  const [net, setNet] = useState<number | null>(null);
  const [owedToJoint, setOwedToJoint] = useState(0);
  const [recent, setRecent] = useState<Expense[]>([]);

  const load = useCallback(() => {
    if (!me || !household) return;
    supabase
      .from('member_balances')
      .select('net_cents')
      .eq('member_id', me.id)
      .maybeSingle()
      .then(({ data }) => setNet(data ? Number(data.net_cents) : 0));
    supabase
      .from('joint_balances')
      .select('owed_cents')
      .eq('member_id', me.id)
      .maybeSingle()
      .then(({ data }) => setOwedToJoint(data ? Number(data.owed_cents) : 0));
    listExpenses(household.id, 5).then(setRecent, () => {});
  }, [me, household]);

  useFocusEffect(load);
  useLiveChanges(household?.id, ['expenses', 'settlements'], load);

  if (!household || !me) return null;
  const currency = household.currency;

  return (
    <View style={{ flex: 1 }}>
      <Screen style={{ paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Avatar name={me.display_name} color={partnerColor(me.sort_order)} />
          {partner && <Avatar name={partner.display_name} color={partnerColor(partner.sort_order)} />}
          <View style={{ flex: 1 }}>
            <Title>Hi {me.display_name}</Title>
            <Body muted>{household.name}</Body>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')}>
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </Pressable>
        </View>

        {partner ? (
          <Card tone={net === 0 ? 'sage' : 'warm'}>
            <Text style={type.big}>{net === null ? ' ' : balanceLine(net, partner.display_name, currency)}</Text>
            {owedToJoint > 0 && (
              <Body>You owe the joint account {formatMoney(owedToJoint, currency)} for personal buys.</Body>
            )}
            <Body muted>Settling up through Venmo or Zelle comes in the next step.</Body>
          </Card>
        ) : (
          <Card tone="warm">
            <Heading>It takes two</Heading>
            <Body muted>Invite your partner so you can both add and see shared expenses.</Body>
            <Button title="Invite your partner" onPress={() => router.push('/invite')} />
          </Card>
        )}

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading>Recent</Heading>
            {recent.length > 0 && <Button title="See all" variant="link" onPress={() => router.push('/activity')} />}
          </View>
          {recent.length === 0 ? (
            <Body muted>Nothing yet. Tap “Add expense” to log your first one.</Body>
          ) : (
            recent.map((e) => <ExpenseRow key={e.id} expense={e} />)
          )}
        </Card>
      </Screen>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/expense/new')}
        style={({ pressed }) => ({
          position: 'absolute',
          right: space.lg,
          bottom: space.lg,
          backgroundColor: colors.primary,
          borderRadius: 999,
          paddingHorizontal: space.lg,
          height: 56,
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
          opacity: pressed ? 0.8 : 1,
        })}>
        <Text style={{ color: colors.onPrimary, fontSize: 17, fontWeight: '700' }}>＋ Add expense</Text>
      </Pressable>
    </View>
  );
}

function balanceLine(net: number, partnerName: string, currency: string) {
  if (net === 0) return 'All square';
  const amount = formatMoney(Math.abs(net), currency, { compact: true });
  return net > 0 ? `${partnerName} owes you ${amount}` : `You owe ${partnerName} ${amount}`;
}
