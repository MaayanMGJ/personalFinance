import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Platform, Text, TextInput, View } from 'react-native';

import { active, useCatalog, type Account } from '@/lib/catalog';
import { localDate, saveExpense, uploadReceipt, type Expense } from '@/lib/expenses';
import { useHousehold, type Member } from '@/lib/household';
import { formatMoney, parseMoney } from '@/lib/money';
import { choiceFor, sharesFor, type SplitChoice } from '@/lib/splits';
import { colors, radius, space, type } from '@/theme';

import { Button, Chip, ChipRow, ErrorText, Field } from './ui';

export function accountLabel(account: Account, me: Member | null, members: Member[]): string {
  if (account.kind === 'joint') return account.name;
  if (account.owner_member_id === me?.id) return 'My card';
  const owner = members.find((m) => m.id === account.owner_member_id);
  return owner ? `${owner.display_name}'s card` : account.name;
}

export function ExpenseForm({ existing }: { existing?: Expense }) {
  const { household, members, me } = useHousehold();
  const { accounts, categories, rules, defaultRuleId } = useCatalog();

  const myCard = accounts.find((a) => a.kind === 'personal' && a.owner_member_id === me?.id);
  const [amount, setAmount] = useState(existing ? (existing.amount_cents / 100).toFixed(2) : '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [pickedAccountId, setAccountId] = useState(existing?.paid_from_account_id ?? null);
  const [pickedChoice, setChoice] = useState<SplitChoice | null>(
    existing ? choiceFor(existing, defaultRuleId) : null,
  );
  // Defaults fill in once the household's lists have loaded.
  const accountId = pickedAccountId ?? myCard?.id ?? null;
  const choice: SplitChoice | null =
    pickedChoice ?? (defaultRuleId ? { kind: 'rule', ruleId: defaultRuleId } : null);
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? null);
  const [spentOn, setSpentOn] = useState(existing?.spent_on ?? localDate());
  const [note, setNote] = useState(existing?.note ?? '');
  const [receiptPath, setReceiptPath] = useState(existing?.receipt_path ?? null);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = parseMoney(amount);

  const preview = useMemo(() => {
    if (!amountCents || !choice) return null;
    try {
      return sharesFor(amountCents, choice, members, rules);
    } catch (e) {
      return (e as Error).message;
    }
  }, [amountCents, choice, members, rules]);

  async function pickPhoto(source: 'camera' | 'library') {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, exif: false };
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera access is off. You can turn it on in Settings.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setNewPhoto(result.assets[0].uri);
  }

  async function save() {
    if (!household || !amountCents || !accountId || !choice || typeof preview !== 'object' || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const path = newPhoto ? await uploadReceipt(household.id, newPhoto) : receiptPath;
      await saveExpense({
        id: existing?.id,
        householdId: household.id,
        title: title.trim() || categories.find((c) => c.id === categoryId)?.name || 'Expense',
        amountCents,
        paidFromAccountId: accountId,
        shares: preview,
        spentOn,
        categoryId,
        splitRuleId: choice.kind === 'rule' ? choice.ruleId : null,
        note: note.trim() || null,
        receiptPath: path,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const sameChoice = (c: SplitChoice) =>
    !!choice &&
    c.kind === choice.kind &&
    (c.kind === 'rule' ? c.ruleId === (choice as typeof c).ruleId : c.memberId === (choice as typeof c).memberId);

  const photo = newPhoto ?? null;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[type.big, { color: colors.muted }]}>$</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={colors.border}
          keyboardType="decimal-pad"
          autoFocus={!existing}
          style={[type.big, { minWidth: 120, textAlign: 'center' }]}
          accessibilityLabel="Amount"
        />
      </View>

      <Field label="What was it?" value={title} onChangeText={setTitle} placeholder="Groceries at Trader Joe's" />

      <ChipRow label="Paid from">
        {active(accounts).map((a) => (
          <Chip
            key={a.id}
            label={accountLabel(a, me, members)}
            selected={a.id === accountId}
            onPress={() => setAccountId(a.id)}
          />
        ))}
      </ChipRow>

      <ChipRow label="Who it's for">
        {active(rules).map((r) => {
          const c: SplitChoice = { kind: 'rule', ruleId: r.id };
          return <Chip key={r.id} label={`Both · ${r.name}`} selected={sameChoice(c)} onPress={() => setChoice(c)} />;
        })}
        {members.map((m) => {
          const c: SplitChoice = { kind: 'member', memberId: m.id };
          const label = m.id === me?.id ? 'Just me' : `Just ${m.display_name}`;
          return <Chip key={m.id} label={label} selected={sameChoice(c)} onPress={() => setChoice(c)} />;
        })}
      </ChipRow>
      {typeof preview === 'string' ? (
        <ErrorText>{preview}</ErrorText>
      ) : (
        preview && (
          <Text style={type.small}>
            {preview
              .map((s) => {
                const m = members.find((x) => x.id === s.member_id);
                const who = m?.id === me?.id ? 'You' : m?.display_name;
                return `${who} ${formatMoney(s.amount_cents, household?.currency)}`;
              })
              .join('  ·  ')}
          </Text>
        )
      )}

      <ChipRow label="Category">
        {active(categories).map((c) => (
          <Chip
            key={c.id}
            label={`${c.emoji ?? ''} ${c.name}`.trim()}
            selected={c.id === categoryId}
            onPress={() => setCategoryId(c.id === categoryId ? null : c.id)}
          />
        ))}
      </ChipRow>

      <ChipRow label="When">
        <Chip label="Today" selected={spentOn === localDate()} onPress={() => setSpentOn(localDate())} />
        <Chip label="Yesterday" selected={spentOn === localDate(-1)} onPress={() => setSpentOn(localDate(-1))} />
      </ChipRow>
      <Field
        label="Date (YYYY-MM-DD)"
        value={spentOn}
        onChangeText={setSpentOn}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />

      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />

      <ChipRow label="Receipt">
        {Platform.OS !== 'web' && <Chip label="📷 Take photo" onPress={() => pickPhoto('camera')} />}
        <Chip label="🖼️ Choose photo" onPress={() => pickPhoto('library')} />
        {(photo || receiptPath) && (
          <Chip
            label="Remove"
            onPress={() => {
              setNewPhoto(null);
              setReceiptPath(null);
            }}
          />
        )}
      </ChipRow>
      {photo ? (
        <Image source={{ uri: photo }} style={{ height: 180, borderRadius: radius.md }} resizeMode="cover" />
      ) : (
        receiptPath && <Text style={type.small}>Receipt attached</Text>
      )}

      <ErrorText>{error}</ErrorText>
      <Button
        title={existing ? 'Save changes' : 'Add expense'}
        onPress={save}
        loading={busy}
        disabled={!amountCents || !accountId || typeof preview !== 'object' || !preview || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)}
      />
    </View>
  );
}
