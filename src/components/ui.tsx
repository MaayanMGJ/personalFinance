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

export function Screen({
  children,
  style,
  underHeader,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** Set on screens that show a navigation header, which already clears the notch. */
  underHeader?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={underHeader ? ['left', 'right'] : ['top', 'left', 'right']}>
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

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
        pressed && { opacity: 0.7 },
      ]}>
      <Text style={[type.small, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      {label && <Text style={type.small}>{label}</Text>}
      <View style={styles.chipRow}>{children}</View>
    </View>
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
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
