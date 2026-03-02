import { router } from 'expo-router';

/**
 * Navigate to the sign-in screen. Use this for all "Sign in" buttons.
 * /sign-in is a root-level route so it works from tabs and anywhere.
 */
export function navigateToSignIn(): void {
  router.push('/sign-in');
}
