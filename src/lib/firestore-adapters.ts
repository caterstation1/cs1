import { db } from './firebase';

// Product adapter
export const productAdapter = {
  async findMany() {
    try {
      const snapshot = await db.collection('products').limit(100).get(); // Limit to 100 products
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching products:', error);
      return []; // Return empty array on error
    }
  },
  
  async findUnique(where: { variantId: string }) {
    try {
      const doc = await db.collection('products').doc(where.variantId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  },
  
  async upsert(data: any) {
    try {
      const { variantId, ...productData } = data;
      await db.collection('products').doc(variantId).set(productData, { merge: true });
      return { variantId, ...productData };
    } catch (error) {
      console.error('Error upserting product:', error);
      throw error;
    }
  },
  
  async update(where: { variantId: string }, data: any) {
    try {
      await db.collection('products').doc(where.variantId).update(data);
      return { variantId: where.variantId, ...data };
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }
};

// Order adapter
export const orderAdapter = {
  async findMany() {
    try {
      const snapshot = await db.collection('orders').limit(50).get(); // Limit to 50 orders
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching orders:', error);
      return []; // Return empty array on error
    }
  },
  
  async findUnique(where: { id: string }) {
    try {
      const doc = await db.collection('orders').doc(where.id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  },
  
  async create(data: any) {
    try {
      const docRef = await db.collection('orders').add(data);
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },
  
  async update(where: { id: string }, data: any) {
    try {
      await db.collection('orders').doc(where.id).update(data);
      return { id: where.id, ...data };
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }
};

// Rule adapter
export const ruleAdapter = {
  async findMany() {
    try {
      const snapshot = await db.collection('rules').limit(20).get(); // Limit to 20 rules
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching rules:', error);
      return []; // Return empty array on error
    }
  },
  
  async findUnique(where: { id: string }) {
    try {
      const doc = await db.collection('rules').doc(where.id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error fetching rule:', error);
      return null;
    }
  },
  
  async create(data: any) {
    try {
      const docRef = await db.collection('rules').add(data);
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Error creating rule:', error);
      throw error;
    }
  },
  
  async update(where: { id: string }, data: any) {
    try {
      await db.collection('rules').doc(where.id).update(data);
      return { id: where.id, ...data };
    } catch (error) {
      console.error('Error updating rule:', error);
      throw error;
    }
  },
  
  async delete(where: { id: string }) {
    try {
      await db.collection('rules').doc(where.id).delete();
      return { success: true };
    } catch (error) {
      console.error('Error deleting rule:', error);
      throw error;
    }
  }
}; 