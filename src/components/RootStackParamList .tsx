import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ResizableDragDropCanvas from './ResizableDragDropCanvas';
import FloorScreen from './FloorScreen';

export type RootStackParamList = {
  Home: undefined;
  Floor: { floor: any }; // Truyền dữ liệu floor
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={ResizableDragDropCanvas} options={{ title: 'Workshop Layout'}}  />
        <Stack.Screen name="Floor" component={FloorScreen} options={{ title: 'Floor Detail' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
