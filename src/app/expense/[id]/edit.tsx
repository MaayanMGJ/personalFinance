import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ExpenseForm } from '@/components/ExpenseForm';
import { Body, Screen } from '@/components/ui';
import { getExpense, type Expense } from '@/lib/expenses';

export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<Expense | null | undefined>(undefined);

  useEffect(() => {
    getExpense(id).then(setExpense, () => setExpense(null));
  }, [id]);

  return (
    <Screen underHeader>
      {expense === null && <Body muted>This expense was deleted.</Body>}
      {expense && <ExpenseForm existing={expense} />}
    </Screen>
  );
}
