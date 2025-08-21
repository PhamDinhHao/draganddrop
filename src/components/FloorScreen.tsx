import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from './RootStackParamList ';

type FloorScreenRouteProp = RouteProp<RootStackParamList, 'Floor'>;

export default function FloorScreen() {
  const route = useRoute<FloorScreenRouteProp>();
  const { floor } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Floor Detail - {floor.label}</Text>
      {/* TODO: Bạn có thể tái sử dụng ResizableDragDropCanvas tại đây 
          hoặc tạo FloorCanvas riêng theo logic */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold' },
});
