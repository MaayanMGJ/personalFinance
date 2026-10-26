import { ExpenseForm } from '@/components/ExpenseForm';
import { Screen } from '@/components/ui';

export default function NewExpense() {
  return (
    <Screen underHeader>
      <ExpenseForm />
    </Screen>
  );
}
