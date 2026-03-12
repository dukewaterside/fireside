// Import the Supabase client we created
// We use this to make authentication requests to Supabase
import { supabase } from '../supabase/client';

// Define TypeScript types for better code safety and autocomplete
// This tells TypeScript what shape our data should have
export interface AuthResponse {
  success: boolean;        // Did the operation succeed?
  error?: string;          // Error message if something went wrong (optional)
  user?: any;             // The user object if successful (optional)
  needsEmailVerification?: boolean; // True when Supabase requires email confirmation before full sign-in
}

/**
 * Sign in an existing user with email and password
 * 
 * @param email - The user's email address
 * @param password - The user's password
 * @returns An object with success status, error message (if any), and user data (if successful)
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    // Call Supabase's signInWithPassword method
    // This sends the email and password to Supabase's authentication server
    // The 'await' keyword waits for the response before continuing
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,      // Pass the email parameter
      password: password, // Pass the password parameter
    });

    // Check if there was an error during sign in
    if (error) {
      // If there's an error, return a failure response with the error message
      // Supabase provides helpful error messages like "Invalid login credentials"
      return {
        success: false,
        error: error.message, // Extract the error message from the error object
      };
    }

    // If we get here, sign in was successful!
    // Return a success response with the user data
    return {
      success: true,
      user: data.user, // The user object contains info like id, email, etc.
    };
  } catch (err) {
    // Catch any unexpected errors (like network failures)
    // This is a safety net in case something goes wrong that Supabase didn't catch
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Sign out the current user
 * 
 * @returns An object with success status and error message (if any)
 */
export async function signOut(): Promise<AuthResponse> {
  try {
    // Call Supabase's signOut method
    // This clears the user's session and logs them out
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get the currently authenticated user
 * 
 * @returns The current user object, or null if no user is logged in
 */
export async function getCurrentUser() {
  // Get the current session from Supabase
  // This checks if there's a saved session in AsyncStorage
  const { data: { user } } = await supabase.auth.getUser();
  
  return user; // Return the user object, or null if not logged in
}

/**
 * Get the current session
 * 
 * @returns The current session object, or null if no session exists
 */
export async function getSession() {
  // Get the full session (includes user + access token)
  const { data: { session } } = await supabase.auth.getSession();
  
  return session; // Return the session object, or null if no session exists
}
