import Redlock from 'redlock';
import client from './redis';

const redlock = new Redlock(
    [client],  // array of redis clients
    {
        driftFactor : 0.01,
        retryCount : 3, // how many times to retry acquiring lock
        retryDelay: 200, //ms between retries
        retryJitter: 100, 
        automaticExtensionThreshold: 500 // ms before expiry to auto extend if needed
    }
);

redlock.on('error', (err)=>{
    console.error('Redlock error:', err.message);
});

export default redlock;