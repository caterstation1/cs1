import { db } from './firebase';

// Product adapter
export const productAdapter = {
  async findMany() {
    const snapshot = await db.collection('products').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  async findUnique(where: { variantId: string }) {
    const doc = await db.collection('products').doc(where.variantId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },
  
  async upsert(data: any) {
    const { variantId, ...productData } = data;
    await db.collection('products').doc(variantId).set(productData, { merge: true });
    return { variantId, ...productData };
  },
  
  async update(where: { variantId: string }, data: any) {
    await db.collection('products').doc(where.variantId).update(data);
    return { variantId: where.variantId, ...data };
  }
};

// Order adapter
export const orderAdapter = {
  async findMany() {
    const snapshot = await db.collection('orders').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  async findUnique(where: { id: string }) {
    const doc = await db.collection('orders').doc(where.id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },
  
  async create(data: any) {
    const docRef = await db.collection('orders').add(data);
    return { id: docRef.id, ...data };
  },
  
  async update(where: { id: string }, data: any) {
    await db.collection('orders').doc(where.id).update(data);
    return { id: where.id, ...data };
  }
};

// Rule adapter
export const ruleAdapter = {
  async findMany() {
    const snapshot = await db.collection('rules').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  async findUnique(where: { id: string }) {
    const doc = await db.collection('rules').doc(where.id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },
  
  async create(data: any) {
    const docRef = await db.collection('rules').add(data);
    return { id: docRef.id, ...data };
  },
  
  async update(where: { id: string }, data: any) {
    await db.collection('rules').doc(where.id).update(data);
    return { id: where.id, ...data };
  },
  
  async delete(where: { id: string }) {
    await db.collection('rules').doc(where.id).delete();
    return { success: true };
  }
}; 