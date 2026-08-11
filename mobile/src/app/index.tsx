import { View } from 'react-native';

// Initial anchor route. AuthRedirect in _layout.tsx routes to the correct
// group immediately after session restore.
export default function IndexScreen() {
  return <View style={{ flex: 1 }} />;
}