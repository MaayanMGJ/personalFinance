import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, Text } from 'react-native';

import { Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export default function Invite() {
  const { household, me, partner } = useHousehold();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const householdId = household?.id;
  const hasPartner = !!partner;
  useEffect(() => {
    if (!householdId || hasPartner) return;
    supabase.rpc('create_invite', { p_household_id: householdId }).then(({ data, error }) => {
      if (error) setError(error.message);
      else setCode(data as string);
    });
  }, [householdId, hasPartner]);

  if (partner) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Title>{partner.display_name} is in! 🎉</Title>
        <Body muted>Everything you add now shows up for both of you.</Body>
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Title>Invite your partner</Title>
      <Body muted>
        They download the app, sign in, tap “I have a code” and enter this. The code works once and
        lasts 7 days.
      </Body>
      <Card tone="warm">
        {code ? (
          <Text
            selectable
            style={{ fontSize: 44, fontWeight: '800', letterSpacing: 8, textAlign: 'center', color: colors.text }}>
            {code}
          </Text>
        ) : (
          !error && <ActivityIndicator color={colors.primary} />
        )}
      </Card>
      <ErrorText>{error}</ErrorText>
      {code && (
        <Button
          title="Send it"
          onPress={() =>
            Share.share({
              message: `${me?.display_name ?? 'I'} invited you to share expenses with them. Sign in and use code ${code}.`,
            })
          }
        />
      )}
      <Button title="Later" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
