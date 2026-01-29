import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { toByteArray } from 'base64-js';
import { supabase } from '../supabase/client';

const TICKET_PHOTOS_BUCKET = 'ticket-photos';
const MAX_WIDTH = 1200;
const COMPRESS_QUALITY = 0.8;
const SIGNED_URL_EXPIRY_SEC = 3600; // 1 hour

function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    (Math.random() * 16 | 0).toString(16)
  );
}

/**
 * Resize and compress image so upload stays under storage size limits.
 */
async function prepareImageForUpload(uri: string): Promise<{ uri: string; contentType: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: COMPRESS_QUALITY, format: 'jpeg' }
  );
  return { uri: result.uri, contentType: 'image/jpeg' };
}

/**
 * Upload a photo from a local file URI to Supabase Storage and return the public URL.
 * Images are resized (max width 1200px) and compressed to JPEG to avoid exceeding size limits.
 */
export async function uploadTicketPhoto(
  localUri: string,
  userId: string
): Promise<string> {
  const { uri: preparedUri, contentType } = await prepareImageForUpload(localUri);

  const base64 = await FileSystem.readAsStringAsync(preparedUri, {
    encoding: 'base64',
  });
  const bytes = toByteArray(base64);
  const path = `${userId}/${randomId()}.jpg`;

  const { error } = await supabase.storage
    .from(TICKET_PHOTOS_BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload photo');
  }

  const { data } = supabase.storage
    .from(TICKET_PHOTOS_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Extract storage path from a Supabase storage public URL.
 * Format: https://project.supabase.co/storage/v1/object/public/BUCKET/PATH
 */
function pathFromPublicUrl(url: string, bucket: string): string | null {
  try {
    const base = url.split('?')[0];
    const match = base.match(new RegExp(`/object/public/${bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(.+)$`));
    const path = match ? match[1] : null;
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

/**
 * Return a signed URL for a ticket photo so it loads from a private bucket.
 * If the URL is not from our bucket or signing fails, returns the original URL.
 */
export async function getSignedTicketPhotoUrl(photoUrl: string | null): Promise<string | null> {
  if (!photoUrl?.trim()) return null;
  const path = pathFromPublicUrl(photoUrl, TICKET_PHOTOS_BUCKET);
  if (!path) return photoUrl;
  const { data, error } = await supabase.storage
    .from(TICKET_PHOTOS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
  if (error || !data?.signedUrl) return photoUrl;
  return data.signedUrl;
}
