/* eslint-disable react-hooks/set-state-in-effect -- async data fetch on mount */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadingModal } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { earnApi } from '@/api/earn';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/state/auth';
import { formatCents } from '@/utils/format';
import type { Task } from '@/types';

export default function TasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { refresh } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await earnApi.tasks();
      setTasks(res.data.tasks);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const complete = async (task: Task) => {
    setBusyId(task.id);
    try {
      if (task.url) {
        await WebBrowser.openBrowserAsync(task.url).catch(() => undefined);
      }
      const res = await earnApi.completeTask(task.id);
      if (!res.data.ok) {
        setError(res.data.note ?? 'Could not complete task');
      }
      await refresh();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 34 }}>
          Tasks
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Complete tasks to earn instantly. Rewards are added to your balance.
        </ThemedText>

        {error ? (
          <ThemedText type="small" style={{ color: '#e5484d' }}>
            {error}
          </ThemedText>
        ) : null}

        {loading ? (
          <LoadingModal visible text="Loading tasks…" />
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={[styles.task, { backgroundColor: theme.backgroundElement }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{task.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {task.description}
                </ThemedText>
              </View>
              {task.status === 'approved' ? (
                <ThemedText type="smallBold" style={{ color: '#30a46c' }}>
                  Done
                </ThemedText>
              ) : task.status === 'pending' ? (
                <ThemedText type="smallBold" style={{ color: '#e5a000' }}>
                  Reviewing
                </ThemedText>
              ) : (
                <Button
                  label={`+${formatCents(task.rewardCents)}`}
                  onPress={() => complete(task)}
                  disabled={busyId === task.id}
                  loading={busyId === task.id}
                />
              )}
            </View>
          ))
        )}

        <Pressable onPress={() => router.push('/(main)/profile')} style={{ marginTop: Spacing.two }}>
          <ThemedText type="small" style={{ color: '#3c87f7' }}>
            View your earnings →
          </ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    padding: Spacing.three,
  },
});