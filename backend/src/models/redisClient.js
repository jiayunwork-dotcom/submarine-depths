const redis = require('redis');

let client = null;

function getRedisClient() {
  if (!client) {
    client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    client.on('error', (err) => console.error('Redis Client Error:', err));
    client.connect().catch(console.error);
  }
  return client;
}

async function setWithExpiry(key, value, expirySeconds) {
  const client = getRedisClient();
  await client.setEx(key, expirySeconds, JSON.stringify(value));
}

async function getValue(key) {
  const client = getRedisClient();
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

async function deleteValue(key) {
  const client = getRedisClient();
  await client.del(key);
}

module.exports = { getRedisClient, setWithExpiry, getValue, deleteValue };
