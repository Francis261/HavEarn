import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3c87f7',
        headerShown: false,
        tabBarLabelStyle: styles.label,
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="share" options={{ title: 'Share' }} />
      <Tabs.Screen name="earn" options={{ title: 'Ads' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11 },
});