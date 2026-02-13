/**
 * Tickets service tests.
 * Mocks: supabase.storage, expo-file-system, expo-image-manipulator.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getSignedTicketPhotoUrl, uploadTicketPhoto } from '../tickets';

// --- Mocks for uploadTicketPhoto ---
const mockManipulateAsync = jest.fn<
  () => Promise<{ uri: string }>
>();
const mockReadAsStringAsync = jest.fn<
  (uri: string, opts: { encoding: 'base64' }) => Promise<string>
>();
const mockStorageUpload = jest.fn<
  (path: string, bytes: Uint8Array, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message?: string } | null }>
>();
const mockGetPublicUrl = jest.fn<(path: string) => { data: { publicUrl: string } }>();

// --- Mocks for getSignedTicketPhotoUrl ---
const mockCreateSignedUrl = jest.fn<
  (path: string, expirySec: number) => Promise<{ data: { signedUrl: string } | null; error: { message?: string } | null }>
>();

jest.mock('../../supabase/client', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: (...args: Parameters<typeof mockStorageUpload>) => mockStorageUpload(...args),
        getPublicUrl: (path: string) => mockGetPublicUrl(path),
        createSignedUrl: (path: string, expiry: number) => mockCreateSignedUrl(path, expiry),
      })),
    },
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (uri: string, opts: { encoding: 'base64' }) => mockReadAsStringAsync(uri, opts),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (..._args: unknown[]) => mockManipulateAsync(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Default: upload succeeds, getPublicUrl returns a URL
  mockStorageUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/ticket-photos/user1/abc.jpg' } });
  mockManipulateAsync.mockResolvedValue({ uri: 'file:///prepared.jpg' });
  mockReadAsStringAsync.mockResolvedValue('YWJj'); // base64 for "abc"
});

describe('uploadTicketPhoto', () => {
  it('returns public URL when upload succeeds', async () => {
    const url = await uploadTicketPhoto('file:///local/photo.jpg', 'user-123');

    expect(mockManipulateAsync).toHaveBeenCalled();
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///prepared.jpg', { encoding: 'base64' });
    expect(mockStorageUpload).toHaveBeenCalled();
    expect(mockGetPublicUrl).toHaveBeenCalled();
    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/ticket-photos/user1/abc.jpg');
  });

  it('throws when storage upload returns an error', async () => {
    mockStorageUpload.mockResolvedValueOnce({ error: { message: 'Storage quota exceeded' } });

    await expect(uploadTicketPhoto('file:///local/photo.jpg', 'user-123'))
      .rejects.toThrow('Storage quota exceeded');
  });
});

describe('getSignedTicketPhotoUrl', () => {
  it('returns signed URL when photo URL is from our bucket and signing succeeds', async () => {
    const publicUrl = 'https://project.supabase.co/storage/v1/object/public/ticket-photos/user1/photo.jpg';
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://signed.example.com/photo.jpg?token=xyz' },
      error: null,
    });

    const result = await getSignedTicketPhotoUrl(publicUrl);

    expect(mockCreateSignedUrl).toHaveBeenCalledWith('user1/photo.jpg', 3600);
    expect(result).toBe('https://signed.example.com/photo.jpg?token=xyz');
  });

  it('returns original URL when photoUrl is null or empty', async () => {
    expect(await getSignedTicketPhotoUrl(null)).toBeNull();
    expect(await getSignedTicketPhotoUrl('')).toBeNull();
    expect(await getSignedTicketPhotoUrl('   ')).toBeNull();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('returns original URL when signing fails', async () => {
    const publicUrl = 'https://project.supabase.co/storage/v1/object/public/ticket-photos/user1/photo.jpg';
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const result = await getSignedTicketPhotoUrl(publicUrl);

    expect(result).toBe(publicUrl);
  });

  it('returns original URL when URL is not from our bucket', async () => {
    const otherUrl = 'https://other-cdn.com/image.jpg';

    const result = await getSignedTicketPhotoUrl(otherUrl);

    expect(result).toBe(otherUrl);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});
