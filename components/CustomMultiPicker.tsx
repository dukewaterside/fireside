import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';

interface CustomMultiPickerProps {
  selectedValues: string[];
  onValueChange: (values: string[]) => void;
  items: Array<{ label: string; value: string }>;
  placeholder?: string;
  hasError?: boolean;
}

/**
 * Multi-select dropdown that matches CustomPicker style (role/trade).
 * Tap an item to toggle selection; button shows "X selected" or placeholder.
 */
export function CustomMultiPicker({
  selectedValues,
  onValueChange,
  items,
  placeholder = 'Select',
  hasError = false,
}: CustomMultiPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFontTimeout(true), 5000); return () => clearTimeout(t); }, []);

  if (!fontsLoaded && !fontTimeout) return null;

  const toggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onValueChange(selectedValues.filter((v) => v !== value));
    } else {
      onValueChange([...selectedValues, value]);
    }
  };

  const buttonLabel =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
        ? items.find((i) => i.value === selectedValues[0])?.label ?? '1 selected'
        : `${selectedValues.length} selected`;

  return (
    <View>
      <TouchableOpacity
        style={[styles.pickerButton, hasError && styles.pickerButtonError]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.pickerButtonText,
            selectedValues.length === 0 && styles.placeholderText,
          ]}
        >
          {buttonLabel}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const selected = selectedValues.includes(item.value);
                return (
                  <TouchableOpacity
                    style={[styles.optionItem, selected && styles.optionItemSelected]}
                    onPress={() => toggle(item.value)}
                  >
                    <Text
                      style={[styles.optionText, selected && styles.optionTextSelected]}
                    >
                      {item.label}
                    </Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.listContent}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerButton: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#4a4a4a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonError: { borderColor: '#ff4444' },
  pickerButtonText: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  placeholderText: { color: '#999' },
  arrow: { fontSize: 12, color: '#999', marginLeft: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#2e2e2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#666',
  },
  modalTitle: { fontSize: 18, color: 'white', fontFamily: 'Inter_600SemiBold' },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { color: 'white', fontSize: 18, fontFamily: 'Inter_400Regular' },
  listContent: { paddingBottom: 20 },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  optionItemSelected: { backgroundColor: '#4a4a4a' },
  optionText: { fontSize: 16, color: 'white', fontFamily: 'Inter_400Regular' },
  optionTextSelected: { color: '#f2681c' },
  checkmark: { fontSize: 18, color: '#f2681c', fontFamily: 'Inter_400Regular' },
});
