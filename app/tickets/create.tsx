import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CustomPicker } from '../../components/CustomPicker';
import { supabase } from '../../lib/supabase/client';
import { uploadTicketPhoto } from '../../lib/services/tickets';
import { ROLE_TYPE_OPTIONS, type ProfileRole } from '../../lib/constants/tickets';
import { formatPhoneNumberDisplay } from '../../lib/utils/phone';

const BUILDING_OPTIONS = [
  { label: 'Framing', value: 'framing' },
  { label: 'Electrical', value: 'electrical' },
  { label: 'Plumbing', value: 'plumbing' },
  { label: 'HVAC', value: 'hvac' },
  { label: 'Countertops', value: 'countertops' },
  { label: 'Flooring', value: 'flooring' },
  { label: 'Painting', value: 'painting' },
  { label: 'Windows & Doors', value: 'windows_doors' },
  { label: 'Roofing', value: 'roofing' },
  { label: 'Insulation', value: 'insulation' },
  { label: 'Drywall', value: 'drywall' },
  { label: 'Other', value: 'other' },
];

const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

const LOCATION_SCOPE_OPTIONS = [
  { label: 'Interior', value: 'interior' },
  { label: 'Exterior', value: 'exterior' },
];

const FLOOR_LEVEL_OPTIONS = [
  { label: 'Basement', value: 'basement' },
  { label: '1st Floor', value: '1st_floor' },
  { label: '2nd Floor', value: '2nd_floor' },
  { label: '3rd Floor', value: '3rd_floor' },
];

type BuildingElement = (typeof BUILDING_OPTIONS)[number]['value'];
type Priority = (typeof PRIORITY_OPTIONS)[number]['value'];
type LocationScope = (typeof LOCATION_SCOPE_OPTIONS)[number]['value'];
type FloorLevel = (typeof FLOOR_LEVEL_OPTIONS)[number]['value'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

type AssignContact = {
  id: string;
  profile_id: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

export default function CreateTicketScreen() {
  const params = useLocalSearchParams<{ unitId: string; unitName: string; demoCreate?: string }>();
  const unitId = params.unitId ?? '';
  const unitName = params.unitName ?? 'Unit';
  const [createGuideVisible, setCreateGuideVisible] = useState(params.demoCreate === '1');

  const [photos, setPhotos] = useState<string[]>([]);
  const [buildingElements, setBuildingElements] = useState<BuildingElement[]>([]);
  const [buildingElementModalVisible, setBuildingElementModalVisible] = useState(false);
  const [locationScope, setLocationScope] = useState<LocationScope | ''>('');
  const [floorLevel, setFloorLevel] = useState<FloorLevel | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('medium');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [notifyModalVisible, setNotifyModalVisible] = useState(false);
  const [notifyStep, setNotifyStep] = useState<'type' | 'contacts'>('type');
  const [notifySelectedRole, setNotifySelectedRole] = useState<ProfileRole | null>(null);
  const [notifyContacts, setNotifyContacts] = useState<AssignContact[]>([]);
  const [notifyContactsLoading, setNotifyContactsLoading] = useState(false);
  const [notifySelectedContactIds, setNotifySelectedContactIds] = useState<string[]>([]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const handleRetakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access', 'Camera permission is needed to take a photo.', [{ text: 'OK' }]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos([result.assets[0].uri]);
    }
  };

  const handleAddFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library', 'Permission is needed to pick photos.', [{ text: 'OK' }]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
    });
    if (!result.canceled && result.assets.length) {
      const newUris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newUris]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const openNotifyModal = useCallback(() => {
    setNotifyStep('type');
    setNotifySelectedRole(null);
    setNotifyContacts([]);
    setNotifyModalVisible(true);
  }, []);

  const closeNotifyModal = useCallback(() => {
    setNotifyModalVisible(false);
    setNotifyStep('type');
    setNotifySelectedRole(null);
    setNotifyContacts([]);
  }, []);

  const onNotifySelectType = useCallback(async (role: ProfileRole) => {
    setNotifySelectedRole(role);
    setNotifyContactsLoading(true);
    setNotifyContacts([]);
    setNotifyStep('contacts');
    const { data, error: fetchErr } = await supabase
      .from('contacts')
      .select('id, profile_id, company_name, first_name, last_name, phone, email')
      .eq('role', role)
      .eq('status', 'active')
      .is('merged_into_contact_id', null)
      .order('first_name');
    setNotifyContactsLoading(false);
    if (!fetchErr && data?.length) {
      setNotifyContacts(data as AssignContact[]);
    } else {
      setNotifyContacts([]);
    }
  }, []);

  const onNotifyBackToType = useCallback(() => {
    setNotifyStep('type');
    setNotifySelectedRole(null);
    setNotifyContacts([]);
  }, []);

  const toggleNotifyContact = useCallback((contactId: string) => {
    setNotifySelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  }, []);

  const toggleBuildingElement = useCallback((value: BuildingElement) => {
    setBuildingElements((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (buildingElements.length === 0) {
      setError('Please select at least one building element.');
      return;
    }
    if (!locationScope) {
      setError('Please select Interior or Exterior.');
      return;
    }
    if (!floorLevel) {
      setError('Please select a floor.');
      return;
    }
    if (!unitId) {
      setError('Missing unit. Go back and select a unit again.');
      return;
    }
    if (!isValidUuid(unitId)) {
      setError('Invalid unit. Please go back to Home, wait for the unit list to load, then select a unit and create a ticket again.');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be signed in to create a ticket.');
        setLoading(false);
        return;
      }

      const photoUrls: string[] = [];
      for (const uri of photos) {
        const url = await uploadTicketPhoto(uri, user.id);
        photoUrls.push(url);
      }

      const { data: insertedTicket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          unit_id: unitId,
          created_by: user.id,
          photo_url: photoUrls[0] ?? null,
          photo_urls: photoUrls,
          building_element: buildingElements[0],
          building_elements: buildingElements,
          location_scope: locationScope,
          floor_level: floorLevel,
          priority: priority || 'medium',
          notes: notes.trim() || null,
          status: 'open',
        })
        .select('id')
        .single();

      if (insertError) {
        setError(insertError.message || 'Failed to create ticket.');
        setLoading(false);
        return;
      }

      const ticketId = insertedTicket?.id;
      if (ticketId) {
        const { data: unitRow } = await supabase
          .from('units')
          .select('project_manager_id')
          .eq('id', unitId)
          .single();
        const pmId = (unitRow as { project_manager_id: string | null } | null)?.project_manager_id ?? null;

        let pmContactId: string | null = null;
        if (pmId) {
          const { data: pmContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('profile_id', pmId)
            .is('merged_into_contact_id', null)
            .maybeSingle();
          pmContactId = (pmContact as { id: string } | null)?.id ?? null;
        }

        const assignContactIds = [...new Set([pmContactId, ...notifySelectedContactIds].filter(Boolean))] as string[];
        if (assignContactIds.length > 0) {
          const { error: assignContactError } = await supabase.from('ticket_contact_assignments').insert(
            assignContactIds.map((cid) => ({ ticket_id: ticketId, contact_id: cid, created_by: user.id }))
          );
          if (assignContactError) {
            setError(assignContactError.message || 'Ticket created but failed to assign contacts.');
            setLoading(false);
            return;
          }
        }

        if (pmId && !pmContactId) {
          const { error: assignError } = await supabase.from('ticket_assignments').insert(
            [{ ticket_id: ticketId, user_id: pmId }]
          );
          if (assignError) {
            setError(assignError.message || 'Ticket created but failed to assign users.');
            setLoading(false);
            return;
          }
        }
      }

      router.replace('/tickets');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  const missingParams = !unitId;
  if (missingParams) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Ticket</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing unit. Go back and create a ticket from a unit.</Text>
          <TouchableOpacity style={styles.backToTicketsButton} onPress={() => router.replace('/tickets')}>
            <Text style={styles.backToTicketsButtonText}>Back to Tickets</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Ticket</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.unitLabel}>{unitName}</Text>

          <Text style={styles.fieldLabel}>Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photosScrollContent}
            style={styles.photosScroll}
          >
            {photos.length === 0 ? (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="images-outline" size={40} color="#666" />
                <Text style={styles.photoPlaceholderText}>No photos yet</Text>
              </View>
            ) : (
              photos.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => removePhoto(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoActionButton} onPress={handleRetakePhoto}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.photoActionButtonText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoActionButton} onPress={handleAddFromLibrary}>
              <Ionicons name="images-outline" size={20} color="#fff" />
              <Text style={styles.photoActionButtonText}>Add from library</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Building elements</Text>
          <TouchableOpacity
            style={[styles.notifyButton, !!error && buildingElements.length === 0 && styles.notifyButtonError]}
            onPress={() => setBuildingElementModalVisible(true)}
          >
            <Ionicons name="construct-outline" size={20} color="#fff" />
            <Text style={styles.notifyButtonText}>
              {buildingElements.length === 0
                ? 'Select building elements'
                : `${buildingElements.length} element${buildingElements.length === 1 ? '' : 's'} selected`}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          {buildingElements.length > 0 ? (
            <View style={styles.selectedElementsWrap}>
              {buildingElements.map((v) => (
                <View key={v} style={styles.selectedElementChip}>
                  <Text style={styles.selectedElementChipText}>
                    {BUILDING_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Interior / Exterior</Text>
          <CustomPicker<LocationScope>
            selectedValue={locationScope}
            onValueChange={setLocationScope}
            items={LOCATION_SCOPE_OPTIONS}
            placeholder="Select location"
            hasError={!!error && !locationScope}
          />

          <Text style={styles.fieldLabel}>Floor</Text>
          <CustomPicker<FloorLevel>
            selectedValue={floorLevel}
            onValueChange={setFloorLevel}
            items={FLOOR_LEVEL_OPTIONS}
            placeholder="Select floor"
            hasError={!!error && !floorLevel}
          />

          <Text style={styles.fieldLabel}>Priority</Text>
          <CustomPicker<Priority>
            selectedValue={priority}
            onValueChange={setPriority}
            items={PRIORITY_OPTIONS}
            placeholder="Select priority"
          />

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe the issue..."
            placeholderTextColor="#888"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Assign contacts</Text>
          <TouchableOpacity style={styles.notifyButton} onPress={openNotifyModal}>
            <Ionicons name="people-outline" size={20} color="#fff" />
            <Text style={styles.notifyButtonText}>
              {notifySelectedContactIds.length === 0
                ? 'Assign contacts'
                : `${notifySelectedContactIds.length} contact${notifySelectedContactIds.length === 1 ? '' : 's'} assigned`}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Ticket</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={createGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateGuideVisible(false)}
      >
        <Pressable style={styles.notifyModalBackdrop} onPress={() => setCreateGuideVisible(false)}>
          <View style={styles.demoCreateModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.demoCreateTitle}>Creating a ticket</Text>
            <Text style={styles.demoCreateText}>1) Photo is optional. You can add one or skip it.</Text>
            <Text style={styles.demoCreateText}>2) Add details so people know what needs work.</Text>
            <Text style={styles.demoCreateText}>
              3) Assign contacts. Assigned people are notified and can view/comment on the ticket.
            </Text>
            <TouchableOpacity style={styles.demoCreateButton} onPress={() => setCreateGuideVisible(false)}>
              <Text style={styles.demoCreateButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={buildingElementModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBuildingElementModalVisible(false)}
      >
        <Pressable style={styles.notifyModalBackdrop} onPress={() => setBuildingElementModalVisible(false)}>
          <View style={styles.notifyModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.notifyModalHeader}>
              <View style={styles.notifyHeaderLeft} />
              <Text style={styles.notifyModalTitle}>Select building elements</Text>
              <TouchableOpacity style={styles.notifyHeaderRight} onPress={() => setBuildingElementModalVisible(false)}>
                <Text style={styles.notifyCloseButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={BUILDING_OPTIONS}
              keyExtractor={(item) => item.value}
              contentContainerStyle={styles.notifyListContent}
              renderItem={({ item }) => {
                const selected = buildingElements.includes(item.value);
                return (
                  <TouchableOpacity
                    style={[styles.notifyOptionItem, selected && styles.notifyOptionItemSelected]}
                    onPress={() => toggleBuildingElement(item.value)}
                  >
                    <Text style={styles.notifyOptionText}>{item.label}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={22} color="#f2681c" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={notifyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeNotifyModal}
      >
        <Pressable style={styles.notifyModalBackdrop} onPress={closeNotifyModal}>
          <View style={styles.notifyModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.notifyModalHeader}>
              <View style={styles.notifyHeaderLeft}>
                {notifyStep === 'contacts' && (
                  <TouchableOpacity style={styles.notifyBackButton} onPress={onNotifyBackToType}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.notifyModalTitle}>
                {notifyStep === 'type' ? 'Assign by role' : 'Select contacts to assign'}
              </Text>
              <TouchableOpacity style={styles.notifyHeaderRight} onPress={closeNotifyModal}>
                <Text style={styles.notifyCloseButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
            {notifyStep === 'type' && (
              <FlatList
                data={ROLE_TYPE_OPTIONS}
                keyExtractor={(item) => item.value}
                contentContainerStyle={styles.notifyListContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.notifyOptionItem}
                    onPress={() => onNotifySelectType(item.value)}
                  >
                    <Text style={styles.notifyOptionText}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              />
            )}
            {notifyStep === 'contacts' && (
              <>
                {notifyContactsLoading ? (
                  <View style={styles.notifyLoadingWrap}>
                    <ActivityIndicator size="large" color="#f2681c" />
                  </View>
                ) : notifyContacts.length === 0 ? (
                  <View style={styles.notifyEmptyWrap}>
                    <Text style={styles.notifyEmptyText}>No active contacts with this role.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={notifyContacts}
                    keyExtractor={(p) => p.id}
                    contentContainerStyle={styles.notifyListContent}
                    renderItem={({ item }) => {
                      const selected = notifySelectedContactIds.includes(item.id);
                      const formattedPhone = item.phone ? formatPhoneNumberDisplay(item.phone) : '';
                      const name = item.company_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || item.email || formattedPhone || 'Unknown';
                      const subtitle =
                        item.company_name && (item.first_name || item.last_name)
                          ? [item.first_name, item.last_name].filter(Boolean).join(' ')
                          : item.email || formattedPhone || '';
                      return (
                        <TouchableOpacity
                          style={[styles.notifyOptionItem, selected && styles.notifyOptionItemSelected]}
                          onPress={() => toggleNotifyContact(item.id)}
                        >
                          <View style={styles.notifyOptionTextWrap}>
                            <Text style={styles.notifyOptionText}>{name}</Text>
                            {subtitle ? <Text style={styles.notifyOptionSubText}>{subtitle}</Text> : null}
                          </View>
                          {selected && <Ionicons name="checkmark-circle" size={22} color="#f2681c" />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3b3b3b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  unitLabel: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginBottom: 12,
  },
  photosScroll: {
    marginBottom: 8,
  },
  photosScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  photoPlaceholder: {
    width: 120,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 6,
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#333',
    borderRadius: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
  },
  photoActionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
    marginBottom: 8,
    marginTop: 4,
  },
  notesInput: {
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    minHeight: 100,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#f2681c',
    marginBottom: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f2681c',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backToTicketsButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f2681c',
    borderRadius: 8,
  },
  backToTicketsButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  notifyButtonError: {
    borderWidth: 1,
    borderColor: '#f2681c',
  },
  notifyButtonText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  selectedElementsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -8,
    marginBottom: 12,
  },
  selectedElementChip: {
    backgroundColor: '#5a5a5a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedElementChipText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  notifyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  notifyModalContent: {
    backgroundColor: '#3b3b3b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  notifyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  notifyHeaderLeft: {
    width: 80,
    alignItems: 'flex-start',
  },
  notifyHeaderRight: {
    width: 80,
    alignItems: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  notifyBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifyModalTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    textAlign: 'center',
  },
  notifyCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  notifyCloseButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#f2681c',
  },
  notifyListContent: {
    paddingBottom: 20,
  },
  notifyOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#4a4a4a',
  },
  notifyOptionItemSelected: {
    backgroundColor: '#4a4a4a',
  },
  notifyOptionText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
  },
  notifyOptionTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  notifyOptionSubText: {
    marginTop: 3,
    fontSize: 13,
    color: '#999',
    fontFamily: 'Inter_400Regular',
  },
  notifyLoadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  notifyEmptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  notifyEmptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  demoCreateModal: {
    width: '88%',
    backgroundColor: '#3b3b3b',
    borderWidth: 1,
    borderColor: '#4a4a4a',
    borderRadius: 14,
    padding: 16,
  },
  demoCreateTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  demoCreateText: {
    marginTop: 8,
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  demoCreateButton: {
    marginTop: 14,
    backgroundColor: '#f2681c',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  demoCreateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
