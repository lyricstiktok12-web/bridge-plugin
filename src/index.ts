import Bridge from './bridge';
import BridgeAdapter from './server/bridge-adapter';
import { consola } from 'consola';

const bridge = new Bridge();
let adapter: BridgeAdapter | undefined;

// Initialize API adapter if enabled
const apiEnabled = process.env.ENABLE_API === 'true' || process.env.API_PORT;

if (apiEnabled) {
    adapter = new BridgeAdapter(bridge);
    
    adapter.start().then(() => {
        consola.success('Bridge Bot with API integration started successfully');
    }).catch((error) => {
        consola.error('Failed to start API adapter:', error);
    });
} else {
    consola.info('API adapter disabled. Set ENABLE_API=true to enable.');
}

export { bridge, adapter };
export default bridge;
