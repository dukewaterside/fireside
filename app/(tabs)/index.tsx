import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { navigateToSignIn } from '../../lib/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { compareUnitNumbers } from '../../lib/utils/unitSort';
import { formatPhoneNumberDisplay } from '../../lib/utils/phone';
import {
  completeHomeDemo,
  getHomeDemoProgress,
  isHomeDemoPending,
  markHomeDemoStep,
} from '../../lib/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Map coordinate space: your box coords (Top-Left X,Y and Bottom-Right X,Y) live in 0..MAP_W x 0..MAP_H.
const MAP_IMAGE_WIDTH = 1924;
const MAP_IMAGE_HEIGHT = 1657;

const MAP_SOURCE = require('../../assets/labeledmap.jpeg');

// Optional nudge if hit areas are slightly off (view pixels).
const MAP_X_OFFSET = 0;
const MAP_Y_OFFSET = 0;

type MapUnitBox = { tl_x: number; tl_y: number; br_x: number; br_y: number };

function centerOf(box: MapUnitBox): { map_x: number; map_y: number } {
  return {
    map_x: Math.round((box.tl_x + box.br_x) / 2),
    map_y: Math.round((box.tl_y + box.br_y) / 2),
  };
}

// Each unit: id, label, and box (Top-Left, Bottom-Right) in map coords. map_x/map_y = center of box.
const UNITS_RAW: { id: string; unit_number: string; box: MapUnitBox }[] = [
  { id: '1', unit_number: 'Uphill 1A', box: { tl_x: 13, tl_y: 246, br_x: 148, br_y: 298 } },
  { id: '2', unit_number: 'Uphill 1B', box: { tl_x: 150, tl_y: 375, br_x: 300, br_y: 430 } },
  { id: '3', unit_number: 'Uphill 2A', box: { tl_x: 305, tl_y: 270, br_x: 445, br_y: 325 } },
  { id: '4', unit_number: 'Uphill 2B', box: { tl_x: 392, tl_y: 430, br_x: 534, br_y: 485 } },
  { id: '5', unit_number: 'Single Family 3', box: { tl_x: 515, tl_y: 345, br_x: 668, br_y: 400 } },
  { id: '6', unit_number: 'Slopeside 4A', box: { tl_x: 598, tl_y: 432, br_x: 748, br_y: 485 } },
  { id: '7', unit_number: 'Slopeside 4B', box: { tl_x: 762, tl_y: 298, br_x: 908, br_y: 350 } },
  { id: '8', unit_number: 'Downhill 5A', box: { tl_x: 948, tl_y: 698, br_x: 1098, br_y: 750 } },
  { id: '9', unit_number: 'Downhill 5B', box: { tl_x: 948, tl_y: 578, br_x: 1098, br_y: 630 } },
  { id: '10', unit_number: 'Downhill 6A', box: { tl_x: 600, tl_y: 655, br_x: 753, br_y: 710 } },
  { id: '11', unit_number: 'Downhill 6B', box: { tl_x: 775, tl_y: 735, br_x: 925, br_y: 788 } },
  { id: '12', unit_number: 'Downhill 7A', box: { tl_x: 405, tl_y: 660, br_x: 548, br_y: 712 } },
  { id: '13', unit_number: 'Downhill 7B', box: { tl_x: 498, tl_y: 755, br_x: 645, br_y: 808 } },
  { id: '14', unit_number: 'Downhill 8A', box: { tl_x: 175, tl_y: 608, br_x: 318, br_y: 660 } },
  { id: '15', unit_number: 'Downhill 8B', box: { tl_x: 272, tl_y: 780, br_x: 425, br_y: 833 } },
  { id: '16', unit_number: 'Uphill 9A', box: { tl_x: 362, tl_y: 1120, br_x: 505, br_y: 1175 } },
  { id: '17', unit_number: 'Uphill 9B', box: { tl_x: 570, tl_y: 1175, br_x: 715, br_y: 1230 } },
  { id: '18', unit_number: 'Uphill 10A', box: { tl_x: 573, tl_y: 1005, br_x: 720, br_y: 1058 } },
  { id: '19', unit_number: 'Uphill 10B', box: { tl_x: 765, tl_y: 1092, br_x: 915, br_y: 1145 } },
  { id: '20', unit_number: 'Single Family 11', box: { tl_x: 838, tl_y: 975, br_x: 990, br_y: 1028 } },
  { id: '21', unit_number: 'Uphill 12A', box: { tl_x: 970, tl_y: 1055, br_x: 1118, br_y: 1108 } },
  { id: '22', unit_number: 'Uphill 12B', box: { tl_x: 1062, tl_y: 860, br_x: 1213, br_y: 915 } },
  { id: '23', unit_number: 'Uphill 13A', box: { tl_x: 1175, tl_y: 982, br_x: 1325, br_y: 1035 } },
  { id: '24', unit_number: 'Uphill 13B', box: { tl_x: 1285, tl_y: 828, br_x: 1435, br_y: 882 } },
  { id: '25', unit_number: 'Slopeside 14A', box: { tl_x: 1355, tl_y: 1003, br_x: 1505, br_y: 1056 } },
  { id: '26', unit_number: 'Slopeside 14B', box: { tl_x: 1525, tl_y: 855, br_x: 1670, br_y: 910 } },
  { id: '27', unit_number: 'Hillside End 15A', box: { tl_x: 1725, tl_y: 1287, br_x: 1872, br_y: 1343 } },
  { id: '28', unit_number: 'Hillside End 15B', box: { tl_x: 1725, tl_y: 1158, br_x: 1872, br_y: 1215 } },
  { id: '29', unit_number: 'Hillside End 15C', box: { tl_x: 1778, tl_y: 1015, br_x: 1924, br_y: 1073 } },
  { id: '30', unit_number: 'Hillside End 16A', box: { tl_x: 1448, tl_y: 1400, br_x: 1598, br_y: 1455 } },
  { id: '31', unit_number: 'Hillside End 16B', box: { tl_x: 1490, tl_y: 1290, br_x: 1638, br_y: 1345 } },
  { id: '32', unit_number: 'Hillside End 16C', box: { tl_x: 1540, tl_y: 1205, br_x: 1695, br_y: 1260 } },
  { id: '33', unit_number: 'Hillside End 17A', box: { tl_x: 1228, tl_y: 1515, br_x: 1382, br_y: 1570 } },
  { id: '34', unit_number: 'Hillside End 17C (Lower)', box: { tl_x: 1275, tl_y: 1385, br_x: 1415, br_y: 1440 } },
  { id: '35', unit_number: 'Hillside End 17C (Upper)', box: { tl_x: 1288, tl_y: 1270, br_x: 1435, br_y: 1325 } },
  { id: '36', unit_number: 'Hillside End 18A', box: { tl_x: 895, tl_y: 1622, br_x: 1045, br_y: 1657 } },
  { id: '37', unit_number: 'Hillside End 18C (Lower)', box: { tl_x: 1065, tl_y: 1505, br_x: 1220, br_y: 1560 } },
  { id: '38', unit_number: 'Hillside End 18C (Upper)', box: { tl_x: 1062, tl_y: 1410, br_x: 1218, br_y: 1465 } },
  { id: '39', unit_number: 'Hillside End 19A', box: { tl_x: 648, tl_y: 1318, br_x: 808, br_y: 1370 } },
  { id: '40', unit_number: 'Hillside End 19B', box: { tl_x: 658, tl_y: 1450, br_x: 815, br_y: 1500 } },
  { id: '41', unit_number: 'Hillside End 19C', box: { tl_x: 750, tl_y: 1558, br_x: 910, br_y: 1610 } },
];

const UNITS_FALLBACK: { id: string; unit_number: string; map_x: number; map_y: number; box: MapUnitBox }[] =
  UNITS_RAW.map(({ box, ...rest }) => ({ ...rest, ...centerOf(box), box }));

type ProfileSnippet = { first_name: string | null; last_name: string | null; phone: string | null };
type UnitContactAssignmentRow = {
  unit_id: string;
  assignment_type: 'project_manager' | 'designer';
  contacts:
    | { first_name: string | null; last_name: string | null; phone: string | null }
    | { first_name: string | null; last_name: string | null; phone: string | null }[]
    | null;
};
type MapUnit = {
  id: string;
  unit_number: string;
  map_x: number;
  map_y: number;
  box?: MapUnitBox;
  project_manager_id?: string | null;
  designer_id?: string | null;
  project_manager?: ProfileSnippet | null;
  designer?: ProfileSnippet | null;
  assigned_project_managers?: ProfileSnippet[];
  assigned_designers?: ProfileSnippet[];
  open_count?: number;
};

function displayName(p: ProfileSnippet | null | undefined): string {
  if (!p) return 'Unassigned';
  const first = p.first_name?.trim() ?? '';
  const last = p.last_name?.trim() ?? '';
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return 'Unassigned';
}

function statusColor(openCount: number): string {
  if (openCount === 0) return '#4ade80';
  if (openCount <= 5) return '#facc15';
  return '#f87171';
}

function normalizePhoneForDial(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

// Fixed hit box size in map image coords (same for every unit). Example: TL (9,209) BR (151,254) → 142×45.
const BOX_MAP_WIDTH = 142;
const BOX_MAP_HEIGHT = 45;
const BOX_HALF_W = BOX_MAP_WIDTH / 2;   // 71
const BOX_HALF_H = BOX_MAP_HEIGHT / 2;  // 22.5

/** Every unit uses the same 142×45 box in map space, centered on the unit's (map_x, map_y). */
function getEffectiveBox(unit: MapUnit): MapUnitBox {
  return {
    tl_x: unit.map_x - BOX_HALF_W,
    tl_y: unit.map_y - BOX_HALF_H,
    br_x: unit.map_x + BOX_HALF_W,
    br_y: unit.map_y + BOX_HALF_H,
  };
}

/** Find unit at map coords; if multiple boxes contain the point, pick the one whose center is closest. */
function findUnitAtMapCoords(units: MapUnit[], mapX: number, mapY: number): MapUnit | null {
  let best: MapUnit | null = null;
  let bestDistSq = Infinity;
  for (const unit of units) {
    const b = getEffectiveBox(unit);
    if (mapX >= b.tl_x && mapX <= b.br_x && mapY >= b.tl_y && mapY <= b.br_y) {
      const dx = mapX - unit.map_x;
      const dy = mapY - unit.map_y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = unit;
      }
    }
  }
  return best;
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
  const [unitsListModalVisible, setUnitsListModalVisible] = useState(false);
  const [contactCardPerson, setContactCardPerson] = useState<ProfileSnippet | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showHomeDemo, setShowHomeDemo] = useState(false);
  const [demoInfoType, setDemoInfoType] = useState<'units' | 'tickets' | 'notifications' | null>(null);
  const [homeDemoProgress, setHomeDemoProgress] = useState({
    units: false,
    tickets: false,
    notifications: false,
  });
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setHasSession(!!session);
        setCurrentUserId(session?.user?.id ?? null);
        if (!session) {
          setUnreadCount(0);
          setShowHomeDemo(false);
          setHomeDemoProgress({ units: false, tickets: false, notifications: false });
          return;
        }
        const pending = await isHomeDemoPending(session.user.id);
        if (pending) {
          const progress = await getHomeDemoProgress(session.user.id);
          if (mounted) {
            setHomeDemoProgress(progress);
            setShowHomeDemo(true);
          }
        } else if (mounted) {
          setShowHomeDemo(false);
          setHomeDemoProgress({ units: true, tickets: true, notifications: true });
        }
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .is('read_at', null);
        if (mounted && !error) setUnreadCount(count ?? 0);
      })();
      return () => { mounted = false; };
    }, [])
  );

  const dismissHomeDemo = useCallback(async () => {
    if (!currentUserId) return;
    setShowHomeDemo(false);
    setHomeDemoProgress({ units: true, tickets: true, notifications: true });
    await completeHomeDemo(currentUserId);
  }, [currentUserId]);

  const completeDemoStep = useCallback(async (step: 'units' | 'tickets' | 'notifications') => {
    if (!currentUserId || !showHomeDemo) return;
    const next = await markHomeDemoStep(currentUserId, step);
    const done = next.units && next.tickets && next.notifications;
    setHomeDemoProgress(next);
    setShowHomeDemo(!done);
  }, [currentUserId, showHomeDemo]);

  const closeDemoInfoModal = useCallback(() => setDemoInfoType(null), []);

  const continueDemoInfoModal = useCallback(async () => {
    const type = demoInfoType;
    setDemoInfoType(null);
    if (!type) return;
    if (type === 'units') {
      await completeDemoStep('units');
      setUnitsListModalVisible(true);
      return;
    }
    if (type === 'notifications') {
      await completeDemoStep('notifications');
      router.push('/(tabs)/notifications');
      return;
    }
    router.push('/tickets?demo=1');
  }, [demoInfoType, completeDemoStep]);

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

  // Load units from Supabase (with PM/Designer and open ticket count).
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setUnitsError('Taking longer than usual — check your connection.');
        setUnitsLoaded(true);
      }
    }, UNITS_LOAD_TIMEOUT_MS);

    (async () => {
      const selectUnits =
        'id, unit_number, map_x, map_y, project_manager_id, designer_id, project_manager:profiles!project_manager_id(first_name, last_name, phone), designer:profiles!designer_id(first_name, last_name, phone)';
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select(selectUnits)
        .not('map_x', 'is', null)
        .not('map_y', 'is', null);
      if (cancelled) return;
      if (unitsError) {
        clearTimeout(timeoutId);
        setUnitsLoaded(true);
        setUnitsError(unitsError.message || 'Could not load units.');
        return;
      }
      const { data: openTickets } = await supabase
        .from('tickets')
        .select('unit_id')
        .eq('status', 'open');
      const { data: unitContactAssignments } = await supabase
        .from('unit_contact_assignments')
        .select('unit_id, assignment_type, contacts(first_name, last_name, phone)');
      if (cancelled) return;
      const countByUnit: Record<string, number> = {};
      (openTickets ?? []).forEach((r: { unit_id: string }) => {
        const uid = String(r.unit_id);
        countByUnit[uid] = (countByUnit[uid] ?? 0) + 1;
      });
      const unitContactsById: Record<string, { project_managers: ProfileSnippet[]; designers: ProfileSnippet[] }> = {};
      ((unitContactAssignments ?? []) as UnitContactAssignmentRow[]).forEach((row) => {
        const unitId = String(row.unit_id);
        if (!unitContactsById[unitId]) {
          unitContactsById[unitId] = { project_managers: [], designers: [] };
        }
        const contact = Array.isArray(row.contacts) ? (row.contacts[0] ?? null) : row.contacts;
        if (!contact) return;
        const target = row.assignment_type === 'project_manager'
          ? unitContactsById[unitId].project_managers
          : unitContactsById[unitId].designers;
        const exists = target.some((p) =>
          (p.first_name ?? '') === (contact.first_name ?? '')
          && (p.last_name ?? '') === (contact.last_name ?? '')
          && (p.phone ?? '') === (contact.phone ?? '')
        );
        if (!exists) target.push(contact);
      });
      clearTimeout(timeoutId);
      setUnitsLoaded(true);
      if (unitsData?.length) {
        setUnitsError(null);
        setUnits(
          unitsData.map((r: Record<string, unknown>) => {
            const map_x = Number(r.map_x);
            const map_y = Number(r.map_y);
            const id = String(r.id);
            const existing = unitContactsById[id] ?? { project_managers: [], designers: [] };
            const fallbackPm = (r.project_manager as ProfileSnippet | null) ?? null;
            const fallbackDesigner = (r.designer as ProfileSnippet | null) ?? null;
            const pmList = [...existing.project_managers];
            const designerList = [...existing.designers];
            if (fallbackPm && !pmList.some((p) => displayName(p) === displayName(fallbackPm))) pmList.push(fallbackPm);
            if (fallbackDesigner && !designerList.some((p) => displayName(p) === displayName(fallbackDesigner))) designerList.push(fallbackDesigner);
            return {
              id,
              unit_number: (r.unit_number as string) ?? '',
              map_x,
              map_y,
              project_manager_id: r.project_manager_id as string | null,
              designer_id: r.designer_id as string | null,
              project_manager: (r.project_manager as ProfileSnippet | null) ?? null,
              designer: (r.designer as ProfileSnippet | null) ?? null,
              assigned_project_managers: pmList,
              assigned_designers: designerList,
              open_count: countByUnit[id] ?? 0,
              box: {
                tl_x: map_x - BOX_HALF_W,
                tl_y: map_y - BOX_HALF_H,
                br_x: map_x + BOX_HALF_W,
                br_y: map_y + BOX_HALF_H,
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

  // Image pixel dimensions: use actual loaded asset so coords and display stay in sync.
  const imgW = imageSize?.width ?? MAP_IMAGE_WIDTH;
  const imgH = imageSize?.height ?? MAP_IMAGE_HEIGHT;

  // Where the map image draws (resizeMode="contain"): letterboxed in view
  const displayRect = (() => {
    const w = SCREEN_WIDTH;
    const h = mapHeight;
    const scale = Math.min(w / imgW, h / imgH);
    const displayW = imgW * scale;
    const displayH = imgH * scale;
    const offsetX = (w - displayW) / 2;
    const offsetY = (h - displayH) / 2;
    return { offsetX, offsetY, displayW, displayH };
  })();

  // Map coords (0..MAP_IMAGE_WIDTH, 0..MAP_IMAGE_HEIGHT) → view coords. Same space as your box Top-Left / Bottom-Right.
  const mapToViewX = (mapX: number) =>
    displayRect.offsetX + (mapX / MAP_IMAGE_WIDTH) * displayRect.displayW;
  const mapToViewY = (mapY: number) =>
    displayRect.offsetY + (mapY / MAP_IMAGE_HEIGHT) * displayRect.displayH;

  // View coords → map coords (for tap logging).
  const viewToMapX = (viewX: number) =>
    ((viewX - displayRect.offsetX) / displayRect.displayW) * MAP_IMAGE_WIDTH;
  const viewToMapY = (viewY: number) =>
    ((viewY - displayRect.offsetY) / displayRect.displayH) * MAP_IMAGE_HEIGHT;

  const handleMapPress = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    const { locationX, locationY } = e.nativeEvent;
    const mapX = viewToMapX(locationX);
    const mapY = viewToMapY(locationY);
    const roundedX = Math.round(mapX);
    const roundedY = Math.round(mapY);

    const nearest = [...units]
      .map((u) => {
        const dx = mapX - u.map_x;
        const dy = mapY - u.map_y;
        return { unit: u, distSq: dx * dx + dy * dy };
      })
      .sort((a, b) => a.distSq - b.distSq)
      .slice(0, 3)
      .map(({ unit, distSq }) => `${unit.unit_number} (${Math.round(unit.map_x)}, ${Math.round(unit.map_y)}) d=${Math.round(Math.sqrt(distSq))}`)
      .join(' | ');

    const unit = findUnitAtMapCoords(units, mapX, mapY);
    if (unit) {
      const box = getEffectiveBox(unit);
      console.log(
        `[Map tap] x=${roundedX}, y=${roundedY} -> ${unit.unit_number} center=(${Math.round(unit.map_x)}, ${Math.round(unit.map_y)}) box=[(${Math.round(box.tl_x)}, ${Math.round(box.tl_y)})..(${Math.round(box.br_x)}, ${Math.round(box.br_y)})]`
      );
      setSelectedUnit(unit);
    } else {
      console.log(`[Map tap] x=${roundedX}, y=${roundedY} -> no hit | nearest: ${nearest}`);
    }
  };

  const sortedUnitsForList = useMemo(
    () => [...units].sort((a, b) => compareUnitNumbers(a.unit_number, b.unit_number)),
    [units]
  );

  const callPerson = useCallback((person: ProfileSnippet | null | undefined) => {
    if (!person?.phone?.trim()) {
      Alert.alert('No phone number', `${displayName(person)} does not have a phone number yet.`);
      return;
    }
    Linking.openURL(`tel:${normalizePhoneForDial(person.phone)}`);
  }, []);

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
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.notificationIcon, showHomeDemo && !homeDemoProgress.notifications && styles.demoHighlight]}
            onPress={async () => {
              if (showHomeDemo && !homeDemoProgress.notifications) {
                setDemoInfoType('notifications');
                return;
              }
              router.push('/(tabs)/notifications');
            }}
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileIcon}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Select a Unit</Text>
        <Text style={styles.pinchHint}>Pinch to zoom • Tap a unit on the map</Text>
        {showHomeDemo ? (
          <View style={styles.mapTipCard}>
            <Text style={styles.mapTipTitle}>Map tip</Text>
            <Text style={styles.mapTipText}>Tap a unit on the map, then tap Create Ticket.</Text>
            <TouchableOpacity style={styles.mapTipSkipButton} onPress={dismissHomeDemo}>
              <Text style={styles.mapTipSkipText}>Skip demo</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
                <Pressable
                  style={[StyleSheet.absoluteFill, { width: SCREEN_WIDTH, height: mapHeight }]}
                  onPress={handleMapPress}
                />
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
            style={[styles.actionButton, showHomeDemo && !homeDemoProgress.units && styles.demoHighlight]}
            onPress={async () => {
              if (showHomeDemo && !homeDemoProgress.units) {
                setDemoInfoType('units');
                return;
              }
              setUnitsListModalVisible(true);
            }}
          >
            <Ionicons name="business-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Units</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecond, showHomeDemo && !homeDemoProgress.tickets && styles.demoHighlight]}
            onPress={async () => {
              if (showHomeDemo && !homeDemoProgress.tickets) {
                setDemoInfoType('tickets');
                return;
              }
              router.push(showHomeDemo ? '/tickets?demo=1' : '/tickets');
            }}
          >
            <Ionicons name="ticket-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Tickets</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Units list modal: tap a unit to open same unit detail popup as map tap */}
      <Modal
        visible={unitsListModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUnitsListModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setUnitsListModalVisible(false)}
        >
          <TouchableOpacity style={styles.unitsListModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.unitsListModalTitle}>All Units</Text>
            <Text style={styles.unitsListModalSubtitle}>Click to view</Text>
            <ScrollView style={styles.unitsListScroll}>
              {sortedUnitsForList.map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={styles.unitsListRow}
                  onPress={() => {
                    setUnitsListModalVisible(false);
                    setSelectedUnit(unit);
                  }}
                >
                  <Text style={styles.unitsListRowText}>{unit.unit_number}</Text>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(unit.open_count ?? 0) }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setUnitsListModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={demoInfoType != null} transparent animationType="fade" onRequestClose={closeDemoInfoModal}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeDemoInfoModal}>
          <TouchableOpacity style={styles.demoInfoModal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.demoInfoTitle}>
              {demoInfoType === 'units' ? 'Units' : demoInfoType === 'tickets' ? 'Tickets' : 'Notifications'}
            </Text>
            <Text style={styles.demoInfoText}>
              {demoInfoType === 'units'
                ? 'Here you can open any unit and create a ticket for it. Try tapping a unit now.'
                : demoInfoType === 'tickets'
                  ? 'This is where all tickets live. Open the Demo Ticket and walk through Tagged + Message Board.'
                  : 'This shows your alerts and takes you straight to what changed.'}
            </Text>
            <TouchableOpacity style={styles.demoInfoPrimaryButton} onPress={continueDemoInfoModal}>
              <Text style={styles.demoInfoPrimaryText}>Try it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoInfoSecondaryButton} onPress={closeDemoInfoModal}>
              <Text style={styles.demoInfoSecondaryText}>Not now</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(selectedUnit?.open_count ?? 0) }]} />
              <Text style={styles.statusLabel}>
                {selectedUnit?.open_count === 0
                  ? 'No open tickets'
                  : `${selectedUnit?.open_count ?? 0} open ticket${(selectedUnit?.open_count ?? 0) === 1 ? '' : 's'}`}
              </Text>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabel}>Project Manager</Text>
              {(selectedUnit?.assigned_project_managers?.length ?? 0) > 0 ? (
                <View style={styles.contactList}>
                  {(selectedUnit?.assigned_project_managers ?? []).map((pm, idx) => (
                    <TouchableOpacity key={`${displayName(pm)}-${idx}`} onPress={() => callPerson(pm)}>
                      <Text style={styles.contactLink}>{displayName(pm)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.contactLinkMuted}>Unassigned</Text>
              )}
            </View>
            <View style={styles.contactRow}>
              <Text style={styles.contactLabel}>Designer</Text>
              {(selectedUnit?.assigned_designers?.length ?? 0) > 0 ? (
                <View style={styles.contactList}>
                  {(selectedUnit?.assigned_designers ?? []).map((designer, idx) => (
                    <TouchableOpacity key={`${displayName(designer)}-${idx}`} onPress={() => callPerson(designer)}>
                      <Text style={styles.contactLink}>{displayName(designer)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.contactLinkMuted}>Unassigned</Text>
              )}
            </View>

            {hasSession ? (
              <>
                <TouchableOpacity
                  style={styles.createTicketButton}
                  onPress={() => {
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
                    setSelectedUnit(null);
                    if (unitForTicket) {
                      router.push({
                        pathname: '/tickets/create',
                        params: {
                          unitId: unitForTicket.id,
                          unitName: unitForTicket.unit_number,
                          demoCreate: showHomeDemo ? '1' : undefined,
                        },
                      });
                    }
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.createTicketButtonText}>Create a Ticket</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.viewTicketsButton}
                  onPress={() => {
                    const unitId = selectedUnit?.id;
                    setSelectedUnit(null);
                    if (unitId) router.push({ pathname: '/tickets', params: { unitId } });
                    else router.push('/tickets');
                  }}
                >
                  <Ionicons name="ticket-outline" size={20} color="#fff" />
                  <Text style={styles.viewTicketsButtonText}>View Open Tickets</Text>
                </TouchableOpacity>
              </>
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

      <Modal
        visible={contactCardPerson != null}
        transparent
        animationType="fade"
        onRequestClose={() => setContactCardPerson(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setContactCardPerson(null)}
        >
          <TouchableOpacity style={styles.contactCardContent} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.contactCardTitle}>
              {contactCardPerson ? displayName(contactCardPerson) : ''}
            </Text>
            {contactCardPerson?.phone ? (
              <Text style={styles.contactCardPhone}>{formatPhoneNumberDisplay(contactCardPerson.phone)}</Text>
            ) : (
              <Text style={styles.contactCardPhoneMuted}>No phone number</Text>
            )}
            <View style={styles.contactCardActions}>
              <TouchableOpacity
                style={styles.contactCardButton}
                onPress={() => {
                  if (contactCardPerson?.phone?.trim()) {
                    Linking.openURL(`tel:${normalizePhoneForDial(contactCardPerson.phone)}`);
                  }
                }}
                disabled={!contactCardPerson?.phone?.trim()}
              >
                <Ionicons name="call-outline" size={20} color="#fff" />
                <Text style={styles.contactCardButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactCardButton}
                onPress={() => {
                  if (contactCardPerson?.phone?.trim()) {
                    Linking.openURL(`sms:${normalizePhoneForDial(contactCardPerson.phone)}`);
                  }
                }}
                disabled={!contactCardPerson?.phone?.trim()}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.contactCardButtonText}>Text</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setContactCardPerson(null)}>
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
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#f2681c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  profileIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapTipCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#4a4a4a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f2681c',
    padding: 12,
  },
  mapTipTitle: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  mapTipText: {
    color: '#d1d5db',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  mapTipSkipButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#555',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  mapTipSkipText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  demoInfoModal: {
    width: '88%',
    backgroundColor: '#3b3b3b',
    borderWidth: 1,
    borderColor: '#4a4a4a',
    borderRadius: 14,
    padding: 16,
  },
  demoInfoTitle: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  demoInfoText: {
    marginTop: 8,
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  demoInfoPrimaryButton: {
    marginTop: 14,
    backgroundColor: '#f2681c',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  demoInfoPrimaryText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  demoInfoSecondaryButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#555',
  },
  demoInfoSecondaryText: {
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  demoHighlight: {
    borderWidth: 1.5,
    borderColor: '#f2681c',
    shadowColor: '#f2681c',
    shadowOpacity: 0.35,
    shadowRadius: 8,
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
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
  actionButtonSecond: {
    flex: 1,
    maxWidth: 160,
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
  unitsListModal: {
    backgroundColor: '#4a4a4a',
    borderRadius: 12,
    width: '90%',
    maxWidth: 360,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  unitsListModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  unitsListModalSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#5a5a5a',
  },
  unitsListScroll: {
    maxHeight: 400,
  },
  unitsListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#5a5a5a',
  },
  unitsListRowText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'Inter_400Regular',
  },
  contactRow: {
    marginBottom: 10,
  },
  contactLabel: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  contactLink: {
    fontSize: 16,
    color: '#f2681c',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  contactLinkMuted: {
    fontSize: 15,
    color: '#888',
    fontFamily: 'Inter_400Regular',
  },
  contactList: {
    gap: 4,
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
  viewTicketsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#555',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  viewTicketsButtonText: {
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
  contactCardContent: {
    backgroundColor: '#4a4a4a',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 320,
  },
  contactCardTitle: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
    textAlign: 'center',
  },
  contactCardPhone: {
    fontSize: 15,
    color: '#ccc',
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactCardPhoneMuted: {
    fontSize: 15,
    color: '#888',
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactCardActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 12,
  },
  contactCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f2681c',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  contactCardButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
