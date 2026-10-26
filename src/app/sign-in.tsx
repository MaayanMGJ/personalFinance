import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';

// Email and password. Works without sending any email as long as
// "Confirm email" is off in Supabase (Authentication > Sign In / Providers).
export default function SignIn() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const credentials = { email: email.trim(), password };
    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp(credentials);
      if (error) setError(error.message);
      else if (!data.session) {
        setNotice('Check your email to confirm your account, then sign in here.');
        setMode('sign-in');
      }
    }
    setBusy(false);
    // On success the session listener moves us on.
  }

  const ready = email.includes('@') && password.length >= 6;

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Title>Money, together.</Title>
      <Body muted>
        {mode === 'sign-in'
          ? 'Shared expenses for the two of you. Sign in to continue.'
          : 'Create your account. Your partner makes their own and joins you with a code.'}
      </Body>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        placeholder="At least 6 characters"
        onSubmitEditing={() => ready && submit()}
      />

      <ErrorText>{error}</ErrorText>
      {notice && <Body>{notice}</Body>}
      <Button
        title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
        onPress={submit}
        loading={busy}
        disabled={!ready}
      />
      <Button
        title={mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        variant="link"
        onPress={() => {
          setError(null);
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
        }}
      />
    </Screen>
  );
}
