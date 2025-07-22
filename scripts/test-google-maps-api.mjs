// Simple script to test the Google Maps API key
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the .env file in the project root
dotenv.config({ path: resolve(__dirname, '../.env') });

async function testGoogleMapsAPI() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('Google Maps API key is not configured in .env file');
    return;
  }
  
  console.log('Using API key:', apiKey.substring(0, 10) + '...');
  
  const origin = '562 Richmond Road, Grey Lynn, Auckland';
  const destination = 'Vector, level 6/110 Carlton Gore Road, Auckland, Auckland 1023';
  
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${apiKey}`;
  
  console.log('Testing URL:', url);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (data.status === 'OK') {
      console.log('API test successful!');
      console.log('Travel time:', data.rows[0].elements[0].duration.text);
    } else {
      console.error('API test failed with status:', data.status);
      if (data.error_message) {
        console.error('Error message:', data.error_message);
      }
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testGoogleMapsAPI(); 