import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_IMAGE_WIDTH = 1027;
const MAP_IMAGE_HEIGHT = 1089;

const MAP_SOURCE = require('../../assets/labeledmap.png');
// Nudge y positions down so hit areas align with label centers on the map
const MAP_Y_OFFSET = 10;

// Local fallback so map works offline or before Supabase responds
const UNITS_FALLBACK: { id: string; unit_number: string; map_x: number; map_y: number }[] = [
  { id: '1', unit_number: 'Uphill 1A', map_x: 71, map_y: 151 },
  { id: '2', unit_number: 'Uphill 1B', map_x: 205, map_y: 102 },
  { id: '3', unit_number: 'Uphill 2A', map_x: 271, map_y: 224 },
  { id: '4', unit_number: 'Uphill 2B', map_x: 412, map_y: 114 },
  { id: '5', unit_number: 'Single Family 3', map_x: 473, map_y: 207 },
  { id: '6', unit_number: 'Slopeside 4A', map_x: 569, map_y: 265 },
  { id: '7', unit_number: 'Slopeside 4B', map_x: 739, map_y: 188 },
  { id: '8', unit_number: 'Downhill 5A', map_x: 902, map_y: 471 },
  { id: '9', unit_number: 'Downhill 5B', map_x: 927, map_y: 358 },
  { id: '10', unit_number: 'Downhill 6A', map_x: 569, map_y: 404 },
  { id: '11', unit_number: 'Downhill 6B', map_x: 751, map_y: 509 },
  { id: '12', unit_number: 'Downhill 7A', map_x: 389, map_y: 385 },
  { id: '13', unit_number: 'Downhill 7B', map_x: 504, map_y: 513 },
  { id: '14', unit_number: 'Downhill 8A', map_x: 172, map_y: 385 },
  { id: '15', unit_number: 'Downhill 8B', map_x: 286, map_y: 501 },
  { id: '16', unit_number: 'Uphill 9A', map_x: 52, map_y: 715 },
  { id: '17', unit_number: 'Uphill 9B', map_x: 191, map_y: 748 },
  { id: '18', unit_number: 'Uphill 10A', map_x: 178, map_y: 647 },
  { id: '19', unit_number: 'Uphill 10B', map_x: 323, map_y: 711 },
  { id: '20', unit_number: 'Single Family 11', map_x: 368, map_y: 621 },
  { id: '21', unit_number: 'Uphill 12A', map_x: 448, map_y: 694 },
  { id: '22', unit_number: 'Uphill 12B', map_x: 492, map_y: 591 },
  { id: '23', unit_number: 'Uphill 13A', map_x: 572, map_y: 654 },
  { id: '24', unit_number: 'Uphill 13B', map_x: 640, map_y: 556 },
  { id: '25', unit_number: 'Slopeside 14A', map_x: 684, map_y: 664 },
  { id: '26', unit_number: 'Slopeside 14B', map_x: 788, map_y: 579 },
  { id: '27', unit_number: 'Hillside End 15A', map_x: 908, map_y: 794 },
  { id: '28', unit_number: 'Hillside 15B', map_x: 925, map_y: 734 },
  { id: '29', unit_number: 'Hillside End 15C', map_x: 943, map_y: 671 },
  { id: '30', unit_number: 'Hillside End 16A', map_x: 738, map_y: 857 },
  { id: '31', unit_number: 'Hillside 16B', map_x: 762, map_y: 811 },
  { id: '32', unit_number: 'Hillside End 16C', map_x: 799, map_y: 767 },
  { id: '33', unit_number: 'Hillside End 17A', map_x: 608, map_y: 919 },
  { id: '34', unit_number: 'Hillside 17B', map_x: 624, map_y: 865 },
  { id: '35', unit_number: 'Hillside End 17B', map_x: 641, map_y: 808 },
  { id: '36', unit_number: 'Hillside End 18A', map_x: 404, map_y: 1000 },
  { id: '37', unit_number: 'Hillside 18B', map_x: 460, map_y: 925 },
  { id: '38', unit_number: 'Hillside End 18B', map_x: 507, map_y: 881 },
  { id: '39', unit_number: 'Hillside End 19C', map_x: 313, map_y: 940 },
  { id: '40', unit_number: 'Hillside 19B', map_x: 256, map_y: 885 },
  { id: '41', unit_number: 'Hillside 19A', map_x: 231, map_y: 818 },
];

type MapUnit = { id: string; unit_number: string; map_x: number; map_y: number };

export default function HomeScreen() {
  const [mapHeight, setMapHeight] = useState<number | null>(null);
  const [units, setUnits] = useState<MapUnit[]>(UNITS_FALLBACK);
  const [selectedUnit, setSelectedUnit] = useState<MapUnit | null>(null);
  const [mapZoomKey, setMapZoomKey] = useState(0);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  // Reset map zoom when user returns to the home tab (remount zoom ScrollView)
  useFocusEffect(
    useCallback(() => {
      setMapZoomKey((k) => k + 1);
    }, [])
  );

  // Size the map container to the image's aspect ratio so there's no letterboxing
  useEffect(() => {
    const resolved = Image.resolveAssetSource(MAP_SOURCE);
    if (resolved?.width && resolved?.height) {
      setMapHeight(SCREEN_WIDTH * (resolved.height / resolved.width));
    } else if (resolved?.uri) {
      Image.getSize(
        resolved.uri,
        (w, h) => setMapHeight(SCREEN_WIDTH * (h / w)),
        () => setMapHeight(SCREEN_WIDTH * (MAP_IMAGE_HEIGHT / MAP_IMAGE_WIDTH))
      );
    } else {
      setMapHeight(SCREEN_WIDTH * (MAP_IMAGE_HEIGHT / MAP_IMAGE_WIDTH));
    }
  }, []);

  // Load units from Supabase (with map coords), fall back to local list
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, map_x, map_y')
        .not('map_x', 'is', null)
        .not('map_y', 'is', null);
      if (!error && data?.length) {
        setUnits(
          data.map((r) => ({
            id: String(r.id),
            unit_number: r.unit_number ?? '',
            map_x: Number(r.map_x),
            map_y: Number(r.map_y),
          }))
        );
      }
    })();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const containerHeight = mapHeight ?? SCREEN_WIDTH * (MAP_IMAGE_HEIGHT / MAP_IMAGE_WIDTH);
  const scaleX = SCREEN_WIDTH / MAP_IMAGE_WIDTH;
  const scaleY = containerHeight / MAP_IMAGE_HEIGHT;
  const hitSize = 44;
  const hitHalf = hitSize / 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/flame.png')}
          style={styles.flameIcon}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={styles.notificationIcon}
          onPress={() => router.push('/(tabs)/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Select a Unit</Text>
        <Text style={styles.pinchHint}>Pinch to zoom</Text>
        <View style={{ height: 10 }} />
        {mapHeight != null ? (
          <View style={[styles.mapViewport, { height: mapHeight }]} key={`map-viewport-${mapZoomKey}`}>
            <ScrollView
              key={`map-zoom-${mapZoomKey}`}
              style={styles.mapScrollView}
              contentContainerStyle={[styles.mapScrollContent, { width: SCREEN_WIDTH, height: mapHeight }]}
              minimumZoomScale={0.5}
              maximumZoomScale={3}
              centerContent
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <View style={[styles.mapInner, { width: SCREEN_WIDTH, height: mapHeight }]}>
                <Image
                  source={MAP_SOURCE}
                  style={styles.mapImage}
                  resizeMode="contain"
                />
                <View
                  style={[styles.unitOverlay, { width: SCREEN_WIDTH, height: mapHeight }]}
                  pointerEvents="box-none"
                >
                  {units.map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[
                        styles.unitHitArea,
                        {
                          left: unit.map_x * scaleX - hitHalf,
                          top: unit.map_y * scaleY - hitHalf + MAP_Y_OFFSET,
                          width: hitSize,
                          height: hitSize,
                        },
                      ]}
                      onPress={() => setSelectedUnit(unit)}
                      activeOpacity={0.8}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.mapViewport, { height: SCREEN_WIDTH * (MAP_IMAGE_HEIGHT / MAP_IMAGE_WIDTH) }]}>
            <Image source={MAP_SOURCE} style={styles.mapImage} resizeMode="contain" />
          </View>
        )}
        <View style={{ height: 10 }} />

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/tickets')}
          >
            <Ionicons name="ticket-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Tickets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => console.log('Navigate to Units')}
          >
            <Ionicons name="business-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Units</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={selectedUnit != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUnit(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedUnit(null)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={styles.modalTitle}>{selectedUnit?.unit_number ?? 'Unit'}</Text>
            <Text style={styles.modalSubtitle}>
              Template info — more details coming soon.
            </Text>
            <TouchableOpacity
              style={styles.createTicketButton}
              onPress={async () => {
                const unitForTicket = selectedUnit;
                setSelectedUnit(null);
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert(
                    'Camera access',
                    'Camera permission is needed to attach a photo to the ticket.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ['images'],
                  allowsEditing: false,
                });
                // TODO: when Tickets page exists — use unitForTicket + result.assets[0] to upload photo and insert ticket
                if (!result.canceled && result.assets[0] && unitForTicket) {
                  // router.push({ pathname: '/create-ticket', params: { unitId: unitForTicket.id, photoUri: result.assets[0].uri } });
                }
              }}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.createTicketButtonText}>Create a ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedUnit(null)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  flameIcon: {
    width: 40,
    height: 40,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    color: 'white',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 4,
  },
  pinchHint: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 6,
  },
  mapViewport: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
  },
  mapScrollView: {
    flex: 1,
  },
  mapScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapInner: {
    overflow: 'hidden',
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3b3b3b',
  },
  unitOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  unitHitArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4a4a4a',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginHorizontal: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#4a4a4a',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    color: 'white',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#aaa',
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  createTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2681c',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  createTicketButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 8,
  },
  modalCloseButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#aaa',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
