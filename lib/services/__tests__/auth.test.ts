/**
 * Auth service tests
 *
 * Pattern: mock Supabase → call our function → assert on the result.
 * We never hit the real API; we control what Supabase "returns" via the mock.
 *
 * --- HOW THE MOCK AT THE TOP WORKS ---
 * 1. We create fake functions (mockSignInWithPassword, mockSignOut, mockSignUp) that
 *    we control. In each test we say "when this is called, return this value."
 * 2. jest.mock('../../supabase/client', () => ({ ... })) replaces the REAL Supabase
 *    client with an object that has the same shape (supabase.auth.signInWithPassword,
 *    etc.) but those methods just call OUR fakes instead of the real API.
 * 3. When auth.ts runs signIn(), it imports supabase from '../supabase/client'.
 *    Jest gives it our fake, so signIn() actually calls mockSignInWithPassword.
 *    We decide what that returns (mockResolvedValueOnce), so we can test success
 *    or failure without touching the network.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getCurrentUser, getSession, resetPasswordForEmail, signIn, signOut, signUp } from '../auth';

// Fake Supabase auth methods. We define them BEFORE the mock so the mock can use them.
const mockSignInWithPassword = jest.fn<(opts: { email: string; password: string }) => Promise<{ data: { user: unknown }; error: { message?: string } | null }>>();
const mockSignOut = jest.fn<() => Promise<{ error: { message?: string } | null }>>();
const mockSignUp = jest.fn<(opts?: unknown) => Promise<{ data: { user: unknown }; error: { message?: string } | null }>>();
// auth.ts calls supabase.auth.resetPasswordForEmail(email, { redirectTo }), not resetPassword
const mockResetPasswordForEmail = jest.fn<(email: string, opts?: { redirectTo?: string }) => Promise<{ error: { message?: string } | null }>>();
const mockGetUser = jest.fn<() => Promise<{ data: { user: unknown } }>>();
const mockGetSession = jest.fn<() => Promise<{ data: { session: unknown } }>>();

// Replace the real Supabase client with our fakes. auth.ts imports from '../../supabase/client'
// (from its perspective; from __tests__ the path is ../../supabase/client).
jest.mock('../../supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (opts: { email: string; password: string }) => mockSignInWithPassword(opts),
      signOut: () => mockSignOut(),
      signUp: (opts: unknown) => mockSignUp(opts), // must CALL mockSignUp and return its Promise
      resetPasswordForEmail: (email: string, opts?: { redirectTo?: string }) => mockResetPasswordForEmail(email, opts),
      getUser: () => mockGetUser(),
      getSession: () => mockGetSession(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});
// whole test
describe('signIn', () => {
// test function for case: sign in works
  it('returns success and user when Supabase sign-in succeeds', async () => {
    // make fake iser
    const fakeUser = { id: 'user-123', email: 'test@example.com' };
    // when signinwithpassword is caled with these arguments,
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    });

    const result = await signIn('test@example.com', 'password123');

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    expect(result.user).toEqual(fakeUser);
    expect(result.error).toBeUndefined();
  });

// test function for case: sign in fails
  it('returns failure and error message when Supabase returns an error', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    const result = await signIn('bad@example.com', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid login credentials');
    expect(result.user).toBeUndefined();
  });
});

describe('signOut', () => {
  it('returns success when Supabase sign-out succeeds', async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });

    const result = await signOut();

    expect(mockSignOut).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('returns failure when Supabase sign-out returns an error', async () => {
    mockSignOut.mockResolvedValueOnce({ error: { message: 'Network error' } });

    const result = await signOut();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

describe('signUp', () => {
  it('returns success and user when Supabase sign-up succeeds', async () => {
    const fakeUser = { id: 'user-456', email: 'dukedoof@gmail.com' };
    mockSignUp.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    });

    const signUpData = {
      firstName: 'Duke',
      lastName: 'Doof',
      email: 'dukedoof@gmail.com',
      password: 'Doofus',
      phone: '8609638545',
      role: 'Subcontractor' as const,
      trade: 'HVAC' as const,
    };

    const result = await signUp(signUpData);

    expect(mockSignUp).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.user).toEqual(fakeUser);
    expect(result.error).toBeUndefined();
  });

  it ('returns failure and error message when Supabase returns an error', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    const signUpData = {
      firstName: 'Duke',
      lastName: 'Doof',
      email: 'dukedoof@gmail.com',
      password: 'Doofus',
      phone: '8609638545',
      role: 'Subcontractor' as const,
    };

    const result = await signUp(signUpData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('User already registered');
    expect(result.user).toBeUndefined();
  });
});

describe('resetPasswordForEmail', () => {
  it('returns success when Supabase reset-password email succeeds', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    const result = await resetPasswordForEmail('dukedoof@gmail.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('dukedoof@gmail.com', { redirectTo: undefined });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('passes redirectTo to Supabase when provided', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

    await resetPasswordForEmail('u@example.com', { redirectTo: 'fireside://reset-password' });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('u@example.com', {
      redirectTo: 'fireside://reset-password',
    });
  });

  it('returns failure and error message when Supabase returns an error', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'User already reset password' },
    });

    const result = await resetPasswordForEmail('dukedoof@gmail.com');

    expect(result.success).toBe(false);
    expect(result.error).toBe('User already reset password');
  });

  it('rewrites rate limit (429) error to user-friendly message', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: '429 Too Many Requests' },
    });

    const result = await resetPasswordForEmail('user@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many reset attempts');
    expect(result.error).toContain('15');
  });

  it('rewrites "rate limit" error to user-friendly message', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Rate limit exceeded for this endpoint' },
    });

    const result = await resetPasswordForEmail('user@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many reset attempts');
  });

  it('rewrites email not authorized error to user-friendly message', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Email not authorized for this project' },
    });

    const result = await resetPasswordForEmail('user@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
    expect(result.error).toContain('password reset');
  });
});

describe('getCurrentUser', () => {
  it('returns user when Supabase returns a user', async () => {
    const fakeUser = { id: 'user-1', email: 'u@example.com' };
    mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser } });

    const result = await getCurrentUser();

    expect(mockGetUser).toHaveBeenCalled();
    expect(result).toEqual(fakeUser);
  });

  it('returns null when Supabase returns no user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });
});

describe('getSession', () => {
  it('returns session when Supabase returns a session', async () => {
    const fakeSession = { access_token: 'tok', user: { id: 'u1' } };
    mockGetSession.mockResolvedValueOnce({ data: { session: fakeSession } });

    const result = await getSession();

    expect(mockGetSession).toHaveBeenCalled();
    expect(result).toEqual(fakeSession);
  });

  it('returns null when Supabase returns no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await getSession();

    expect(result).toBeNull();
  });
});
