import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.mediasender.app',
    appName: '12',
    webDir: 'src',
    server: {
        androidScheme: 'https'
    },
    plugins: {
        Camera: {
            permissions: ['camera', 'photos']
        }
    }
};

export default config;
