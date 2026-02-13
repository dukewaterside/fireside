// Import the Supabase client we created
// We use this to make authentication requests to Supabase
import { supabase } from '../supabase/client';
import { TRADE_LABELS } from '../constants/tickets';

// Define TypeScript types for better code safety and autocomplete
// This tells TypeScript what shape our data should have
export interface AuthResponse {
  success: boolean;        // Did the operation succeed?
  error?: string;          // Error message if something went wrong (optional)
  user?: any;             // The user object if successful (optional)
  needsEmailVerification?: boolean; // True when Supabase requires email confirmation before full sign-in
}

// Define the possible user roles in the system
export type UserRole = 'Subcontractor' | 'Project Manager' | 'Owner' | 'Designer';

// Define the possible trades (only for subcontractors)
export type Trade = keyof typeof TRADE_LABELS;

// Define the structure of user data we'll collect during signup
export interface SignUpData {
  firstName: string;      // User's first name
  lastName: string;       // User's last name
  phone: string;          // User's phone number
  email: string;          // User's email address
  password: string;        // User's password
  role: UserRole;         // User's role in the system
  trade?: Trade;          // User's trade (only if they're a subcontractor, optional)
  assignedUnitIds?: string[]; // Unit UUIDs (only if Project Manager or Designer)
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
 * Helper function to convert form role names to database role format
 * The form uses display names like "Project Manager" but the database uses snake_case like "project_manager"
 */
function mapRoleToDatabase(role: UserRole): string {
  const roleMap: Record<UserRole, string> = {
    'Subcontractor': 'subcontractor',
    'Project Manager': 'project_manager',
    'Owner': 'owner',
    'Designer': 'designer',
  };
  return roleMap[role];
}

/**
 * Helper function to convert form trade names to database trade format
 * The form uses capitalized names like "Framing" but the database uses lowercase like "framing"
 */
function mapTradeToDatabase(trade: Trade): string {
  return trade;
}

/**
 * Create a new user account
 * 
 * This function does two things:
 * 1. Creates the user in Supabase Auth (handles authentication)
 * 2. Creates a profile record in the profiles table (stores user profile data)
 * 
 * @param signUpData - All the user information needed to create an account
 * @returns An object with success status, error message (if any), and user data (if successful)
 */
export async function signUp(signUpData: SignUpData): Promise<AuthResponse> {
  try {
    // Create the user in Supabase Auth
    // The database trigger automatically creates the profile
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signUpData.email,
      password: signUpData.password,
      options: {
        data: {
          first_name: signUpData.firstName,
          last_name: signUpData.lastName,
          phone: signUpData.phone,
          role: mapRoleToDatabase(signUpData.role),
          trade: signUpData.trade ? mapTradeToDatabase(signUpData.trade) : null,
        },
      },
    });

    if (authError) {
      return {
        success: false,
        error: authError.message || 'Failed to create account',
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Failed to create user account',
      };
    }

    return {
      success: true,
      user: authData.user,
      needsEmailVerification: !authData.session,
    };
  } catch (err) {
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
  
  return session; // Return the session object, or null if not logged in
}

/**
 * Send a "forgot password" / password-reset email to a user
 *
 * Supabase sends an email with a magic link. When the user clicks it, they’re
 * redirected to the URL you pass as `redirectTo`. That URL must be allowed in
 * your project’s Auth → URL Configuration → Redirect URLs in the Supabase
 * dashboard (e.g. `fireside://reset-password`).
 *
 * After the user opens that link, your app receives a URL with tokens in the
 * hash. You call setSession with those tokens, then let them set a new password
 * with supabase.auth.updateUser({ password: newPassword }).
 *
 * @param email - The user’s email address (must exist in your project)
 * @param options.redirectTo - Where to send the user after they click the link
 *   (e.g. `fireside://reset-password`). Must be in Supabase’s redirect allow list.
 * @returns Success or error, plus a user-friendly message
 */
export async function resetPasswordForEmail(
  email: string,
  options?: { redirectTo?: string }
): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: options?.redirectTo,
    });

    if (error) {
      let message = error.message;
      if (error.message?.toLowerCase().includes('rate limit') || error.message?.includes('429')) {
        message =
          'Too many reset attempts. Please wait 15–30 minutes and try again.';
      }
      if (error.message?.toLowerCase().includes('email') && error.message?.toLowerCase().includes('authorized')) {
        message =
          'This email is not allowed for password reset. Use an account that’s part of this project, or configure SMTP in Supabase.';
      }
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}