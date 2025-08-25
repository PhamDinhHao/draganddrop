import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, LayoutChangeEvent, TouchableOpacity, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from './RootStackParamList ';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type FloorScreenRouteProp = RouteProp<RootStackParamList, 'Floor'>;

interface FloorItem {
  id: number;
  color: string;
  label: string;
  icon: string;
}

interface DroppedFloorItem extends FloorItem {
  x: number;
  y: number;
  width: number;
  height: number;
  droppedId: number;
  rotation: number;
}

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloorBackground {
  id: string;
  name: string;
  type: 'color' | 'pattern';
  value: string;
  preview: string;
}

const FLOOR_ITEMS: FloorItem[] = [
  { id: 1, color: '#8B4513', label: 'Desk', icon: '🪑' },
  { id: 2, color: '#2E8B57', label: 'Plant', icon: '🪴' },
  { id: 3, color: '#4682B4', label: 'Cabinet', icon: '🗄️' },
  { id: 4, color: '#DC143C', label: 'Fire Exit', icon: '🚪' },
  { id: 5, color: '#FFD700', label: 'Light', icon: '💡' },
  { id: 6, color: '#9370DB', label: 'Computer', icon: '💻' },
  { id: 7, color: '#FF6347', label: 'Tool Box', icon: '🧰' },
  { id: 8, color: '#20B2AA', label: 'Machine', icon: '⚙️' },
];

const FLOOR_BACKGROUNDS: FloorBackground[] = [
  { id: 'concrete', name: 'Concrete Floor', type: 'color', value: '#D3D3D3', preview: '#D3D3D3' },
  { id: 'wood', name: 'Wood Floor', type: 'color', value: '#DEB887', preview: '#DEB887' },
  { id: 'tile', name: 'Tile Floor', type: 'color', value: '#F5F5DC', preview: '#F5F5DC' },
  { id: 'carpet', name: 'Carpet', type: 'color', value: '#708090', preview: '#708090' },
  { id: 'industrial', name: 'Industrial', type: 'color', value: '#696969', preview: '#696969' },
];

export default function FloorScreen() {
  const route = useRoute<FloorScreenRouteProp>();
  const { floor } = route.params;

  const [floorItems] = useState<FloorItem[]>(FLOOR_ITEMS);
  const [selectedItem, setSelectedItem] = useState<DroppedFloorItem | null>(null);
  const [droppedItems, setDroppedItems] = useState<DroppedFloorItem[]>([]);
  const [dropZoneLayout, setDropZoneLayout] = useState<Layout | null>(null);
  const [dragAreaLayout, setDragAreaLayout] = useState<Layout | null>(null);
  const [isDragging, setIsDragging] = useState<number>(-1);
  const [draggingDroppedItem, setDraggingDroppedItem] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1);
  const [usedItems, setUsedItems] = useState<Set<number>>(new Set());
  const [selectedBackground, setSelectedBackground] = useState<FloorBackground>(FLOOR_BACKGROUNDS[0]);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<number | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [showItemPicker, setShowItemPicker] = useState<boolean>(false);

  const translateX = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(0);
  const panOffsetX = useSharedValue<number>(0);
  const panOffsetY = useSharedValue<number>(0);
  const scale = useSharedValue<number>(1);
  const scaleOffset = useSharedValue<number>(1);

  const dragTranslationX = floorItems.map(() => useSharedValue<number>(0));
  const dragTranslationY = floorItems.map(() => useSharedValue<number>(0));
  const dragScale = floorItems.map(() => useSharedValue<number>(1));

  const itemStartPositions = useRef<Record<number, { x: number; y: number; width: number; height: number; rotation: number }>>({});

  const toggleEditMode = (): void => {
    setIsEditMode((prev) => !prev);
    setSelectedItem(null);
    setCurrentItemIndex(-1);
    setIsResizing(null);
    setResizeHandle('');
  };

  const navigateToNextItem = (): void => {
    if (droppedItems.length === 0) return;

    const nextIndex = (currentItemIndex + 1) % droppedItems.length;
    setCurrentItemIndex(nextIndex);

    const targetItem = droppedItems[nextIndex];
    if (targetItem && dropZoneLayout) {
      const canvasHeaderHeight = 120;
      const padding = 16;

      const visibleCanvasWidth = dropZoneLayout.width - (padding * 2);
      const visibleCanvasHeight = dropZoneLayout.height - canvasHeaderHeight - (padding * 2);

      const centerX = visibleCanvasWidth / 2;
      const centerY = visibleCanvasHeight / 2;

      const itemCenterX = targetItem.x + targetItem.width / 2;
      const itemCenterY = targetItem.y + targetItem.height / 2;

      const targetTranslateX = centerX - itemCenterX;
      const targetTranslateY = centerY - itemCenterY;

      translateX.value = withSpring(targetTranslateX, { damping: 20, stiffness: 100 });
      translateY.value = withSpring(targetTranslateY, { damping: 20, stiffness: 100 });
      scale.value = withSpring(1.5, { damping: 20, stiffness: 100 });

      panOffsetX.value = targetTranslateX;
      panOffsetY.value = targetTranslateY;
      scaleOffset.value = 1.5;
    }
  };

  const resetCanvasTransform = (): void => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    panOffsetX.value = 0;
    panOffsetY.value = 0;
    scale.value = withSpring(1);
    scaleOffset.value = 1;
    setCurrentItemIndex(-1);
  };

  const clearAll = (): void => {
    setDroppedItems([]);
    setSelectedItem(null);
    setCurrentItemIndex(-1);
    setUsedItems(new Set());
    setIsResizing(null);
    setResizeHandle('');
  };

  const canvasPanGesture = Gesture.Pan()
    .enabled(isDragging === -1 && !draggingDroppedItem && !showBackgroundPicker && !isResizing)
    .onUpdate((e) => {
      translateX.value = panOffsetX.value + e.translationX;
      translateY.value = panOffsetY.value + e.translationY;
    })
    .onEnd(() => {
      panOffsetX.value = translateX.value;
      panOffsetY.value = translateY.value;
    });

  const canvasPinchGesture = Gesture.Pinch()
    .enabled(isDragging === -1 && !draggingDroppedItem && !showBackgroundPicker && !isResizing)
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(3, scaleOffset.value * e.scale));
    })
    .onEnd(() => {
      scaleOffset.value = scale.value;
    });

  const canvasComposedGesture = Gesture.Simultaneous(canvasPanGesture, canvasPinchGesture);

  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const createPanGesture = (index: number) => {
    return Gesture.Pan()
      .enabled(isEditMode)
      .onStart(() => {
        dragScale[index].value = withSpring(1.1);
        runOnJS(setIsDragging)(index);
      })
      .onUpdate((event) => {
        dragTranslationX[index].value = event.translationX;
        dragTranslationY[index].value = event.translationY;
      })
      .onEnd((event) => {
        dragScale[index].value = withSpring(1);
        runOnJS(setIsDragging)(-1);

        if (dropZoneLayout && dragAreaLayout) {
          const draggedItemX = dragAreaLayout.x + 20 + (index % 4) * 80 + event.translationX;
          const draggedItemY = dragAreaLayout.y + 80 + Math.floor(index / 4) * 80 + event.translationY;

          const isInDropZone =
            draggedItemX >= dropZoneLayout.x &&
            draggedItemX + 70 <= dropZoneLayout.x + dropZoneLayout.width &&
            draggedItemY >= dropZoneLayout.y &&
            draggedItemY + 70 <= dropZoneLayout.y + dropZoneLayout.height;

          if (isInDropZone) {
            const canvasHeaderHeight = 120;
            const canvasContainerX = draggedItemX - dropZoneLayout.x;
            const canvasContainerY = draggedItemY - dropZoneLayout.y - canvasHeaderHeight;
            const actualCanvasX = (canvasContainerX - translateX.value) / scale.value;
            const actualCanvasY = (canvasContainerY - translateY.value) / scale.value;
            const centeredX = actualCanvasX - 35;
            const centeredY = actualCanvasY - 35;

            runOnJS(handleDropSuccess)(index, centeredX, centeredY);
          } else {
            dragTranslationX[index].value = withSpring(0);
            dragTranslationY[index].value = withSpring(0);
          }
        } else {
          dragTranslationX[index].value = withSpring(0);
          dragTranslationY[index].value = withSpring(0);
        }
      });
  };

  const handleDropSuccess = (index: number, x: number, y: number): void => {
    const draggedItem = floorItems[index];

    const newItem: DroppedFloorItem = {
      ...draggedItem,
      x: Math.max(0, Math.min(x, 1800)),
      y: Math.max(0, Math.min(y, 1800)),
      width: 70,
      height: 70,
      rotation: 0,
      droppedId: Date.now() + index + Math.random(),
    };

    setDroppedItems((prev) => [...prev, newItem]);

    dragTranslationX[index].value = withSpring(0);
    dragTranslationY[index].value = withSpring(0);
  };

  const updateItemPosition = (droppedId: number, newX: number, newY: number): void => {
    setDroppedItems((prev) =>
      prev.map((item) =>
        item.droppedId === droppedId 
          ? { ...item, x: Math.max(0, newX), y: Math.max(0, newY) } 
          : item
      )
    );
  };

  const updateItemSize = (droppedId: number, newWidth: number, newHeight: number, newX?: number, newY?: number): void => {
    setDroppedItems((prev) =>
      prev.map((item) =>
        item.droppedId === droppedId 
          ? { 
              ...item, 
              width: Math.max(30, newWidth),
              height: Math.max(30, newHeight),
              ...(newX !== undefined && { x: Math.max(0, newX) }),
              ...(newY !== undefined && { y: Math.max(0, newY) }),
            } 
          : item
      )
    );
  };

  const rotateItem = (droppedId: number): void => {
    setDroppedItems((prev) =>
      prev.map((item) =>
        item.droppedId === droppedId 
          ? { ...item, rotation: (item.rotation + 90) % 360 } 
          : item
      )
    );
  };

  const removeDrop = (droppedId: number): void => {
    setDroppedItems((prev) => prev.filter((item) => item.droppedId !== droppedId));
  };

  const createDragAnimatedStyle = (index: number) =>
    useAnimatedStyle(() => ({
      transform: [
        { translateX: dragTranslationX[index].value },
        { translateY: dragTranslationY[index].value },
        { scale: dragScale[index].value },
      ],
      zIndex: isDragging === index ? 9999 : 1,
      elevation: isDragging === index ? 10 : 4,
    }));

  const createResizeGesture = (item: DroppedFloorItem, handle: string) => {
    return Gesture.Pan()
      .enabled(isEditMode && selectedItem?.droppedId === item.droppedId)
      .onStart(() => {
        itemStartPositions.current[item.droppedId] = { 
          x: item.x, 
          y: item.y, 
          width: item.width, 
          height: item.height,
          rotation: item.rotation
        };
        runOnJS(setIsResizing)(item.droppedId);
        runOnJS(setResizeHandle)(handle);
      })
      .onUpdate((event) => {
        const startPos = itemStartPositions.current[item.droppedId];
        if (!startPos) return;

        const deltaX = event.translationX / scale.value;
        const deltaY = event.translationY / scale.value;

        let newX = startPos.x;
        let newY = startPos.y;
        let newWidth = startPos.width;
        let newHeight = startPos.height;

        switch (handle) {
          case 'tl':
            newWidth = startPos.width - deltaX;
            newHeight = startPos.height - deltaY;
            newX = startPos.x + deltaX;
            newY = startPos.y + deltaY;
            break;
          case 'tr':
            newWidth = startPos.width + deltaX;
            newHeight = startPos.height - deltaY;
            newY = startPos.y + deltaY;
            break;
          case 'bl':
            newWidth = startPos.width - deltaX;
            newHeight = startPos.height + deltaY;
            newX = startPos.x + deltaX;
            break;
          case 'br':
            newWidth = startPos.width + deltaX;
            newHeight = startPos.height + deltaY;
            break;
        }

        runOnJS(updateItemSize)(item.droppedId, newWidth, newHeight, newX, newY);
      })
      .onEnd(() => {
        runOnJS(setIsResizing)(null);
        runOnJS(setResizeHandle)('');
        delete itemStartPositions.current[item.droppedId];
      });
  };

  const createMoveGesture = (item: DroppedFloorItem) => {
    return Gesture.Pan()
      .enabled(isEditMode && !isResizing)
      .onStart(() => {
        itemStartPositions.current[item.droppedId] = { 
          x: item.x, 
          y: item.y, 
          width: item.width, 
          height: item.height,
          rotation: item.rotation
        };
        runOnJS(setDraggingDroppedItem)(item.droppedId);
        runOnJS(setSelectedItem)(item);
      })
      .onUpdate((event) => {
        const startPos = itemStartPositions.current[item.droppedId];
        if (startPos) {
          const newX = startPos.x + event.translationX / scale.value;
          const newY = startPos.y + event.translationY / scale.value;
          runOnJS(updateItemPosition)(item.droppedId, newX, newY);
        }
      })
      .onEnd(() => {
        runOnJS(setDraggingDroppedItem)(null);
        delete itemStartPositions.current[item.droppedId];
      });
  };

  const getBackgroundStyle = () => {
    return { backgroundColor: selectedBackground.value };
  };

  return (
    <View style={styles.container}>
      {/* Floor Header */}
      <View style={styles.floorHeader}>
        <View style={styles.floorInfo}>
          <View style={[styles.floorColorIndicator, { backgroundColor: floor.color }]} />
          <Text style={styles.floorTitle}>Floor: {floor.label}</Text>
          <Text style={styles.floorSubtitle}>Position: ({Math.round(floor.x)}, {Math.round(floor.y)})</Text>
        </View>
      </View>

      {/* Items Sidebar */}
      {showItemPicker && (
        <View
          style={styles.itemSidebar}
          onLayout={(event: LayoutChangeEvent) => {
            const { x, y, width, height } = event.nativeEvent.layout;
            setDragAreaLayout({ x, y, width, height });
          }}
        >
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>🏗️ Floor Items</Text>
            <TouchableOpacity
              style={styles.closeSidebar}
              onPress={() => setShowItemPicker(false)}
            >
              <Text style={styles.closeSidebarText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.itemGrid}>
            {floorItems.map((item, index) => (
              <GestureDetector key={item.id} gesture={createPanGesture(index)}>
                <Animated.View
                  style={[
                    styles.floorItem,
                    { backgroundColor: item.color },
                    createDragAnimatedStyle(index),
                  ]}
                >
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </Animated.View>
              </GestureDetector>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Canvas Area */}
      <View
        style={[
          styles.dropZone,
          isDragging >= 0 && styles.dropZoneActive,
          isEditMode && styles.dropZoneEditMode,
        ]}
        onLayout={(event: LayoutChangeEvent) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          setDropZoneLayout({ x, y, width, height });
        }}
      >
        {/* Controls */}
        <View style={styles.canvasHeader}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={[styles.editButton, isEditMode && styles.editButtonActive]}
                onPress={toggleEditMode}
              >
                <Text style={[styles.editButtonText, isEditMode && styles.editButtonTextActive]}>
                  {isEditMode ? '👁️ View' : '📝 Edit'}
                </Text>
              </TouchableOpacity>

              {isEditMode && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowItemPicker(!showItemPicker)}
                >
                  <Text style={styles.addButtonText}>➕ Add Items</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.controlButton} onPress={resetCanvasTransform}>
                <Text style={styles.controlButtonText}>🔄 Reset View</Text>
              </TouchableOpacity>
              
              {droppedItems.length > 0 && !isEditMode && (
                <TouchableOpacity style={styles.nextButton} onPress={navigateToNextItem}>
                  <Text style={styles.nextButtonText}>
                    ➡️ Next ({currentItemIndex + 1}/{droppedItems.length})
                  </Text>
                </TouchableOpacity>
              )}

              {isEditMode && (
                <>
                  <TouchableOpacity
                    style={styles.backgroundButton}
                    onPress={() => setShowBackgroundPicker(!showBackgroundPicker)}
                  >
                    <View style={[styles.backgroundPreview, { backgroundColor: selectedBackground.preview }]} />
                    <Text style={styles.backgroundButtonText}>🎨 Floor</Text>
                  </TouchableOpacity>

                  {selectedItem && (
                    <TouchableOpacity
                      style={styles.rotateButton}
                      onPress={() => rotateItem(selectedItem.droppedId)}
                    >
                      <Text style={styles.rotateButtonText}>🔄 Rotate</Text>
                    </TouchableOpacity>
                  )}

                  {droppedItems.length > 0 && (
                    <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
                      <Text style={styles.clearButtonText}>🗑️ Clear All</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {selectedItem && isEditMode && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    removeDrop(selectedItem.droppedId);
                    setSelectedItem(null);
                  }}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Background Picker */}
        {showBackgroundPicker && (
          <View style={styles.backgroundPicker}>
            <View style={styles.backgroundGrid}>
              {FLOOR_BACKGROUNDS.map((bg) => (
                <TouchableOpacity
                  key={bg.id}
                  style={[
                    styles.backgroundOption,
                    { backgroundColor: bg.preview },
                    selectedBackground.id === bg.id && styles.backgroundOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedBackground(bg);
                    setShowBackgroundPicker(false);
                  }}
                >
                  {selectedBackground.id === bg.id && (
                    <Text style={styles.backgroundSelectedIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.backgroundPickerTitle}>Floor Materials</Text>
          </View>
        )}

        {/* Canvas */}
        <View style={styles.canvasContainer}>
          <GestureDetector gesture={canvasComposedGesture}>
            <Animated.View style={[styles.canvas, canvasAnimatedStyle]}>
              <View style={[styles.canvasContent, getBackgroundStyle()]}>
                
                {/* Dropped Items */}
                {droppedItems.map((item, itemIndex) => (
                  <View key={item.droppedId}>
                    {/* Main Item */}
                    <GestureDetector gesture={createMoveGesture(item)}>
                      <Animated.View
                        style={[
                          styles.droppedFloorItem,
                          {
                            backgroundColor: item.color,
                            left: item.x,
                            top: item.y,
                            width: item.width,
                            height: item.height,
                            transform: [{ rotate: `${item.rotation}deg` }],
                          },
                          isEditMode && selectedItem?.droppedId === item.droppedId && styles.selectedDroppedItem,
                          draggingDroppedItem === item.droppedId && { zIndex: 9999, elevation: 10 },
                          !isEditMode && itemIndex === currentItemIndex && styles.currentNavigationItem,
                        ]}
                        onTouchEnd={() => setSelectedItem(item)}
                      >
                        <Text style={styles.droppedItemIcon}>{item.icon}</Text>
                        <Text style={styles.droppedItemLabel}>{item.label}</Text>
                        <Text style={styles.itemSizeText}>
                          {Math.round(item.width)}×{Math.round(item.height)}
                        </Text>

                        {/* Navigation Indicator */}
                        {!isEditMode && itemIndex === currentItemIndex && (
                          <View style={styles.navigationIndicator}>
                            <Text style={styles.navigationText}>🎯</Text>
                          </View>
                        )}
                      </Animated.View>
                    </GestureDetector>

                    {/* Resize Handles */}
                    {isEditMode && selectedItem?.droppedId === item.droppedId && (
                      <>
                        <GestureDetector gesture={createResizeGesture(item, 'tl')}>
                          <Animated.View
                            style={[
                              styles.resizeHandle,
                              {
                                left: item.x - 8,
                                top: item.y - 8,
                              }
                            ]}
                          />
                        </GestureDetector>

                        <GestureDetector gesture={createResizeGesture(item, 'tr')}>
                          <Animated.View
                            style={[
                              styles.resizeHandle,
                              {
                                left: item.x + item.width - 8,
                                top: item.y - 8,
                              }
                            ]}
                          />
                        </GestureDetector>

                        <GestureDetector gesture={createResizeGesture(item, 'bl')}>
                          <Animated.View
                            style={[
                              styles.resizeHandle,
                              {
                                left: item.x - 8,
                                top: item.y + item.height - 8,
                              }
                            ]}
                          />
                        </GestureDetector>

                        <GestureDetector gesture={createResizeGesture(item, 'br')}>
                          <Animated.View
                            style={[
                              styles.resizeHandle,
                              {
                                left: item.x + item.width - 8,
                                top: item.y + item.height - 8,
                              }
                            ]}
                          />
                        </GestureDetector>
                      </>
                    )}
                  </View>
                ))}

                {/* Empty State */}
                {droppedItems.length === 0 && isDragging === -1 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                      {isEditMode
                        ? `🏗️ Floor Plan for ${floor.label}\n\n➕ Tap "Add Items" to start\n📐 Drag corners to resize\n🔄 Rotate items\n🎨 Choose floor material`
                        : `📋 Floor: ${floor.label}\n\n➡️ Use Next to navigate items\n🔍 Pinch to zoom\n✋ Pan to move around`}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  floorHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  floorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floorColorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  floorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  floorSubtitle: {
    fontSize: 14,
    color: '#718096',
  },
  itemSidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 280,
    height: '100%',
    backgroundColor: 'white',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f7fafc',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  closeSidebar: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fed7d7',
  },
  closeSidebarText: {
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemGrid: {
    padding: 16,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  floorItem: {
    width: 70,
    height: 70,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  itemLabel: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  dropZone: {
    flex: 1,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    zIndex: 2,
  },
  dropZoneActive: {
    borderWidth: 2,
    borderColor: '#48bb78',
    backgroundColor: '#f0fff4',
    zIndex: 1,
  },
  dropZoneEditMode: {
    borderWidth: 2,
    borderColor: '#ed8936',
    backgroundColor: '#fffaf0',
  },
  canvasHeader: {
    marginBottom: 12,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fef5e7',
    borderWidth: 1,
    borderColor: '#f6ad55',
  },
  editButtonActive: {
    backgroundColor: '#ed8936',
    borderColor: '#ed8936',
  },
  editButtonText: {
    color: '#ed8936',
    fontSize: 12,
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: 'white',
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e6fffa',
    borderWidth: 1,
    borderColor: '#4fd1c7',
  },
  addButtonText: {
    color: '#319795',
    fontSize: 12,
    fontWeight: '600',
  },
  backgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  backgroundPreview: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  backgroundButtonText: {
    color: '#4a5568',
    fontSize: 12,
    fontWeight: '600',
  },
  controlButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  controlButtonText: {
    color: '#3182ce',
    fontSize: 12,
    fontWeight: '600',
  },
  rotateButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ebf4ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#90cdf4',
  },
  rotateButtonText: {
    color: '#3182ce',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    color: '#e53e3e',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButtonText: {
    color: '#e53e3e',
    fontSize: 12,
    fontWeight: '600',
  },
  nextButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0fff4',
    borderWidth: 1,
    borderColor: '#68d391',
  },
  nextButtonText: {
    color: '#38a169',
    fontSize: 12,
    fontWeight: '600',
  },
  backgroundPicker: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backgroundPickerTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 12,
  },
  backgroundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  backgroundOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundOptionSelected: {
    borderColor: '#3182ce',
    borderWidth: 3,
  },
  backgroundSelectedIcon: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  canvasContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f7fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  canvas: {
    flex: 1,
  },
  canvasContent: {
    width: 2000,
    height: 2000,
    backgroundColor: '#D3D3D3',
    position: 'relative',
  },
  droppedFloorItem: {
    position: 'absolute',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  droppedItemIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  droppedItemLabel: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  itemSizeText: {
    color: 'white',
    fontSize: 8,
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  navigationIndicator: {
    position: 'absolute',
    top: -8,
    left: -8,
    backgroundColor: '#38a169',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationText: {
    color: 'white',
    fontSize: 8,
  },
  currentNavigationItem: {
    borderWidth: 3,
    borderColor: '#38a169',
    shadowColor: '#38a169',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 8,
  },
  selectedDroppedItem: {
    borderWidth: 3,
    borderColor: '#e53e3e',
    shadowColor: '#e53e3e',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 8,
  },
  resizeHandle: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#3182ce',
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 8,
    zIndex: 10000,
    elevation: 15,
  },
  emptyState: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -120 }, { translateY: -80 }],
    width: 240,
  },
  emptyText: {
    color: '#a0aec0',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});