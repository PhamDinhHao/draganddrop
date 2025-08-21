import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './RootStackParamList ';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface DragImage {
  id: number;
  color: string;
  label: string;
}

interface DroppedItem extends DragImage {
  x: number;
  y: number;
  width: number;
  height: number;
  droppedId: number;
}

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BackgroundOption {
  id: string;
  name: string;
  type: 'color' | 'gradient';
  value: string | string[];
  preview: string;
}

const DRAG_IMAGES: DragImage[] = [
  { id: 1, color: '#FF6B6B', label: 'X4' },
  { id: 2, color: '#4ECDC4', label: 'X5' },
  { id: 3, color: '#45B7D1', label: 'X6' },
  { id: 4, color: '#96CEB4', label: 'X7' },
];

const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: 'white', name: 'Trắng', type: 'color', value: '#ffffff', preview: '#ffffff' },
  { id: 'light-gray', name: 'Xám nhạt', type: 'color', value: '#f8f9fa', preview: '#f8f9fa' },
  { id: 'blue', name: 'Xanh dương', type: 'color', value: '#e3f2fd', preview: '#e3f2fd' },
  { id: 'green', name: 'Xanh lá', type: 'color', value: '#e8f5e8', preview: '#e8f5e8' },
  { id: 'sunset', name: 'Hoàng hôn', type: 'gradient', value: ['#ff9a9e', '#fecfef'], preview: '#ff9a9e' },
  { id: 'ocean', name: 'Đại dương', type: 'gradient', value: ['#a8edea', '#fed6e3'], preview: '#a8edea' },
  { id: 'sky', name: 'Bầu trời', type: 'gradient', value: ['#d299c2', '#fef9d7'], preview: '#d299c2' },
];
type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};
const ResizableDragDropCanvas: React.FC<Props> = ({ navigation }) => {
  const [draggedImages] = useState<DragImage[]>(DRAG_IMAGES);
  const [selectedItem, setSelectedItem] = useState<DroppedItem | null>(null);
  const [droppedItems, setDroppedItems] = useState<DroppedItem[]>([]);
  const [dropZoneLayout, setDropZoneLayout] = useState<Layout | null>(null);
  const [dragAreaLayout, setDragAreaLayout] = useState<Layout | null>(null);
  const [isDragging, setIsDragging] = useState<number>(-1);
  const [draggingDroppedItem, setDraggingDroppedItem] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1);
  const [usedItems, setUsedItems] = useState<Set<number>>(new Set());
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption>(BACKGROUND_OPTIONS[0]);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<number | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  
  // Animated shared values for canvas transform
  const translateX = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(0);
  const panOffsetX = useSharedValue<number>(0);
  const panOffsetY = useSharedValue<number>(0);
  const scale = useSharedValue<number>(1);
  const scaleOffset = useSharedValue<number>(1);

  // Animated values for drag items
  const dragTranslationX = draggedImages.map(() => useSharedValue<number>(0));
  const dragTranslationY = draggedImages.map(() => useSharedValue<number>(0));
  const dragScale = draggedImages.map(() => useSharedValue<number>(1));

  // Ref to store initial positions
  const itemStartPositions = useRef<Record<number, { x: number; y: number; width: number; height: number }>>({});

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
      const canvasHeaderHeight = 60;
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
      scale.value = withSpring(1, { damping: 20, stiffness: 100 });

      panOffsetX.value = targetTranslateX;
      panOffsetY.value = targetTranslateY;
      scaleOffset.value = 1;
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

  // Canvas pan gesture - Updated to work in edit mode when not interacting with items
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

  // Canvas pinch gesture - Updated to work in edit mode
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

  // Gesture for dragging items from sidebar - Updated to work in edit mode
  const createPanGesture = (index: number, isUsed: boolean) => {
    return Gesture.Pan()
      .enabled(isEditMode && !isUsed)
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
          const draggedItemX = dragAreaLayout.x + 20 + index * 80 + event.translationX;
          const draggedItemY = dragAreaLayout.y + 80 + event.translationY;

          const isInDropZone =
            draggedItemX >= dropZoneLayout.x &&
            draggedItemX + 70 <= dropZoneLayout.x + dropZoneLayout.width &&
            draggedItemY >= dropZoneLayout.y &&
            draggedItemY + 70 <= dropZoneLayout.y + dropZoneLayout.height;

          if (isInDropZone) {
            const canvasHeaderHeight = 60;
            const canvasContainerX = draggedItemX - dropZoneLayout.x;
            const canvasContainerY = draggedItemY - dropZoneLayout.y - canvasHeaderHeight;
            const actualCanvasX = (canvasContainerX - translateX.value) / scale.value;
            const actualCanvasY = (canvasContainerY - translateY.value) / scale.value;
            const centeredX = actualCanvasX - 50; // Center the 100x100 square
            const centeredY = actualCanvasY - 50;

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
    const draggedItem = draggedImages[index];

    setUsedItems(prev => new Set(prev.add(draggedItem.id)));

    const newItem: DroppedItem = {
      ...draggedItem,
      x: Math.max(0, Math.min(x, 1800)),
      y: Math.max(0, Math.min(y, 1800)),
      width: 100, // Default square size
      height: 100,
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
              width: Math.max(50, newWidth),
              height: Math.max(50, newHeight),
              ...(newX !== undefined && { x: Math.max(0, newX) }),
              ...(newY !== undefined && { y: Math.max(0, newY) }),
            } 
          : item
      )
    );
  };

  const removeDrop = (droppedId: number): void => {
    const itemToRemove = droppedItems.find(item => item.droppedId === droppedId);
    if (itemToRemove) {
      setUsedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemToRemove.id);
        return newSet;
      });
    }

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

  // Create resize gesture for handles
  const createResizeGesture = (item: DroppedItem, handle: string) => {
    return Gesture.Pan()
      .enabled(isEditMode && selectedItem?.droppedId === item.droppedId)
      .onStart(() => {
        itemStartPositions.current[item.droppedId] = { 
          x: item.x, 
          y: item.y, 
          width: item.width, 
          height: item.height 
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
          case 'tl': // Top-left
            newWidth = startPos.width - deltaX;
            newHeight = startPos.height - deltaY;
            newX = startPos.x + deltaX;
            newY = startPos.y + deltaY;
            break;
          case 'tr': // Top-right
            newWidth = startPos.width + deltaX;
            newHeight = startPos.height - deltaY;
            newY = startPos.y + deltaY;
            break;
          case 'bl': // Bottom-left
            newWidth = startPos.width - deltaX;
            newHeight = startPos.height + deltaY;
            newX = startPos.x + deltaX;
            break;
          case 'br': // Bottom-right
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

  // Create move gesture for items
  const createMoveGesture = (item: DroppedItem) => {
    return Gesture.Pan()
      .enabled(isEditMode && !isResizing)
      .onStart(() => {
        itemStartPositions.current[item.droppedId] = { 
          x: item.x, 
          y: item.y, 
          width: item.width, 
          height: item.height 
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
    if (selectedBackground.type === 'gradient') {
      return { backgroundColor: selectedBackground.value[0] };
    }
    return { backgroundColor: selectedBackground.value as string };
  };

  return (
    <View style={styles.container}>

      {/* Sidebar - Updated styles to remove disabled state in edit mode */}
      <View
        style={[
          styles.dragArea,
          isDragging >= 0 && styles.dragAreaActive,
        ]}
        onLayout={(event: LayoutChangeEvent) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          setDragAreaLayout({ x, y, width, height });
        }}
      >
        <View style={styles.dragHeader}>
          <Text style={styles.sectionTitle}>📋 Kéo từ đây:</Text>
          {isDragging >= 0 && (
            <Text style={styles.draggingIndicator}>🔄 Đang kéo {draggedImages[isDragging].label}</Text>
          )}
        </View>
        <View style={styles.dragItemsContainer}>
          {draggedImages.map((item, index) => {
            const isUsed = usedItems.has(item.id);
            return (
              <GestureDetector key={item.id} gesture={createPanGesture(index, isUsed)}>
                <Animated.View
                  style={[
                    styles.dragItem,
                    { backgroundColor: item.color },
                    createDragAnimatedStyle(index),
                  ]}
                >
                  <Text style={styles.dragItemText}>{item.label}</Text>
                  {isUsed && (
                    <View style={styles.usedIndicator}>
                      <Text style={styles.usedIndicatorText}>✓</Text>
                    </View>
                  )}
                </Animated.View>
              </GestureDetector>
            );
          })}
        </View>
      </View>

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
          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.editButton, isEditMode && styles.editButtonActive]}
              onPress={toggleEditMode}
            >
              <Text style={[styles.editButtonText, isEditMode && styles.editButtonTextActive]}>
                {isEditMode ? '👁️ View Mode' : '📝 Edit Mode'}
              </Text>
            </TouchableOpacity>

            {/* Reset and Next buttons available in both modes */}
            <TouchableOpacity style={styles.controlButton} onPress={resetCanvasTransform}>
              <Text style={styles.controlButtonText}>🔄 Reset</Text>
            </TouchableOpacity>
            
            {droppedItems.length > 0 && !isEditMode && (
              <TouchableOpacity style={styles.nextButton} onPress={navigateToNextItem} onLongPress={() => setCurrentItemIndex(-1)}>
                <Text style={styles.nextButtonText}>
                  ➡️ Next ({currentItemIndex + 1}/{droppedItems.length})
                </Text>
              </TouchableOpacity>
            )}
            {selectedItem && (
  <TouchableOpacity
    style={styles.controlButton}
    onPress={() => navigation.navigate("Floor", { floor: selectedItem })}
  >
    <Text style={styles.controlButtonText}>
      {selectedItem?.label} Go floor
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
                  <Text style={styles.backgroundButtonText}>🎨 BG</Text>
                </TouchableOpacity>

                {droppedItems.length > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
                    <Text style={styles.clearButtonText}>🗑️ Xóa tất cả</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {selectedItem && isEditMode && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  removeDrop(selectedItem.droppedId);
                  setSelectedItem(null);
                }}
              >
                <Text style={styles.clearButtonText}>🗑️ Xóa</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Background Picker */}
        {showBackgroundPicker && (
          <View style={styles.backgroundPicker}>
            <View style={styles.backgroundGrid}>
              {BACKGROUND_OPTIONS.map((bg) => (
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
            <Text style={styles.backgroundPickerTitle}>Chọn background</Text>
          </View>
        )}

        {/* Canvas */}
        <View style={styles.canvasContainer}>
          <GestureDetector gesture={canvasComposedGesture}>
            <Animated.View style={[styles.canvas, canvasAnimatedStyle]}>
              <View style={[styles.canvasContent, getBackgroundStyle()]}>
                <View style={styles.gridPattern} />
                
                {/* Dropped Items */}
                {droppedItems.map((item, itemIndex) => (
                  <View key={item.droppedId}>
                    {/* Main Item */}
                    <GestureDetector gesture={createMoveGesture(item)}>
                      <Animated.View
                        style={[
                          styles.droppedItem,
                          {
                            backgroundColor: item.color,
                            left: item.x,
                            top: item.y,
                            width: item.width,
                            height: item.height,
                          },
                          isEditMode && selectedItem?.droppedId === item.droppedId && styles.selectedDroppedItem,
                          draggingDroppedItem === item.droppedId && { zIndex: 9999, elevation: 10 },
                          !isEditMode && itemIndex === currentItemIndex && styles.currentNavigationItem,
                        ]}
                        onTouchEnd={() =>setSelectedItem(item)}
                      >
                        <Text style={styles.droppedItemText}>{item.label}</Text>
                        <Text style={styles.sizeText}>
                          {Math.round(item.width)}×{Math.round(item.height)}
                        </Text>
                        <Text style={styles.positionText}>
                          ({Math.round(item.x)}, {Math.round(item.y)})
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
                        {/* Top-left handle */}
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

                        {/* Top-right handle */}
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

                        {/* Bottom-left handle */}
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

                        {/* Bottom-right handle */}
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
                        ? '✏️ Chế độ Edit\n🖼️ Kéo items mới vào canvas\n📐 Kéo các góc để resize\n✋ Pan/zoom canvas vẫn hoạt động\n🎨 Chọn background'
                        : '🖼️ Kéo items vào đây\n📌 Pinch để zoom\n✋ Pan để di chuyển\n➡️ Next để navigate\n👆 Edit để resize items\n🎨 Chọn background'}
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  dragArea: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    zIndex: 1,
  },
  dragAreaActive: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
    zIndex: 5,
  },
  dragAreaDisabled: {
    backgroundColor: '#f7fafc',
    borderColor: '#cbd5e0',
    opacity: 0.6,
  },
  dragHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropZone: {
    flex: 1,
    backgroundColor: 'white',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  draggingIndicator: {
    fontSize: 12,
    color: '#3182ce',
    fontWeight: '600',
  },
  dragItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dragItem: {
    width: 70,
    height: 70,
    borderRadius: 8, // Square with rounded corners
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dragItemText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
  },
  usedIndicator: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#48bb78',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  usedIndicatorText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
    height: 70
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
    fontSize: 14,
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: 'white',
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
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    color: '#e53e3e',
    fontSize: 14,
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
    fontSize: 14,
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
    backgroundColor: 'white',
    position: 'relative',
  },
  gridPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
    backgroundColor: 'transparent',
  },
  droppedItem: {
    position: 'absolute',
    borderRadius: 8, // Square with rounded corners
    justifyContent: 'center',
    alignItems: 'center',
  },
  droppedItemText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  sizeText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 2,
  },
  positionText: {
    color: 'white',
    fontSize: 8,
    textAlign: 'center',
    opacity: 0.8,
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
  // Resize Handle Styles
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

export default ResizableDragDropCanvas;