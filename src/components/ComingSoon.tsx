import { Text } from 'react-native';

import { Body, Card, Screen, Title } from './ui';

export function ComingSoon({ title, emoji, blurb }: { title: string; emoji: string; blurb: string }) {
  return (
    <Screen>
      <Title>{title}</Title>
      <Card>
        <Text style={{ fontSize: 40 }}>{emoji}</Text>
        <Body muted>{blurb}</Body>
      </Card>
    </Screen>
  );
}
