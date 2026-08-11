/* eslint-disable react-hooks/set-state-in-effect -- async data fetch on mount */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, LoadingModal } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { earnApi } from '@/api/earn';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/state/auth';
import { formatCents } from '@/utils/format';
import type { Transaction, WithdrawalRequest } from '@/types';
import type { WithdrawalStatus } from '@/types';

const METHOD_LABEL: Record<string, string> = { paypal: 'PayPal', crypto: 'Crypto (USDT/BTC)' };
const STATUS_COLOR: Record<WithdrawalStatus, string> = {
  pending: '#e5a000',
  approved: '#3c87f7',
  paid: '#30a46c',
  rejected: '#e5484d',
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut, refresh } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [minWithdrawal, setMinWithdrawal] = useState(500);
  const [method, setMethod] = useState<'paypal' | 'crypto'>('paypal');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'withdraw' | 'history'>('withdraw');

  const load = async () => {
    try {
      const [txRes, wdRes, methods] = await Promise.all([
        authApi.transactions(1),
        earnApi.withdrawals(),
        earnApi.withdrawalMethods(),
      ]);
      setTxs(txRes.data.transactions as unknown as Transaction[]);
      setWithdrawals(wdRes.data.withdrawals);
      setMinWithdrawal(methods.data.minWithdrawalCents);
    } catch {
      /* ignore secondary load failure */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitWithdrawal = async () => {
    setError('');
    setMessage('');
    const amountCents = Math.floor(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < minWithdrawal) {
      setError(`Minimum withdrawal is ${formatCents(minWithdrawal)}.`);
      return;
    }
    setBusy(true);
    try {
      const res = await earnApi.createWithdrawal({ method, destination: destination.trim(), amountCents });
      setMessage(`Withdrawal requested — ${res.data.withdrawal.status}.`);
      setAmount('');
      setDestination('');
      await Promise.all([refresh(), load()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Account header */}
        <View style={styles.header}>
          <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 32 }}>
            {user?.displayName || user?.email?.split('@')[0] || 'Account'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {user?.email}
          </ThemedText>
          <View style={[styles.wallet, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Balance
            </ThemedText>
            <ThemedText type="title" style={{ fontSize: 38, lineHeight: 46 }}>
              {formatCents(user?.balanceCents ?? 0)}
            </ThemedText>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TabButton label="Withdraw" active={tab === 'withdraw'} onPress={() => setTab('withdraw')} />
          <TabButton label="History" active={tab === 'history'} onPress={() => setTab('history')} />
        </View>

        {tab === 'withdraw' ? (
          <View style={styles.withdraw}>
            <ThemedText type="smallBold">Request a payout</ThemedText>
            <View style={styles.methodRow}>
              {(['paypal', 'crypto'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMethod(m)}
                  style={[
                    styles.method,
                    method === m && styles.methodActive,
                    { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText type="smallBold" style={method === m ? { color: '#3c87f7' } : undefined}>
                    {METHOD_LABEL[m]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Field
              label={method === 'paypal' ? 'PayPal email' : 'Wallet address'}
              value={destination}
              onChangeText={setDestination}
              keyboardType={method === 'paypal' ? 'email-address' : 'default'}
              autoCapitalize="none"
            />
            <Field label={`Amount (USD, min ${formatCents(minWithdrawal)})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            {error ? <ThemedText type="small" style={{ color: '#e5484d' }}>{error}</ThemedText> : null}
            {message ? <ThemedText type="small" style={{ color: '#30a46c' }}>{message}</ThemedText> : null}
            <Button label="Withdraw" onPress={submitWithdrawal} disabled={busy} loading={busy} />

            {withdrawals.length > 0 ? (
              <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
                <ThemedText type="smallBold">Your withdrawals</ThemedText>
                {withdrawals.map((w) => (
                  <View key={w.id} style={[styles.wdRow, { backgroundColor: theme.backgroundElement }]}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">{formatCents(w.amountCents)} · {METHOD_LABEL[w.method]}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {new Date(w.createdAt).toLocaleDateString()} · {w.destination}
                      </ThemedText>
                      {w.adminNote ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          Note: {w.adminNote}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText type="smallBold" style={{ color: STATUS_COLOR[w.status] }}>
                      {w.status}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: Spacing.two }}>
            {txs.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No transactions yet. Earn via ads, tasks, or sharing.
              </ThemedText>
            ) : (
              txs.map((t) => (
                <View key={t._id ?? t.id} style={[styles.wdRow, { backgroundColor: theme.backgroundElement }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{t.note || t.type}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(t.createdAt).toLocaleString()}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ color: t.amountCents >= 0 ? '#30a46c' : '#e5484d' }}>
                    {t.amountCents >= 0 ? '+' : '-'}
                    {formatCents(Math.abs(t.amountCents))}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ gap: Spacing.two, marginTop: Spacing.four }}>
          {user?.isAdmin ? (
            <Pressable onPress={() => setMessage('Admin panel is server-side. See server routes.')}>
              <ThemedText type="small" style={{ color: '#3c87f7' }}>
                Admin console (server)
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={() => signOut()} style={styles.signOut}>
            <ThemedText type="smallBold" style={{ color: '#e5484d' }}>
              Sign out
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
      <LoadingModal visible={busy} text="Processing…" />
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <ThemedText type="smallBold" style={active ? { color: '#3c87f7' } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.one },
  wallet: { borderRadius: 16, padding: Spacing.four, marginTop: Spacing.two, gap: 2 },
  tabs: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  tab: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    opacity: 0.6,
  },
  tabActive: { opacity: 1, backgroundColor: 'rgba(60,135,247,0.12)' },
  withdraw: { gap: Spacing.three },
  methodRow: { flexDirection: 'row', gap: Spacing.two },
  method: { flex: 1, borderRadius: 12, padding: Spacing.two, alignItems: 'center' },
  methodActive: { borderWidth: 1, borderColor: '#3c87f7' },
  wdRow: {
    borderRadius: 12,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  signOut: { alignSelf: 'flex-start', marginTop: Spacing.two },
});