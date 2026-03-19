import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSignedTicketPhotoUrl } from '../lib/services/tickets';

type TicketPhotoProps = {
  uri: string | null;
  style?: object;
  placeholderStyle?: object;
  resizeMode?: 'cover' | 'contain';
  onError?: () => void;
};

export function TicketPhoto({
  uri,
  style,
  placeholderStyle,
  resizeMode = 'cover',
  onError,
}: TicketPhotoProps) {
  const [signedUri, setSignedUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uri) {
      setSignedUri(null);
      setFailed(true);
      return;
    }
    let cancelled = false;
    setFailed(false);
    getSignedTicketPhotoUrl(uri).then((url) => {
      if (!cancelled && url) setSignedUri(url);
      else if (!cancelled) setSignedUri(uri);
    });
    return () => { cancelled = true; };
  }, [uri]);

  const showPlaceholder = !signedUri || failed;
  if (showPlaceholder) {
    return (
      <View style={[styles.placeholder, style, placeholderStyle]}>
        <Ionicons name="image-outline" size={32} color="#666" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: signedUri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
