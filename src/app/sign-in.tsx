import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';

// Email a 6-digit code, then type it in. No passwords, and no links to open
// on the right device.
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep('code');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) setError(error.message);
    // On success the session listener moves us on.
  }

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Title>Money, together.</Title>
      <Body muted>Shared expenses for the two of you. Sign in with your email to start.</Body>

      {step === 'email' ? (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            onSubmitEditing={sendCode}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Email me a code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />
        </>
      ) : (
        <>
          <Body>We sent a 6-digit code to {email.trim()}.</Body>
          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            onSubmitEditing={verify}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
          <Button title="Use a different email" variant="link" onPress={() => setStep('email')} />
        </>
      )}
    </Screen>
  );
}
