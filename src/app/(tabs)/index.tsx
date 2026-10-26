import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar, Body, Button, Card, Heading, Screen, Title } from '@/components/ui';
import { useHousehold } from '@/lib/household';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { partnerColor, space, type } from '@/theme';

export default function Home() {
  const { household, me, partner } = useHousehold();
  const [net, setNet] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!me) return;
      supabase
        .from('member_balances')
        .select('net_cents')
        .eq('member_id', me.id)
        .maybeSingle()
        .then(({ data }) => setNet(data ? Number(data.net_cents) : 0));
    }, [me]),
  );

  if (!household || !me) return null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar name={me.display_name} color={partnerColor(me.sort_order)} />
        {partner && <Avatar name={partner.display_name} color={partnerColor(partner.sort_order)} />}
        <View style={{ flex: 1 }}>
          <Title>Hi {me.display_name}</Title>
          <Body muted>{household.name}</Body>
        </View>
      </View>

      {partner ? (
        <Card tone={net === 0 ? 'sage' : 'warm'}>
          <Text style={type.big}>{net === null ? ' ' : balanceLine(net, partner.display_name, household.currency)}</Text>
          <Body muted>Settling up happens in Venmo or Zelle. That comes in an upcoming step.</Body>
        </Card>
      ) : (
        <Card tone="warm">
          <Heading>It takes two</Heading>
          <Body muted>Invite your partner so you can both add and see shared expenses.</Body>
          <Button title="Invite your partner" onPress={() => router.push('/invite')} />
        </Card>
      )}

      <Card>
        <Heading>Recent</Heading>
        <Body muted>No expenses yet. Adding expenses is the next thing we build.</Body>
      </Card>

      <Button title="Sign out" variant="link" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

function balanceLine(net: number, partnerName: string, currency: string) {
  if (net === 0) return 'All square';
  const amount = formatMoney(Math.abs(net), currency, { compact: true });
  return net > 0 ? `${partnerName} owes you ${amount}` : `You owe ${partnerName} ${amount}`;
}
