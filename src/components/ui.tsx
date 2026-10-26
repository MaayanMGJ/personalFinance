// Small set of building blocks so every screen looks like it belongs together.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, space, type } from '@/theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.screen, style]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={type.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={type.heading}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[type.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={[type.small, { color: colors.danger }]}>{children}</Text>;
}

export function Card({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warm' | 'sage' }) {
  const background = { plain: colors.surface, warm: colors.primarySoft, sage: colors.sageSoft }[tone];
  return <View style={[styles.card, { backgroundColor: background }]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'secondary' && styles.secondary,
        variant === 'link' && styles.link,
        (pressed || inactive) && { opacity: 0.6 },
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: variant === 'primary' ? colors.onPrimary : colors.primary },
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.small}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...input} />
    </View>
  );
}

export function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { padding: space.lg, flexGrow: 1 },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.md },
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  link: { minHeight: 40 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  input: {
    ...type.body,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
  },
});
