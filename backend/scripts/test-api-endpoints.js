/**
 * Test API endpoints to debug Internal Server Error
 * 
 * Usage:
 *   node scripts/test-api-endpoints.js heng36
 */

import fetch from 'node-fetch';

const theme = process.argv[2] || 'heng36';
const API_BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, endpoint, method = 'GET', body = null) {
  try {
    const url = `${API_BASE_URL}${endpoint}?theme=${theme}`;
    console.log(`\n🧪 Testing ${name}:`);
    console.log(`   URL: ${url}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Theme': theme,
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Success (${response.status})`);
      if (Array.isArray(data)) {
        console.log(`   📊 Results: ${data.length} items`);
      } else if (typeof data === 'object') {
        console.log(`   📊 Response keys: ${Object.keys(data).join(', ')}`);
      }
    } else {
      console.log(`   ❌ Error (${response.status}):`);
      console.log(`   Message: ${data.error || data.message || 'Unknown error'}`);
      if (data.code) {
        console.log(`   Code: ${data.code}`);
      }
      if (data.detail) {
        console.log(`   Detail: ${data.detail}`);
      }
      if (data.hint) {
        console.log(`   Hint: ${data.hint}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Network Error:`);
    console.log(`   ${error.message}`);
  }
}

async function main() {
  console.log(`\n🔍 Testing API Endpoints for theme: ${theme}`);
  console.log(`   API Base URL: ${API_BASE_URL}\n`);
  
  // Test health endpoint
  await testEndpoint('Health Check', '/health');
  
  // Test games endpoint (get all games)
  await testEndpoint('Get All Games', '/api/games');
  
  // Test get game by ID (using a sample game ID - adjust if needed)
  // First, let's get all games to find a valid game ID
  try {
    const gamesResponse = await fetch(`${API_BASE_URL}/api/games?theme=${theme}`);
    if (gamesResponse.ok) {
      const games = await gamesResponse.json();
      if (games.length > 0) {
        const gameId = games[0].id;
        await testEndpoint('Get Game Data', `/api/games/${gameId}`);
        await testEndpoint('Get Answers', `/api/answers/${gameId}`);
      } else {
        console.log('\n⚠️  No games found. Skipping game-specific tests.');
      }
    }
  } catch (error) {
    console.log('\n⚠️  Could not fetch games list. Skipping game-specific tests.');
  }
  
  // Test users endpoint
  await testEndpoint('Get All Users', '/api/users');
  
  console.log('\n✅ Testing complete!\n');
}

main().catch(console.error);
