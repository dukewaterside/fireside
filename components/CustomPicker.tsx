// Import React hooks for managing component state
import React, { useState } from 'react';
// Import React Native components
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
// Import fonts
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';

// Define the props this component accepts
interface CustomPickerProps<T extends string> {
  // The currently selected value
  selectedValue: T | '';
  // Function called when user selects a new value
  onValueChange: (value: T | '') => void;
  // Array of options to display
  items: Array<{ label: string; value: T | '' }>;
  // Placeholder text when nothing is selected
  placeholder?: string;
  // Optional error state styling
  hasError?: boolean;
}

/**
 * Custom Picker Component
 * 
 * This replaces the native Picker with a custom dropdown that:
 * - Works consistently on iOS and Android
 * - Matches our app's dark theme
 * - Provides better UX with a modal list
 * 
 * @template T - The type of values (e.g., UserRole or Trade)
 */
export function CustomPicker<T extends string>({
  selectedValue,
  onValueChange,
  items,
  placeholder = 'Select an option',
  hasError = false,
}: CustomPickerProps<T>) {
  // State to control whether the modal is visible
  const [modalVisible, setModalVisible] = useState(false);

  // Load fonts
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  // Find the label for the currently selected value
  // This displays what's currently selected in the button
  const selectedLabel = items.find((item) => item.value === selectedValue)?.label || placeholder;

  /**
   * Handles when user selects an item from the list
   */
  const handleSelect = (value: T | '') => {
    onValueChange(value); // Call the parent's onValueChange function
    setModalVisible(false); // Close the modal
  };

  return (
    <View>
      {/* The button that opens the dropdown */}
      <TouchableOpacity
        style={[
          styles.pickerButton,
          hasError && styles.pickerButtonError, // Add error styling if needed
        ]}
        onPress={() => setModalVisible(true)} // Open modal when pressed
        activeOpacity={0.7} // Slight opacity change on press
      >
        <Text
          style={[
            styles.pickerButtonText,
            selectedValue === '' && styles.placeholderText, // Gray text if nothing selected
          ]}
        >
          {selectedLabel}
        </Text>
        {/* Dropdown arrow icon (simple text-based) */}
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      {/* Modal that contains the list of options */}
      <Modal
        visible={modalVisible}
        transparent={true} // Makes the background semi-transparent
        animationType="slide" // Slides up from bottom
        onRequestClose={() => setModalVisible(false)} // Android back button support
      >
        {/* Backdrop - dark overlay that closes modal when tapped */}
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          {/* The actual picker content */}
          <View style={styles.modalContent}>
            {/* Header with title and close button */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select an option</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* List of options */}
            <FlatList
              data={items}
              keyExtractor={(item, index) => `${item.value}-${index}`} // Unique key for each item
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    item.value === selectedValue && styles.optionItemSelected, // Highlight selected item
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === selectedValue && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {/* Show checkmark if this item is selected */}
                  {item.value === selectedValue && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              // Add some padding at the bottom for better scrolling
              contentContainerStyle={styles.listContent}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // The button that shows the selected value
  pickerButton: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#4a4a4a',
    flexDirection: 'row', // Arrange text and arrow horizontally
    alignItems: 'center', // Vertically center content
    justifyContent: 'space-between', // Space between text and arrow
  },
  pickerButtonError: {
    borderColor: '#ff4444', // Red border if there's an error
  },
  pickerButtonText: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Inter_400Regular',
    flex: 1, // Takes up available space
  },
  placeholderText: {
    color: '#999', // Gray text for placeholder
  },
  arrow: {
    fontSize: 12,
    color: '#999',
    marginLeft: 10,
  },
  // Modal backdrop (the dark overlay)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black
    justifyContent: 'flex-end', // Align content to bottom
  },
  // The white content box in the modal
  modalContent: {
    backgroundColor: '#2e2e2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%', // Don't take up more than 70% of screen
    paddingBottom: 20,
  },
  // Header section of modal
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#666',
  },
  modalTitle: {
    fontSize: 18,
    color: 'white',
    fontFamily: 'Inter_600SemiBold',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
  },
  // Container for the list
  listContent: {
    paddingBottom: 20,
  },
  // Each option in the list
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  optionItemSelected: {
    backgroundColor: '#4a4a4a', // Highlight selected item
  },
  optionText: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Inter_400Regular',
  },
  optionTextSelected: {
    color: '#f2681c', // Orange color for selected item
  },
  checkmark: {
    fontSize: 18,
    color: '#f2681c',
    fontFamily: 'Inter_400Regular',
  },
});
