import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reino.assistant',
  appName: 'Reino',
  webDir: 'dist',
  server: {
    // For production, point to your Render backend URL
    // androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d0d1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0d0d1a',
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0d0d1a',
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
