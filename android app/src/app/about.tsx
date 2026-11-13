import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Button } from '../components';
import { message } from '../data';
import { POLICY_DATE, PRIVACY_URL, SUPPORT_EMAIL, privacySections } from '../privacy';
import { styles } from '../theme';

export default function About() {
  const [error, setError] = useState('');
  async function open(url: string) {
    setError('');
    try {
      await Linking.openURL(url);
    } catch (cause) {
      setError(`Could not open the link: ${message(cause)}. Contact ${SUPPORT_EMAIL}.`);
    }
  }
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Privacy & support</Text>
    <Text style={styles.muted}>Stock Atlas 1.0.0 | Effective {POLICY_DATE}</Text>
    {privacySections.map(section => <View key={section.title} style={styles.card}>
      <Text style={styles.heading}>{section.title}</Text>
      <Text style={styles.text}>{section.text}</Text>
    </View>)}
    <Text selectable style={styles.text}>{SUPPORT_EMAIL}</Text>
    <Button label="Email support" onPress={() => void open(`mailto:${SUPPORT_EMAIL}`)} />
    <Button label="Online privacy policy" onPress={() => void open(PRIVACY_URL)} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.muted}>For research only. Quotes may be delayed. No investment advice, trade execution or promise of returns. Company and fund names identify data sources; no affiliation or endorsement is implied.</Text>
    <Text style={styles.heading}>Open-source attribution</Text>
    <Text style={styles.muted}>Built with Expo, React and React Native. The Expo starter is Copyright (c) 2015-present 650 Industries, Inc. (aka Expo), under the MIT License. Copyright and license notices for bundled dependencies are retained in the distributed application.</Text>
  </ScrollView>;
}
