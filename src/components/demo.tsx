import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  runOnJS 
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const DRAG_IMAGES = [
  { id: 1, color: '#FF6B6B', label: 'Ảnh 1' },
  { id: 2, color: '#4ECDC4', label: 'Ảnh 2' },
  { id: 3, color: '#45B7D1', label: 'Ảnh 3' },
  { id: 4, color: '#96CEB4', label: 'Ảnh 4' },
];

const DragDropZoomPanCanvas = () => {
  const [draggedImages] = useState(DRAG_IMAGES);
  const [selectedItem, setSelectedItem] = useState(null);
  const [droppedItems, setDroppedItems] = useState([]);
  const [dropZoneLayout, setDropZoneLayout] = useState(null);
  const [dragAreaLayout, setDragAreaLayout] = useState(null);
  const [isDragging, setIsDragging] = useState(-1);
  const [itemScales, setItemScales] = useState({});
  const [draggingDroppedItem, setDraggingDroppedItem] = useState(null);
  
  // Trạng thái Edit Mode
  const [isEditMode, setIsEditMode] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panOffsetX = useSharedValue(0);
  const panOffsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  const scaleOffset = useSharedValue(1);

  const dragTranslationX = draggedImages.map(() => useSharedValue(0));
  const dragTranslationY = draggedImages.map(() => useSharedValue(0));
  const dragScale = draggedImages.map(() => useSharedValue(1));

  // Shared values để lưu vị trí ban đầu khi bắt đầu kéo
  const itemStartPositions = useRef({});

  const adjustItemSize = (droppedId, increase) => {
    setItemScales(prev => {
      const currentScale = prev[droppedId] || 1;
      const newScale = increase 
        ? Math.min(currentScale + 0.1, 3)
        : Math.max(currentScale - 0.1, 0.5);
      return { ...prev, [droppedId]: newScale };
    });
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setSelectedItem(null);
  };

  // Canvas pan gesture - bị disable khi edit mode
  const canvasPanGesture = Gesture.Pan()
    .enabled(isDragging === -1 && !isEditMode && !draggingDroppedItem)
    .onUpdate((e) => {
      translateX.value = panOffsetX.value + e.translationX;
      translateY.value = panOffsetY.value + e.translationY;
    })
    .onEnd(() => {
      panOffsetX.value = translateX.value;
      panOffsetY.value = translateY.value;
    });

  // Canvas pinch gesture - bị disable khi edit mode
  const canvasPinchGesture = Gesture.Pinch()
    .enabled(isDragging === -1 && !isEditMode && !draggingDroppedItem)
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

  // Gesture cho drag items từ sidebar - bị disable khi edit mode
  const createPanGesture = (index) => {
    return Gesture.Pan()
      .enabled(!isEditMode)
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
          const draggedItemX = dragAreaLayout.x + 20 + (index * 80) + event.translationX;
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

  const handleDropSuccess = (index, x, y) => {
    const newItem = {
      ...draggedImages[index],
      x: Math.max(0, Math.min(x, 1930)),
      y: Math.max(0, Math.min(y, 1930)),
      droppedId: Date.now() + index + Math.random(),
    };
    
    setDroppedItems(prev => [...prev, newItem]);
    setItemScales(prev => ({ ...prev, [newItem.droppedId]: 1 }));
    
    dragTranslationX[index].value = withSpring(0);
    dragTranslationY[index].value = withSpring(0);
  };

  const updateItemPosition = (droppedId, newX, newY) => {
    setDroppedItems(prev => 
      prev.map(item => 
        item.droppedId === droppedId 
          ? { ...item, x: newX, y: newY }
          : item
      )
    );
  };

  const removeDrop = (droppedId) => {
    setDroppedItems(prev => prev.filter(item => item.droppedId !== droppedId));
    setItemScales(prev => {
      const newScales = { ...prev };
      delete newScales[droppedId];
      return newScales;
    });
  };

  const clearAll = () => {
    setDroppedItems([]);
    setItemScales({});
    setSelectedItem(null);
  };

  const resetCanvasTransform = () => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    panOffsetX.value = 0;
    panOffsetY.value = 0;
    scale.value = withSpring(1);
    scaleOffset.value = 1;
  };

  const createDragAnimatedStyle = (index) => useAnimatedStyle(() => ({
    transform: [
      { translateX: dragTranslationX[index].value },
      { translateY: dragTranslationY[index].value },
      { scale: dragScale[index].value },
    ],
    zIndex: isDragging === index ? 9999 : 1,
    elevation: isDragging === index ? 10 : 4,
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kéo thả + Zoom/Pan Canvas (Edit Mode)</Text>
      
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          🔍 Zoom: {scale.value.toFixed(2)}x | Pan: ({translateX.value.toFixed(0)}, {translateY.value.toFixed(0)})
        </Text>
        <Text style={[styles.debugText, { marginTop: 4 }]}>
          {isEditMode ? '✏️ Chế độ Edit: Chỉ kéo thả item trên canvas' : '🔧 Chế độ Normal: Zoom/Pan/Add items'}
        </Text>
      </View>
      
      <View 
        style={[
          styles.dragArea, 
          isDragging >= 0 && styles.dragAreaActive,
          isEditMode && styles.dragAreaDisabled
        ]}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          setDragAreaLayout({ x, y, width, height });
        }}
      >
        <View style={styles.dragHeader}>
          <Text style={styles.sectionTitle}>
            📋 Kéo từ đây: {isEditMode ? '(Bị khóa)' : ''}
          </Text>
          {isDragging >= 0 && (
            <Text style={styles.draggingIndicator}>
              🔄 Đang kéo {draggedImages[isDragging].label}
            </Text>
          )}
        </View>
        <View style={styles.dragItemsContainer}>
          {draggedImages.map((item, index) => (
            <GestureDetector 
              key={item.id} 
              gesture={createPanGesture(index)}
            >
              <Animated.View style={[
                styles.dragItem,
                { backgroundColor: item.color },
                createDragAnimatedStyle(index),
                isEditMode && styles.dragItemDisabled
              ]}>
                <Text style={styles.dragItemText}>{item.label}</Text>
              </Animated.View>
            </GestureDetector>
          ))}
        </View>
      </View>

      <View 
        style={[
          styles.dropZone, 
          isDragging >= 0 && styles.dropZoneActive,
          isEditMode && styles.dropZoneEditMode
        ]}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          setDropZoneLayout({ x, y, width, height });
        }}
      >
        <View style={styles.canvasHeader}>
          <View style={styles.controlButtons}>
            <Text 
              style={[styles.editButton, isEditMode && styles.editButtonActive]}
              onPress={toggleEditMode}
            >
              {isEditMode ? '📝 Thoát Edit' : '✏️ Edit'}
            </Text>
            {!isEditMode && (
              <Text 
                style={styles.controlButton}
                onPress={resetCanvasTransform}
              >
                🔄 Reset
              </Text>
            )}
            {droppedItems.length > 0 && (
              <Text 
                style={styles.clearButton}
                onPress={clearAll}
              >
                🗑️ Xóa tất cả
              </Text>
            )}
            {selectedItem && isEditMode && (
              <>
                <Text 
                  style={styles.clearButton}
                  onPress={() => {
                    removeDrop(selectedItem.droppedId);
                    setSelectedItem(null);
                  }}
                >
                  🗑️ Xóa
                </Text>
                <Text 
                  style={styles.controlButton}
                  onPress={() => adjustItemSize(selectedItem.droppedId, true)}
                >
                  ➕
                </Text>
                <Text 
                  style={styles.controlButton}
                  onPress={() => adjustItemSize(selectedItem.droppedId, false)}
                >
                  ➖
                </Text>
              </>
            )}
          </View>
        </View>
        
        <View style={[
          styles.canvasContainer, 
          isDragging >= 0 && styles.canvasContainerActive,
          isEditMode && styles.canvasContainerEditMode
        ]}>
          <GestureDetector gesture={canvasComposedGesture}>
            <Animated.View style={[styles.canvas, canvasAnimatedStyle]}>
              <View style={styles.canvasContent}>
                <View style={styles.gridPattern} />
                
                {isDragging >= 0 && !isEditMode && (
                  <View style={styles.dropIndicator}>
                    <Text style={styles.dropIndicatorText}>
                      💫 Thả {draggedImages[isDragging].label} vào đây
                    </Text>
                  </View>
                )}
                
                {droppedItems.map((item) => {
                  const droppedItemGesture = Gesture.Pan()
                    .enabled(isEditMode)
                    .onStart(() => {
                      // Lưu vị trí ban đầu khi bắt đầu kéo
                      itemStartPositions.current[item.droppedId] = { x: item.x, y: item.y };
                      runOnJS(setDraggingDroppedItem)(item.droppedId);
                      runOnJS(setSelectedItem)(item);
                    })
                    .onUpdate((event) => {
                      // Sử dụng vị trí ban đầu đã lưu + translation để tính vị trí mới
                      const startPos = itemStartPositions.current[item.droppedId];
                      if (startPos) {
                        const newX = Math.max(0, Math.min(startPos.x + event.translationX / scale.value, 1930));
                        const newY = Math.max(0, Math.min(startPos.y + event.translationY / scale.value, 1930));
                        runOnJS(updateItemPosition)(item.droppedId, newX, newY);
                      }
                    })
                    .onEnd((event) => {
                      runOnJS(setDraggingDroppedItem)(null);
                      // Xóa vị trí ban đầu đã lưu
                      delete itemStartPositions.current[item.droppedId];
                    });
                  
                  return (
                    <GestureDetector key={item.droppedId} gesture={droppedItemGesture}>
                      <Animated.View
                        style={[
                          styles.droppedItem,
                          {
                            backgroundColor: item.color,
                            left: item.x,
                            top: item.y,
                            transform: [{ scale: itemScales[item.droppedId] || 1 }],
                          },
                          isEditMode && selectedItem?.droppedId === item.droppedId && styles.selectedDroppedItem,
                          // isEditMode && styles.droppedItemEditMode,
                          draggingDroppedItem === item.droppedId && { zIndex: 9999, elevation: 10 }
                        ]}
                        onTouchEnd={() => isEditMode && setSelectedItem(item)}
                      >
                        <Text style={styles.droppedItemText}>{item.label}</Text>
                        <Text style={styles.positionText}>
                          ({Math.round(item.x)}, {Math.round(item.y)})
                        </Text>
                        {isEditMode && (
                          <View style={styles.editModeIndicator}>
                            <Text style={styles.editModeText}>✋</Text>
                          </View>
                        )}
                      </Animated.View>
                    </GestureDetector>
                  );
                })}
                
                {droppedItems.length === 0 && isDragging === -1 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                      {isEditMode 
                        ? '✏️ Chế độ Edit\n🖼️ Kéo thả ảnh đã thả để di chuyển\n📝 Thoát Edit để zoom/pan'
                        : '🖼️ Kéo ảnh vào đây\n📌 Pinch để zoom\n✋ Pan để di chuyển\n👆 Tap ảnh để chọn/xóa\n➕➖ Chọn để phóng to/thu nhỏ'
                      }
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
        
        {droppedItems.length > 0 && (
          <Text style={styles.stats}>
            📊 {droppedItems.length} ảnh đã thả
            {isEditMode && ' - Chế độ Edit: Kéo để di chuyển'}
          </Text>
        )}
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2d3748',
  },
  debugInfo: {
    backgroundColor: '#edf2f7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  debugText: {
    fontSize: 12,
    color: '#4a5568',
    textAlign: 'center',
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
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragItemDisabled: {
    opacity: 0.4,
  },
  dragItemText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    color: '#ed8936',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fef5e7',
    borderWidth: 1,
    borderColor: '#f6ad55',
  },
  editButtonActive: {
    backgroundColor: '#ed8936',
    color: 'white',
    borderColor: '#ed8936',
  },
  controlButton: {
    color: '#3182ce',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButton: {
    color: '#e53e3e',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  canvasContainerActive: {
    borderColor: '#48bb78',
    backgroundColor: '#f0fff4',
  },
  canvasContainerEditMode: {
    borderColor: '#ed8936',
    backgroundColor: '#fffaf0',
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
    opacity: 0.1,
    backgroundColor: 'transparent',
  },
  dropIndicator: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -25 }],
    width: 200,
    height: 50,
    backgroundColor: 'rgba(72, 187, 120, 0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#48bb78',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropIndicatorText: {
    color: '#48bb78',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  droppedItem: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // droppedItemEditMode: {
  //   borderWidth: 2,
  //   borderColor: '#ed8936',
  //   borderStyle: 'dashed',
  // },
  droppedItemText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
  },
  positionText: {
    color: 'white',
    fontSize: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  editModeIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ed8936',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModeText: {
    color: 'white',
    fontSize: 8,
  },
  emptyState: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -120 }, { translateY: -50 }],
    width: 240,
  },
  emptyText: {
    color: '#a0aec0',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  stats: {
    marginTop: 12,
    textAlign: 'center',
    color: '#718096',
    fontSize: 13,
    fontWeight: '500',
  },
  selectedDroppedItem: {
    borderWidth: 3,
    borderColor: '#e53e3e',
    shadowColor: '#e53e3e',
    shadowOpacity: 0.5,
  },
});

export default DragDropZoomPanCanvas;