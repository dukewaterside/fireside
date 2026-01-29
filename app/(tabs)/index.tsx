import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_IMAGE_WIDTH = 1027;
const MAP_IMAGE_HEIGHT = 1089;

const MAP_SOURCE = require('../../assets/labeledmap.png');

// Nudge hit areas to align with unit labels on the map (tune if taps are off)
const MAP_X_OFFSET = 12;
const MAP_Y_OFFSET = 12;

type MapUnitBox = { tl_x: number; tl_y: number; br_x: number; br_y: number };

// Local fallback for 1027×1089 map; coords scaled from 2468×1657 + offset for hit alignment.
const SX = MAP_IMAGE_WIDTH / 2468;
const SY = MAP_IMAGE_HEIGHT / 1657;
const r = (x: number, y: number) => ({ map_x: Math.round(x * SX), map_y: Math.round(y * SY) });
const UNITS_FALLBACK: { id: string; unit_number: string; map_x: number; map_y: number; box: MapUnitBox }[] = [
  // Fireside Phase 1 (Firelight Lane)
  { id: '1', unit_number: 'Uphill 1A', ...r(94, 224), box: { tl_x: Math.round(39 * SX), tl_y: Math.round(169 * SY), br_x: Math.round(149 * SX), br_y: Math.round(279 * SY) } },
  { id: '2', unit_number: 'Uphill 1B', ...r(238, 345), box: { tl_x: Math.round(183 * SX), tl_y: Math.round(290 * SY), br_x: Math.round(293 * SX), br_y: Math.round(400 * SY) } },
  { id: '3', unit_number: 'Uphill 2A', ...r(402, 243), box: { tl_x: Math.round(347 * SX), tl_y: Math.round(188 * SY), br_x: Math.round(457 * SX), br_y: Math.round(298 * SY) } },
  { id: '4', unit_number: 'Uphill 2B', ...r(471, 403), box: { tl_x: Math.round(416 * SX), tl_y: Math.round(348 * SY), br_x: Math.round(526 * SX), br_y: Math.round(458 * SY) } },
  { id: '5', unit_number: 'Single Family 3', ...r(585, 309), box: { tl_x: Math.round(530 * SX), tl_y: Math.round(254 * SY), br_x: Math.round(640 * SX), br_y: Math.round(364 * SY) } },
  { id: '6', unit_number: 'Slopeside 4A', ...r(682, 418), box: { tl_x: Math.round(627 * SX), tl_y: Math.round(363 * SY), br_x: Math.round(737 * SX), br_y: Math.round(473 * SY) } },
  { id: '7', unit_number: 'Slopeside 4B', ...r(847, 308), box: { tl_x: Math.round(792 * SX), tl_y: Math.round(253 * SY), br_x: Math.round(902 * SX), br_y: Math.round(363 * SY) } },
  // Downhill — 8A, 8B, 7A, 7B, 6A, 6B, 5A, 5B
  { id: '8', unit_number: 'Downhill 8A', ...r(269, 556), box: { tl_x: Math.round(214 * SX), tl_y: Math.round(501 * SY), br_x: Math.round(324 * SX), br_y: Math.round(611 * SY) } },
  { id: '9', unit_number: 'Downhill 8B', ...r(370, 673), box: { tl_x: Math.round(315 * SX), tl_y: Math.round(618 * SY), br_x: Math.round(425 * SX), br_y: Math.round(728 * SY) } },
  { id: '10', unit_number: 'Downhill 7A', ...r(497, 571), box: { tl_x: Math.round(442 * SX), tl_y: Math.round(516 * SY), br_x: Math.round(552 * SX), br_y: Math.round(626 * SY) } },
  { id: '11', unit_number: 'Downhill 7B', ...r(611, 692), box: { tl_x: Math.round(556 * SX), tl_y: Math.round(637 * SY), br_x: Math.round(666 * SX), br_y: Math.round(747 * SY) } },
  { id: '12', unit_number: 'Downhill 6A', ...r(715, 567), box: { tl_x: Math.round(660 * SX), tl_y: Math.round(512 * SY), br_x: Math.round(770 * SX), br_y: Math.round(622 * SY) } },
  { id: '13', unit_number: 'Downhill 6B', ...r(850, 677), box: { tl_x: Math.round(795 * SX), tl_y: Math.round(622 * SY), br_x: Math.round(905 * SX), br_y: Math.round(732 * SY) } },
  { id: '14', unit_number: 'Downhill 5A', ...r(1051, 634), box: { tl_x: Math.round(996 * SX), tl_y: Math.round(579 * SY), br_x: Math.round(1106 * SX), br_y: Math.round(689 * SY) } },
  { id: '15', unit_number: 'Downhill 5B', ...r(1051, 501), box: { tl_x: Math.round(996 * SX), tl_y: Math.round(446 * SY), br_x: Math.round(1106 * SX), br_y: Math.round(556 * SY) } },
  // Fireside Phase 2 (Ember Court)
  { id: '16', unit_number: 'Uphill 9A', ...r(437, 984), box: { tl_x: Math.round(382 * SX), tl_y: Math.round(929 * SY), br_x: Math.round(492 * SX), br_y: Math.round(1039 * SY) } },
  { id: '17', unit_number: 'Uphill 9B', ...r(638, 1033), box: { tl_x: Math.round(583 * SX), tl_y: Math.round(978 * SY), br_x: Math.round(693 * SX), br_y: Math.round(1088 * SY) } },
  { id: '18', unit_number: 'Uphill 10A', ...r(663, 875), box: { tl_x: Math.round(608 * SX), tl_y: Math.round(820 * SY), br_x: Math.round(718 * SX), br_y: Math.round(930 * SY) } },
  { id: '19', unit_number: 'Uphill 10B', ...r(855, 962), box: { tl_x: Math.round(800 * SX), tl_y: Math.round(907 * SY), br_x: Math.round(910 * SX), br_y: Math.round(1017 * SY) } },
  { id: '20', unit_number: 'Single Family 11', ...r(939, 847), box: { tl_x: Math.round(884 * SX), tl_y: Math.round(792 * SY), br_x: Math.round(994 * SX), br_y: Math.round(902 * SY) } },
  { id: '21', unit_number: 'Uphill 12A', ...r(1087, 934), box: { tl_x: Math.round(1032 * SX), tl_y: Math.round(879 * SY), br_x: Math.round(1142 * SX), br_y: Math.round(989 * SY) } },
  { id: '22', unit_number: 'Uphill 12B', ...r(1135, 770), box: { tl_x: Math.round(1080 * SX), tl_y: Math.round(715 * SY), br_x: Math.round(1190 * SX), br_y: Math.round(825 * SY) } },
  { id: '23', unit_number: 'Uphill 13A', ...r(1254, 869), box: { tl_x: Math.round(1199 * SX), tl_y: Math.round(814 * SY), br_x: Math.round(1309 * SX), br_y: Math.round(924 * SY) } },
  { id: '24', unit_number: 'Uphill 13B', ...r(1363, 738), box: { tl_x: Math.round(1308 * SX), tl_y: Math.round(683 * SY), br_x: Math.round(1418 * SX), br_y: Math.round(793 * SY) } },
  { id: '25', unit_number: 'Slopeside 14A', ...r(1454, 897), box: { tl_x: Math.round(1399 * SX), tl_y: Math.round(842 * SY), br_x: Math.round(1509 * SX), br_y: Math.round(952 * SY) } },
  { id: '26', unit_number: 'Slopeside 14B', ...r(1576, 781), box: { tl_x: Math.round(1521 * SX), tl_y: Math.round(726 * SY), br_x: Math.round(1631 * SX), br_y: Math.round(836 * SY) } },
  // Hillside Units (Teal)
  { id: '27', unit_number: 'Hillside 19A', ...r(754, 1148), box: { tl_x: Math.round(699 * SX), tl_y: Math.round(1093 * SY), br_x: Math.round(809 * SX), br_y: Math.round(1203 * SY) } },
  { id: '28', unit_number: 'Hillside 19B', ...r(752, 1254), box: { tl_x: Math.round(697 * SX), tl_y: Math.round(1199 * SY), br_x: Math.round(807 * SX), br_y: Math.round(1309 * SY) } },
  { id: '29', unit_number: 'Hillside 19C', ...r(853, 1364), box: { tl_x: Math.round(798 * SX), tl_y: Math.round(1309 * SY), br_x: Math.round(908 * SX), br_y: Math.round(1419 * SY) } },
  { id: '30', unit_number: 'Hillside 18A', ...r(1011, 1419), box: { tl_x: Math.round(956 * SX), tl_y: Math.round(1364 * SY), br_x: Math.round(1066 * SX), br_y: Math.round(1474 * SY) } },
  { id: '31', unit_number: 'Hillside 18B', ...r(1083, 1331), box: { tl_x: Math.round(1028 * SX), tl_y: Math.round(1276 * SY), br_x: Math.round(1138 * SX), br_y: Math.round(1386 * SY) } },
  { id: '32', unit_number: 'Hillside 18C', ...r(1155, 1250), box: { tl_x: Math.round(1100 * SX), tl_y: Math.round(1195 * SY), br_x: Math.round(1210 * SX), br_y: Math.round(1305 * SY) } },
  { id: '33', unit_number: 'Hillside 17A', ...r(1346, 1326), box: { tl_x: Math.round(1291 * SX), tl_y: Math.round(1271 * SY), br_x: Math.round(1401 * SX), br_y: Math.round(1381 * SY) } },
  { id: '34', unit_number: 'Hillside 17B', ...r(1347, 1219), box: { tl_x: Math.round(1292 * SX), tl_y: Math.round(1164 * SY), br_x: Math.round(1402 * SX), br_y: Math.round(1274 * SY) } },
  { id: '35', unit_number: 'Hillside 17C', ...r(1386, 1107), box: { tl_x: Math.round(1331 * SX), tl_y: Math.round(1052 * SY), br_x: Math.round(1441 * SX), br_y: Math.round(1162 * SY) } },
  { id: '36', unit_number: 'Hillside 16A', ...r(1551, 1219), box: { tl_x: Math.round(1496 * SX), tl_y: Math.round(1164 * SY), br_x: Math.round(1606 * SX), br_y: Math.round(1274 * SY) } },
  { id: '37', unit_number: 'Hillside 16B', ...r(1574, 1119), box: { tl_x: Math.round(1519 * SX), tl_y: Math.round(1064 * SY), br_x: Math.round(1629 * SX), br_y: Math.round(1174 * SY) } },
  { id: '38', unit_number: 'Hillside 16C', ...r(1624, 1029), box: { tl_x: Math.round(1569 * SX), tl_y: Math.round(974 * SY), br_x: Math.round(1679 * SX), br_y: Math.round(1084 * SY) } },
  { id: '39', unit_number: 'Hillside 15A', ...r(1838, 1116), box: { tl_x: Math.round(1783 * SX), tl_y: Math.round(1061 * SY), br_x: Math.round(1893 * SX), br_y: Math.round(1171 * SY) } },
  { id: '40', unit_number: 'Hillside 15B', ...r(1828, 993), box: { tl_x: Math.round(1773 * SX), tl_y: Math.round(938 * SY), br_x: Math.round(1883 * SX), br_y: Math.round(1048 * SY) } },
  { id: '41', unit_number: 'Hillside 15C', ...r(1882, 888), box: { tl_x: Math.round(1827 * SX), tl_y: Math.round(833 * SY), br_x: Math.round(1937 * SX), br_y: Math.round(943 * SY) } },
];

type MapUnit = { id: string; unit_number: string; map_x: number; map_y: number; box?: MapUnitBox };

const SYNTHETIC_BOX_RADIUS = 35; // pixels in map image coords when unit has no box (e.g. from Supabase)

function getEffectiveBox(unit: MapUnit): MapUnitBox {
  if (unit.box) return unit.box;
  return {
    tl_x: unit.map_x - SYNTHETIC_BOX_RADIUS,
    tl_y: unit.map_y - SYNTHETIC_BOX_RADIUS,
    br_x: unit.map_x + SYNTHETIC_BOX_RADIUS,
    br_y: unit.map_y + SYNTHETIC_BOX_RADIUS,
  };
}

function findUnitAtMapCoords(units: MapUnit[], mapX: number, mapY: number): MapUnit | null {
  for (const unit of units) {
    const b = getEffectiveBox(unit);
    if (mapX >= b.tl_x && mapX <= b.br_x && mapY >= b.tl_y && mapY <= b.br_y) return unit;
  }
  return null;
}

const UNITS_LOAD_TIMEOUT_MS = 10000; // 10 seconds

const DEFAULT_MAP_HEIGHT = SCREEN_WIDTH * (MAP_IMAGE_HEIGHT / MAP_IMAGE_WIDTH);

export default function HomeScreen() {
  const [mapHeight, setMapHeight] = useState<number>(DEFAULT_MAP_HEIGHT);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [units, setUnits] = useState<MapUnit[]>(UNITS_FALLBACK);
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<MapUnit | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) setHasSession(!!session);
      })();
      return () => { mounted = false; };
    }, [])
  );

  useEffect(() => {
    const resolved = Image.resolveAssetSource(MAP_SOURCE);
    if (resolved?.width && resolved?.height) {
      setImageSize({ width: resolved.width, height: resolved.height });
      setMapHeight(SCREEN_WIDTH * (resolved.height / resolved.width));
      return;
    }
    if (resolved?.uri) {
      Image.getSize(
        resolved.uri,
        (w, h) => {
          if (w && h) {
            setImageSize({ width: w, height: h });
            setMapHeight(SCREEN_WIDTH * (h / w));
          }
        },
        () => {}
      );
    }
  }, []);

  // Load units from Supabase (with map coords). Usually 1–2 s when connected. Fall back to local list on error/timeout.
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setUnitsError('Taking longer than usual — check your connection.');
        setUnitsLoaded(true);
      }
    }, UNITS_LOAD_TIMEOUT_MS);

    (async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, map_x, map_y')
        .not('map_x', 'is', null)
        .not('map_y', 'is', null);
      if (cancelled) return;
      clearTimeout(timeoutId);
      setUnitsLoaded(true);
      if (error) {
        setUnitsError(error.message || 'Could not load units.');
        return;
      }
      if (data?.length) {
        setUnitsError(null);
        setUnits(
          data.map((r) => {
            const map_x = Number(r.map_x);
            const map_y = Number(r.map_y);
            return {
              id: String(r.id),
              unit_number: r.unit_number ?? '',
              map_x,
              map_y,
              // Supabase has no box; synthetic box so tap-by-region still works
              box: {
                tl_x: map_x - SYNTHETIC_BOX_RADIUS,
                tl_y: map_y - SYNTHETIC_BOX_RADIUS,
                br_x: map_x + SYNTHETIC_BOX_RADIUS,
                br_y: map_y + SYNTHETIC_BOX_RADIUS,
              },
            };
          })
        );
      } else {
        setUnitsError('No units found. Sign in with an active account to create tickets.');
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  // Hit area size for each unit (easy to tap)
  const HIT_SIZE = 56;
  const HIT_HALF = HIT_SIZE / 2;

  // Where the map image draws (resizeMode="contain"): use actual asset size so letterboxing matches
  const displayRect = (() => {
    const w = SCREEN_WIDTH;
    const h = mapHeight;
    const imgW = imageSize?.width ?? MAP_IMAGE_WIDTH;
    const imgH = imageSize?.height ?? MAP_IMAGE_HEIGHT;
    const scale = Math.min(w / imgW, h / imgH);
    const displayW = imgW * scale;
    const displayH = imgH * scale;
    const offsetX = (w - displayW) / 2;
    const offsetY = (h - displayH) / 2;
    return { offsetX, offsetY, displayW, displayH };
  })();

  // Unit coords are in MAP_IMAGE space (2468×1657). Map image draws in (displayW×displayH) at (offsetX, offsetY).
  // So map (map_x, map_y) → view (offsetX + map_x/2468*displayW, offsetY + map_y/1657*displayH)
  const mapToViewX = (mapX: number) =>
    displayRect.offsetX + (mapX / MAP_IMAGE_WIDTH) * displayRect.displayW;
  const mapToViewY = (mapY: number) =>
    displayRect.offsetY + (mapY / MAP_IMAGE_HEIGHT) * displayRect.displayH;

  if (!fontsLoaded) {
    return null;
  }

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
        <Text style={styles.pinchHint}>Pinch to zoom • Tap a unit on the map</Text>
        {hasSession === false && (
          <View style={styles.signInBanner}>
            <Text style={styles.signInBannerText}>Sign in to select units and create tickets.</Text>
            <TouchableOpacity style={styles.signInBannerButton} onPress={navigateToSignIn}>
              <Text style={styles.signInBannerButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        )}
        {!unitsLoaded && (
          <Text style={styles.unitsStatus}>Loading units… (usually 1–2 s when connected)</Text>
        )}
        {unitsLoaded && unitsError && (
          <Text style={styles.unitsError}>{unitsError}</Text>
        )}
        <View style={{ height: 10 }} />
        {mapHeight > 0 ? (
          <View style={[styles.mapViewport, { height: mapHeight }]}>
            <ScrollView
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
                  style={[styles.mapOverlay, { width: SCREEN_WIDTH, height: mapHeight }]}
                  pointerEvents="box-none"
                >
                  {units.map((unit) => (
                    <TouchableOpacity
                      key={unit.id}
                      style={[
                        styles.unitHitArea,
                        {
                          left: mapToViewX(unit.map_x) - HIT_HALF + MAP_X_OFFSET,
                          top: mapToViewY(unit.map_y) - HIT_HALF + MAP_Y_OFFSET,
                          width: HIT_SIZE,
                          height: HIT_SIZE,
                        },
                      ]}
                      onPress={() => setSelectedUnit(unit)}
                      activeOpacity={0.7}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.mapViewport, { height: DEFAULT_MAP_HEIGHT }]}>
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
            {hasSession ? (
              <TouchableOpacity
                style={styles.createTicketButton}
                onPress={async () => {
                  const unitForTicket = selectedUnit;
                  const isRealUnitId = unitForTicket && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitForTicket.id);
                  if (!isRealUnitId) {
                    Alert.alert(
                      'Unit list loading',
                      'Please wait for the unit list to load from the server, then select a unit and try again. (The map is showing placeholder data.)',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
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
                  setSelectedUnit(null);
                  if (!result.canceled && result.assets[0] && unitForTicket) {
                    router.push({
                      pathname: '/tickets/create',
                      params: {
                        unitId: unitForTicket.id,
                        unitName: unitForTicket.unit_number,
                        photoUri: result.assets[0].uri,
                      },
                    });
                  }
                }}
              >
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.createTicketButtonText}>Create a ticket</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.signInModalBlock}>
                <Text style={styles.signInModalText}>Sign in to create a ticket.</Text>
                <TouchableOpacity style={styles.createTicketButton} onPress={() => { setSelectedUnit(null); navigateToSignIn(); }}>
                  <Text style={styles.createTicketButtonText}>Sign in</Text>
                </TouchableOpacity>
              </View>
            )}
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
  signInBanner: {
    backgroundColor: '#4a4a4a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  signInBannerText: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'Inter_400Regular',
    marginBottom: 10,
    textAlign: 'center',
  },
  signInBannerButton: {
    backgroundColor: '#f2681c',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  signInBannerButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  signInModalBlock: {
    alignItems: 'center',
    marginTop: 8,
  },
  signInModalText: {
    fontSize: 14,
    color: '#aaa',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    textAlign: 'center',
  },
  unitsStatus: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  unitsError: {
    fontSize: 12,
    color: '#f2681c',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  unitsReady: {
    fontSize: 12,
    color: '#6a9',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
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
  mapImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3b3b3b',
  },
  mapInner: {
    position: 'relative',
  },
  mapOverlay: {
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#4a4a4a',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
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
