/**
 * Test Upstash Redis Connection
 * 
 * Run: node test-upstash.js
 */

import { initUpstashRedis, checkRedisHealth, getRedis } from './src/cache/upstashClient.js';
import { setCache, getCache, delCache } from './src/cache/cacheService.js';

async function testUpstash() {
  console.log('🧪 Testing Upstash Redis Connection...\n');
  
  // Initialize
  initUpstashRedis();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check health
  console.log('1. Checking Redis health...');
  const health = await checkRedisHealth();
  console.log('   Health:', health);
  
  if (!health.connected) {
    console.error('❌ Redis not connected. Please check your credentials.');
    process.exit(1);
  }
  
  console.log('✅ Redis connected!\n');
  
  // Test cache operations
  console.log('2. Testing cache operations...');
  
  // Test set
  const testKey = 'test:upstash:connection';
  const testValue = { message: 'Hello Upstash!', timestamp: Date.now() };
  
  console.log('   Setting cache...');
  await setCache(testKey, testValue, 60);
  console.log('   ✅ Cache set');
  
  // Test get
  console.log('   Getting cache...');
  const retrieved = await getCache(testKey);
  console.log('   Retrieved:', retrieved);
  
  if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
    console.log('   ✅ Cache get successful');
  } else {
    console.error('   ❌ Cache get failed - values do not match');
    process.exit(1);
  }
  
  // Test delete
  console.log('   Deleting cache...');
  await delCache(testKey);
  const afterDelete = await getCache(testKey);
  
  if (afterDelete === null) {
    console.log('   ✅ Cache delete successful');
  } else {
    console.error('   ❌ Cache delete failed');
    process.exit(1);
  }
  
  console.log('\n🎉 All tests passed! Upstash Redis is working correctly.');
}

testUpstash().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

