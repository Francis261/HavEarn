import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function Screen({ children, style }: ViewProps) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }, style]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Field({
  label,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  ...rest
}: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        {...rest}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? '#3c87f7' : theme.backgroundElement;
  const fg = variant === 'primary' ? '#ffffff' : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <ThemedText type="smallBold" style={{ color: fg }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function LoadingModal({ visible, text = 'Loading…' }: { visible: boolean; text?: string }) {
  const theme = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.backgroundElement }]}>
          <ActivityIndicator color="#3c87f7" />
          <ThemedText type="small" style={{ marginTop: 8 }}>
            {text}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  fieldWrap: { gap: 6, marginBottom: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 160,
  },
});