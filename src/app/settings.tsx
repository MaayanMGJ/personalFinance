import { useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Card, Chip, ChipRow, ErrorText, Field, Heading, Screen } from '@/components/ui';
import { active, useCatalog } from '@/lib/catalog';
import { useHousehold } from '@/lib/household';
import { formatMoney, parseMoney, type SplitKind } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { space, type } from '@/theme';

export default function Settings() {
  return (
    <Screen underHeader>
      <Incomes />
      <SplitRules />
      <Categories />
      <Button title="Sign out" variant="link" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

function Incomes() {
  const { members, me, household, refresh } = useHousehold();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m) => [m.id, m.monthly_income_cents == null ? '' : String(m.monthly_income_cents / 100)]),
    ),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    for (const m of members) {
      const raw = values[m.id]?.trim() ?? '';
      const cents = raw === '' ? null : parseMoney(raw);
      if (raw !== '' && cents === null) {
        setError(`"${raw}" isn't an amount`);
        return;
      }
      const { error } = await supabase.from('members').update({ monthly_income_cents: cents }).eq('id', m.id);
      if (error) {
        setError(error.message);
        return;
      }
    }
    await refresh();
    setSaved(true);
  }

  return (
    <Card>
      <Heading>Monthly income</Heading>
      <Body muted>Used by “by income” splits. Only the two of you can see it.</Body>
      {members.map((m) => (
        <Field
          key={m.id}
          label={m.id === me?.id ? 'You' : m.display_name}
          value={values[m.id] ?? ''}
          onChangeText={(v) => {
            setSaved(false);
            setValues({ ...values, [m.id]: v });
          }}
          keyboardType="decimal-pad"
          placeholder={formatMoney(500_000, household?.currency, { compact: true })}
        />
      ))}
      <ErrorText>{error}</ErrorText>
      <Button title={saved ? 'Saved' : 'Save incomes'} variant="secondary" onPress={save} disabled={saved} />
    </Card>
  );
}

function SplitRules() {
  const { household, members, me } = useHousehold();
  const { rules, defaultRuleId, refresh } = useCatalog();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SplitKind>('custom');
  const [myPercent, setMyPercent] = useState('60');
  const [error, setError] = useState<string | null>(null);

  async function makeDefault(id: string) {
    await supabase.from('households').update({ default_split_rule_id: id }).eq('id', household!.id);
    refresh();
  }

  async function archive(id: string) {
    await supabase.from('split_rules').update({ archived_at: new Date().toISOString() }).eq('id', id);
    refresh();
  }

  async function add() {
    setError(null);
    const percent = Number(myPercent);
    if (kind === 'custom' && !(percent >= 0 && percent <= 100)) {
      setError('Pick a percentage from 0 to 100');
      return;
    }
    const { data, error } = await supabase
      .from('split_rules')
      .insert({ household_id: household!.id, name: name.trim(), kind, sort_order: rules.length })
      .select('id')
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    if (kind === 'custom') {
      const weights = members.map((m) => ({
        split_rule_id: data.id,
        member_id: m.id,
        weight: m.id === me?.id ? percent : (100 - percent) / Math.max(members.length - 1, 1),
      }));
      const res = await supabase.from('split_rule_weights').insert(weights);
      if (res.error) {
        setError(res.error.message);
        return;
      }
    }
    setAdding(false);
    setName('');
    refresh();
  }

  const describe = (r: (typeof rules)[number]) => {
    if (r.kind === 'equal') return 'Even split';
    if (r.kind === 'income') return 'By income';
    return members
      .map((m) => {
        const w = r.split_rule_weights.find((x) => x.member_id === m.id)?.weight ?? 0;
        return `${m.id === me?.id ? 'You' : m.display_name} ${Math.round(w)}%`;
      })
      .join(' · ');
  };

  return (
    <Card>
      <Heading>Split rules</Heading>
      <Body muted>The default is picked for every new expense. You can change it on any expense.</Body>
      {active(rules).map((r) => (
        <View key={r.id} style={{ gap: space.xs, paddingVertical: space.xs }}>
          <Text style={type.body}>
            {r.name}
            {r.id === defaultRuleId ? '  ·  default' : ''}
          </Text>
          <Text style={type.small}>{describe(r)}</Text>
          {r.id !== defaultRuleId && (
            <ChipRow>
              <Chip label="Make default" onPress={() => makeDefault(r.id)} />
              <Chip label="Remove" onPress={() => archive(r.id)} />
            </ChipRow>
          )}
        </View>
      ))}

      {adding ? (
        <>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Rent split" />
          <ChipRow label="How">
            <Chip label="Even" selected={kind === 'equal'} onPress={() => setKind('equal')} />
            <Chip label="By income" selected={kind === 'income'} onPress={() => setKind('income')} />
            <Chip label="Custom %" selected={kind === 'custom'} onPress={() => setKind('custom')} />
          </ChipRow>
          {kind === 'custom' && (
            <Field
              label="Your share (%)"
              value={myPercent}
              onChangeText={setMyPercent}
              keyboardType="number-pad"
            />
          )}
          <ErrorText>{error}</ErrorText>
          <Button title="Add rule" onPress={add} disabled={!name.trim()} />
          <Button title="Cancel" variant="link" onPress={() => setAdding(false)} />
        </>
      ) : (
        <Button title="New split rule" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </Card>
  );
}

function Categories() {
  const { household } = useHousehold();
  const { categories, refresh } = useCatalog();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    const { error } = await supabase.from('categories').insert({
      household_id: household!.id,
      name: name.trim(),
      emoji: emoji.trim() || null,
      sort_order: categories.length,
    });
    if (error) setError(error.message);
    else {
      setName('');
      setEmoji('');
      refresh();
    }
  }

  async function archive(id: string) {
    await supabase.from('categories').update({ archived_at: new Date().toISOString() }).eq('id', id);
    setSelected(null);
    refresh();
  }

  return (
    <Card>
      <Heading>Categories</Heading>
      <ChipRow>
        {active(categories).map((c) => (
          <Chip
            key={c.id}
            label={`${c.emoji ?? ''} ${c.name}`.trim()}
            selected={c.id === selected}
            onPress={() => setSelected(c.id === selected ? null : c.id)}
          />
        ))}
      </ChipRow>
      {selected && (
        <Button
          title={`Remove ${categories.find((c) => c.id === selected)?.name ?? ''}`}
          variant="link"
          onPress={() => archive(selected)}
        />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ width: 80 }}>
          <Field label="Emoji" value={emoji} onChangeText={setEmoji} placeholder="🐶" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="New category" value={name} onChangeText={setName} placeholder="Pets" />
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Add category" variant="secondary" onPress={add} disabled={!name.trim()} />
    </Card>
  );
}
