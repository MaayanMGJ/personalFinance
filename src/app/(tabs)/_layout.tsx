import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

type Icon = SymbolViewProps['name'];

const icon = (name: Icon) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={26} />;
  };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: icon({ ios: 'house.fill', android: 'home', web: 'home' }) }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: icon({ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{ title: 'List', tabBarIcon: icon({ ios: 'checklist', android: 'checklist', web: 'checklist' }) }}
      />
      <Tabs.Screen
        name="stuff"
        options={{ title: 'Our stuff', tabBarIcon: icon({ ios: 'sofa.fill', android: 'chair', web: 'chair' }) }}
      />
    </Tabs>
  );
}
