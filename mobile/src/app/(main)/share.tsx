import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LoadingModal } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { earnApi } from '@/api/earn';
import { errorMessage } from '@/api/client';
import { relayClient } from '@/relay/relay-client';
import { useRelay } from '@/state/relay';
import { formatBytes } from '@/utils/format';
import type { RelayNode } from '@/types';

function statusLabel(status: string): { label: string; hint: string; color: string } {
  switch (status) {
    case 'connected':
      return { label: 'Connected', hint: 'Your device is online and available to share bandwidth.', color: '#30a46c' };
    case 'connecting':
      return { label: 'Connecting…', hint: 'Establishing a secure tunnel to the relay.', color: '#e5a000' };
    case 'error':
      return { label: 'Offline', hint: 'Connection lost. Retrying automatically.', color: '#e5484d' };
    default:
      return { label: 'Idle', hint: 'Sharing is off. Toggle below to start earning.', color: '#8d9198' };
  }
}

export default function ShareScreen() {
  const theme = useTheme();
  const { enabled, status, setEnabled, sessionBytes } = useRelay();
  const [node, setNode] = useState<RelayNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ensureNode = async (): Promise<boolean> => {
    try {
      const res = await earnApi.registerNode();
      setNode(res.data.node);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  };

  const toggle = async (value: boolean) => {
    setError('');
    if (!value) {
      relayClient.stop();
      setEnabled(false);
      return;
    }
    setLoading(true);
    try {
      const res = await earnApi.registerNode();
      setNode(res.data.node);
      if (!res.data.canShare) {
        setError('You must agree to the Terms & Conditions before sharing your internet.');
        setEnabled(false);
        return;
      }
      relayClient.start(res.data.node, res.data.relayWsUrl);
      setEnabled(true);
    } catch (err) {
      setError(errorMessage(err));
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  const info = statusLabel(status);
  const show = enabled && status !== 'idle';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 34 }}>
          Share your internet
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Earn by letting vetted buyers route traffic through your unused bandwidth. You stay in
          control and can stop at any time.
        </ThemedText>

        {/* Status card */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.dot, { backgroundColor: info.color }]} />
          <ThemedText type="smallBold" style={{ color: info.color }}>
            {info.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {info.hint}
          </ThemedText>

          {show ? (
            <View style={styles.stats}>
              <Stat label="Session traffic" value={formatBytes(sessionBytes)} />
              <Stat label="Status" value={info.label} />
            </View>
          ) : null}
        </View>

        {/* Toggle */}
        <View style={[styles.toggleRow, { backgroundColor: theme.backgroundElement }]}>
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">{enabled ? 'Sharing enabled' : 'Sharing disabled'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {enabled && status === 'connected'
                ? 'Active — earning continuously.'
                : enabled
                  ? 'Starting…'
                  : 'Flip the switch to begin.'}
            </ThemedText>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggle}
            trackColor={{ true: '#3c87f7', false: theme.backgroundSelected }}
          />
        </View>

        {error ? (
          <ThemedText type="small" style={{ color: '#e5484d' }}>
            {error}
          </ThemedText>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.finePrint}>
          Bandwidth sharing requires an active, uncapped internet connection and may increase your
          mobile data usage. See our Terms &amp; Conditions for details.
        </ThemedText>
      </ScrollView>
      <LoadingModal visible={loading} text="Registering device…" />
    </SafeAreaView>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four },
  card: { borderRadius: 16, padding: Spacing.four, gap: Spacing.two },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two },
  stat: { gap: 2 },
  toggleRow: {
    borderRadius: 16,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  finePrint: { lineHeight: 18, opacity: 0.7 },
});