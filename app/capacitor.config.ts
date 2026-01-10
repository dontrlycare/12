import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.mediasender.app',
    appName: 'MediaSender',
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
