/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import Demo from './src/components/RootStackParamList ';
import { GestureHandlerRootView } from "react-native-gesture-handler";
function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (

      <AppContent />

  );
}

function AppContent() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      <Demo></Demo>
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
