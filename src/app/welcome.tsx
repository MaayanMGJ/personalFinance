import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, ErrorText, Field, Heading, Screen, Title } from '@/components/ui';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

// First run after sign-in: start a household, or join your partner's with a code.
export default function Welcome() {
  const { refresh } = useHousehold();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'start' | 'join'>('start');
  const [homeName, setHomeName] = useState('Our place');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } =
      mode === 'start'
        ? await supabase.rpc('create_household', { p_name: homeName, p_display_name: name })
        : await supabase.rpc('join_household', { p_code: code, p_display_name: name });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await refresh();
  }

  const canSubmit =
    name.trim().length > 0 && (mode === 'start' ? homeName.trim().length > 0 : code.trim().length === 6);

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Title>Welcome!</Title>
      <Field label="What should we call you?" value={name} onChangeText={setName} placeholder="Your first name" />

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Start our home" variant={mode === 'start' ? 'primary' : 'secondary'} onPress={() => setMode('start')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="I have a code" variant={mode === 'join' ? 'primary' : 'secondary'} onPress={() => setMode('join')} />
        </View>
      </View>

      <Card>
        {mode === 'start' ? (
          <>
            <Heading>Name your home</Heading>
            <Body muted>You can invite your partner right after.</Body>
            <Field label="Home name" value={homeName} onChangeText={setHomeName} />
          </>
        ) : (
          <>
            <Heading>Join your partner</Heading>
            <Body muted>Ask them for the 6-character code from their invite.</Body>
            <Field
              label="Invite code"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              placeholder="K7M2QX"
            />
          </>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title={mode === 'start' ? 'Create our home' : 'Join'} onPress={submit} loading={busy} disabled={!canSubmit} />
    </Screen>
  );
}
