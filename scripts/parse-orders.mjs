import fetch from 'node-fetch';

async function parseAllOrders() {
  try {
    const response = await fetch('http://localhost:3000/api/orders/parse-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log('Parse results:', result);
  } catch (error) {
    console.error('Error parsing orders:', error);
  }
}

parseAllOrders(); 