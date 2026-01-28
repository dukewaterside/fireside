// Import the createClient function from Supabase's JavaScript client library
// This is the main function we use to connect to our Supabase backend
import { createClient } from '@supabase/supabase-js';

// This polyfill is required for Supabase to work in React Native
// React Native doesn't have the URL API that web browsers have, so this adds it
import 'react-native-url-polyfill/auto';

// AsyncStorage is React Native's way of storing data persistently on the device
// We need this so Supabase can save the user's session (login state) even after the app closes
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import our configuration constants (the Supabase URL and key)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';

// Create and export the Supabase client instance
// This is a single instance that we'll use throughout the app to interact with Supabase
export const supabase = createClient(
  // First argument: Your Supabase project URL
  SUPABASE_URL,
  // Second argument: Your Supabase anonymous/public key (safe to expose in client apps)
  SUPABASE_ANON_KEY,
  // Third argument: Configuration options
  {
    auth: {
      // Tell Supabase to use AsyncStorage to save the user's session
      // This means when they close the app and reopen it, they'll still be logged in
      storage: AsyncStorage,
      
      // Automatically refresh the authentication token when it's about to expire
      // This keeps users logged in without them having to sign in again
      autoRefreshToken: true,
      
      // Save the session to storage so it persists across app restarts
      persistSession: true,
      
      // Don't try to detect sessions from URL (that's a web-only feature)
      // React Native doesn't have URLs like web browsers do
      detectSessionInUrl: false,
    },
  }
);