import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nz.co.caterstation.staffapp',
  appName: 'CaterStation',
  webDir: 'mobile-shell',
  server: {
    url: 'https://caterstation1.vercel.app',
    cleartext: false,
    allowNavigation: [
      'caterstation1.vercel.app',
      '*.vercel.app',
    ],
  },
  plugins: {
    Geolocation: {
      permissionsPrompt: true,
    },
  },
};

export default config;
