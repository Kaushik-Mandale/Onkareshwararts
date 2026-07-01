import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  runTransaction,
  type DocumentReference
} from 'firebase/firestore';
import { db, auth } from './config';
import type { 
  Product, 
  Customer, 
  Order, 
  PaymentHistory, 
  InventoryHistory, 
  ActivityLog, 
  Notification, 
  BusinessSettings 
} from '../types';

function getCurrentOwnerId(): string {
  const ownerId = auth?.currentUser?.uid;
  if (!ownerId) throw new Error('User must be signed in to access this data.');
  return ownerId;
}

function getUsernamePath(): string {
  const email = auth?.currentUser?.email;
  if (!email) {
    const uid = auth?.currentUser?.uid;
    if (!uid) return 'system';
    return uid;
  }
  return email.split('@')[0].toLowerCase();
}

export function getColRef(colName: string) {
  if (!db) throw new Error('Database not configured');
  return collection(db, 'users_data', getUsernamePath(), colName);
}

export function getDocRef(colName: string, id: string) {
  if (!db) throw new Error('Database not configured');
  return doc(db, 'users_data', getUsernamePath(), colName, id);
}

function getSettingsDocRef() {
  const ownerId = getCurrentOwnerId();
  return getDocRef('settings', ownerId);
}

function assertResourceOwnedByCurrentUser(resourceOwnerId?: string) {
  const ownerId = getCurrentOwnerId();
  if (!ownerId || resourceOwnerId !== ownerId) {
    throw new Error('Resource not found or access denied.');
  }
}

async function assertDocumentOwnedByCurrentUser(ref: DocumentReference, resourceName: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  const ownerId = getCurrentOwnerId();

  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error(`${resourceName} not found.`);

  const resourceOwnerId = snapshot.data()?.ownerId as string | undefined;
  if (resourceOwnerId !== ownerId) {
    throw new Error(`${resourceName} access denied.`);
  }
}

// Helper to log user activity
export async function logActivity(action: string, details: string) {
  if (!db) return;
  try {
    const user = auth?.currentUser;
    const activity: Omit<ActivityLog, 'id'> = {
      ownerId: user?.uid || 'system',
      action,
      details,
      userId: user?.uid || 'system',
      username: user?.displayName || user?.email?.split('@')[0] || 'System',
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1', // Client side IP lookup could be added or simulated
      device: navigator.userAgent
    };
    await addDoc(getColRef('activity_logs'), activity);
  } catch (e) {
    console.error('Failed to write activity log:', e);
  }
}

// ==========================================
// PRODUCTS CRUD
// ==========================================
export async function getProducts(): Promise<Product[]> {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return [];
  const snapshot = await getDocs(query(
    getColRef('products'),
    where('status', '!=', 'deleted'),
    where('ownerId', '==', ownerId)
  ));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

export function subscribeProducts(callback: (products: Product[]) => void) {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return () => {};
  const q = query(
    getColRef('products'),
    where('status', '!=', 'deleted'),
    where('ownerId', '==', ownerId)
  );
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    callback(products);
  });
}

export async function addProduct(product: Omit<Product, 'createdAt' | 'updatedAt'>): Promise<string> {
  if (!db) throw new Error('Database not configured');
  const ownerId = getCurrentOwnerId();
  if (!ownerId) throw new Error('User must be signed in to add products.');
  const now = new Date().toISOString();
  const productData = {
    ...product,
    ownerId,
    createdAt: now,
    updatedAt: now
  };
  await setDoc(getDocRef('products', product.id), productData);
  await logActivity('Product Added', `Added product ${product.name} (ID: ${product.id})`);
  
  // Log stock history
  await logStockChange(product.id, product.name, 0, product.quantity, 'Initial Restock');
  return product.id;
}

export async function updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('products', id), 'Product');
  const now = new Date().toISOString();
  
  // Get previous stock for history logging if quantity is changing
  if (updates.quantity !== undefined) {
    const prevDoc = await getDoc(getDocRef('products', id));
    if (prevDoc.exists()) {
      const prevData = prevDoc.data() as Product;
      if (prevData.quantity !== updates.quantity) {
        await logStockChange(
          id, 
          updates.name || prevData.name, 
          prevData.quantity, 
          updates.quantity, 
          'Manual Adjustment'
        );
      }
    }
  }

  const updatedData = {
    ...updates,
    updatedAt: now
  };
  await updateDoc(getDocRef('products', id), updatedData);
  await logActivity('Product Updated', `Updated product ID: ${id}`);
}

export async function archiveProduct(id: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('products', id), 'Product');
  await updateDoc(getDocRef('products', id), {
    status: 'archived',
    updatedAt: new Date().toISOString()
  });
  await logActivity('Product Archived', `Archived product ID: ${id}`);
}

export async function restoreProduct(id: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('products', id), 'Product');
  await updateDoc(getDocRef('products', id), {
    status: 'active',
    updatedAt: new Date().toISOString()
  });
  await logActivity('Product Restored', `Restored product ID: ${id}`);
}

export async function deleteProductSoft(id: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('products', id), 'Product');
  await updateDoc(getDocRef('products', id), {
    status: 'deleted',
    updatedAt: new Date().toISOString()
  });
  await logActivity('Product Deleted (Soft)', `Soft-deleted product ID: ${id}`);
}

// ==========================================
// STOCK & INVENTORY HISTORY
// ==========================================
async function logStockChange(productId: string, productName: string, previousStock: number, newStock: number, reason: string) {
  if (!db) return;
  const user = auth?.currentUser;
  const history: Omit<InventoryHistory, 'id'> = {
    ownerId: user?.uid || 'system',
    productId,
    productName,
    previousStock,
    newStock,
    change: newStock - previousStock,
    reason,
    timestamp: new Date().toISOString(),
    userId: user?.uid || 'system',
    username: user?.displayName || user?.email?.split('@')[0] || 'System'
  };
  await addDoc(getColRef('inventory_history'), history);

  // Check low stock triggers
  const productDoc = await getDoc(getDocRef('products', productId));
  if (productDoc.exists()) {
    const product = productDoc.data() as Product;
    if (newStock === 0) {
      await createNotification(
        'lowStock',
        `ALERT: Product "${productName}" is OUT OF STOCK!`,
        { productId }
      );
    } else if (newStock <= product.lowStockLimit) {
      await createNotification(
        'lowStock',
        `Warning: Product "${productName}" is running low (${newStock} units left, limit ${product.lowStockLimit})`,
        { productId }
      );
    }
  }
}

export function subscribeInventoryHistory(callback: (history: InventoryHistory[]) => void) {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return () => {};
  const q = query(
    getColRef('inventory_history'),
    where('ownerId', '==', ownerId),
    orderBy('timestamp', 'desc'),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryHistory)));
  });
}

// ==========================================
// CUSTOMERS CRM
// ==========================================
export async function getCustomers(): Promise<Customer[]> {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return [];
  const snapshot = await getDocs(query(
    getColRef('customers'),
    where('ownerId', '==', ownerId),
    orderBy('name', 'asc')
  ));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
}

export function subscribeCustomers(callback: (customers: Customer[]) => void) {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return () => {};
  const q = query(
    getColRef('customers'),
    where('ownerId', '==', ownerId),
    orderBy('name', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
  });
}

export async function lookupCustomerByMobile(mobile: string): Promise<Customer | null> {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return null;
  const q = query(
    getColRef('customers'),
    where('ownerId', '==', ownerId),
    where('mobile', '==', mobile.trim()),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const firstDoc = snapshot.docs[0];
  return { id: firstDoc.id, ...firstDoc.data() } as Customer;
}

export async function saveCustomer(customer: Omit<Customer, 'id' | 'joinedDate' | 'lastVisit' | 'ownerId'>): Promise<string> {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) throw new Error('User must be signed in to save customers.');
  const existing = await lookupCustomerByMobile(customer.mobile);
  const now = new Date().toISOString();
  
  if (existing) {
    const updatedCustomer: Partial<Customer> = {
      ...customer,
      lastVisit: now
    };
    await updateDoc(getDocRef('customers', existing.id), updatedCustomer);
    return existing.id;
  } else {
    const customerId = 'CUST-' + Math.floor(100000 + Math.random() * 900000);
    const newCustomer: Customer = {
      ...customer,
      id: customerId,
      ownerId,
      joinedDate: now,
      lastVisit: now
    };
    await setDoc(getDocRef('customers', customerId), newCustomer);
    return customerId;
  }
}

export async function updateCustomerDetails(customerId: string, updates: Partial<Customer>): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('customers', customerId), 'Customer');
  await updateDoc(getDocRef('customers', customerId), updates);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('customers', customerId), 'Customer');
  await deleteDoc(getDocRef('customers', customerId));
}

export async function deleteOrder(orderNumber: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('orders', orderNumber), 'Order');
  await deleteDoc(getDocRef('orders', orderNumber));
}

export async function deletePayment(paymentId: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await assertDocumentOwnedByCurrentUser(getDocRef('payments', paymentId), 'Payment');
  await deleteDoc(getDocRef('payments', paymentId));
}

// ==========================================
// BOOKING & ORDER WORKFLOW (WITH TRANSACTION)
// ==========================================
export async function createOrder(order: Omit<Order, 'createdBy' | 'createdAt'>): Promise<string> {
  if (!db) throw new Error('Database not configured');
  const ownerId = getCurrentOwnerId();
  if (!ownerId) throw new Error('User must be signed in to create orders.');
  const user = auth?.currentUser;
  const username = user?.displayName || user?.email?.split('@')[0] || 'Staff';
  
  const finalOrder: Order = {
    ...order,
    ownerId,
    createdBy: username,
    createdAt: new Date().toISOString()
  };

  // Prevent duplicate order number
  const checkDoc = await getDoc(getDocRef('orders', order.orderNumber));
  if (checkDoc.exists()) {
    throw new Error(`Order ${order.orderNumber} already exists. Please regenerate order number.`);
  }

  // Execute in firestore transaction to safely verify stock and deduct it
  await runTransaction(db, async (transaction) => {
    // 1. Verify and update stock for all products in the order
    for (const item of order.products) {
      const pDocRef = getDocRef('products', item.productId);
      const pSnapshot = await transaction.get(pDocRef);
      
      if (!pSnapshot.exists()) {
        throw new Error(`Product ${item.name} not found in inventory.`);
      }
      
      const productData = pSnapshot.data() as Product;
      
      if (productData.status !== 'active') {
        throw new Error(`Product ${item.name} is archived/not active and cannot be booked.`);
      }

      if (productData.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${productData.quantity}, Requested: ${item.quantity}`);
      }

      // Deduct stock
      const newStock = productData.quantity - item.quantity;
      transaction.update(pDocRef, { 
        quantity: newStock,
        updatedAt: new Date().toISOString() 
      });

      // Stock adjustment history logging (needs to run after transaction succeeds, or inside since it's just logging)
      // Transaction actions are queued; side effects are recorded. We'll write to history via normal calls after transaction.
    }

    // 2. Write the order document
    transaction.set(getDocRef('orders', order.orderNumber), finalOrder);
  });

  // Log stock histories and triggers
  for (const item of order.products) {
    const pDoc = await getDoc(getDocRef('products', item.productId));
    if (pDoc.exists()) {
      const pData = pDoc.data() as Product;
      // Previous stock was pData.quantity + item.quantity
      await logStockChange(
        item.productId, 
        item.name, 
        pData.quantity + item.quantity, 
        pData.quantity, 
        `Booking - ${order.orderNumber}`
      );
    }
  }

  // 3. Update customer stats
  const customerMobile = order.customer.mobile;
  const customer = await lookupCustomerByMobile(customerMobile);
  if (customer) {
    const totalOrders = customer.totalOrders + 1;
    const totalAmount = customer.totalAmount + order.payment.grandTotal;
    const remainingDue = customer.remainingDue + order.payment.remaining;
    
    // Auto tagging customer
    const tags = [...customer.tags];
    if (totalOrders >= 5 && !tags.includes('VIP')) tags.push('VIP');
    if (totalOrders >= 2 && !tags.includes('Repeat Customer')) tags.push('Repeat Customer');

    await updateDoc(getDocRef('customers', customer.id), {
      totalOrders,
      totalAmount,
      remainingDue,
      lastVisit: new Date().toISOString(),
      tags: Array.from(new Set(tags))
    });
  } else {
    // Save new customer record
    await saveCustomer({
      name: order.customer.name,
      mobile: order.customer.mobile,
      address: order.customer.address,
      notes: '',
      totalOrders: 1,
      totalAmount: order.payment.grandTotal,
      remainingDue: order.payment.remaining,
      tags: ['Regular']
    });
  }

  // 4. Create initial payment history ledger
  if (order.payment.paid > 0) {
    const paymentId = 'PAY-' + Math.floor(100000 + Math.random() * 900000);
    const ledgerEntry: PaymentHistory = {
      id: paymentId,
      ownerId,
      orderId: order.orderNumber,
      amount: order.payment.paid,
      method: order.payment.method === 'Split' ? 'Online' : order.payment.method, // simplification
      type: 'payment',
      timestamp: new Date().toISOString(),
      recordedBy: username,
      notes: 'Initial deposit at booking'
    };
    await setDoc(getDocRef('payments', paymentId), ledgerEntry);
  }

  await createNotification(
    'newBooking',
    `New booking created: ${order.orderNumber} for ${order.customer.name} (Total: ₹${order.payment.grandTotal})`,
    { orderNumber: order.orderNumber }
  );

  await logActivity('Order Created', `Created order: ${order.orderNumber}`);
  return order.orderNumber;
}

// Subscribe to Live Orders
export function subscribeOrders(callback: (orders: Order[]) => void) {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return () => {};
  const q = query(
    getColRef('orders'),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ orderNumber: doc.id, ...doc.data() } as Order)));
  });
}

export async function getOrder(orderNumber: string): Promise<Order | null> {
  if (!db) return null;
  const snapshot = await getDoc(getDocRef('orders', orderNumber));
  if (!snapshot.exists()) return null;
  const order = { orderNumber: snapshot.id, ...snapshot.data() } as Order;
  assertResourceOwnedByCurrentUser(order.ownerId);
  return order;
}

// Update Order Payment Ledger
export async function addPaymentToOrder(orderNumber: string, amount: number, method: PaymentHistory['method'], notes: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  const user = auth?.currentUser;
  const username = user?.displayName || user?.email?.split('@')[0] || 'Staff';

  const orderDocRef = getDocRef('orders', orderNumber);
  const orderDoc = await getDoc(orderDocRef);
  if (!orderDoc.exists()) throw new Error('Order not found');
  
  const order = orderDoc.data() as Order;
  await assertDocumentOwnedByCurrentUser(orderDocRef, 'Order');
  if (amount > order.payment.remaining) {
    throw new Error(`Payment exceeds remaining balance of ₹${order.payment.remaining}`);
  }

  const newPaid = order.payment.paid + amount;
  const newRemaining = order.payment.grandTotal - newPaid;
  const newStatus = newRemaining === 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

  // Update order fields
  await updateDoc(orderDocRef, {
    'payment.paid': newPaid,
    'payment.remaining': newRemaining,
    'payment.status': newStatus
  });

  // Log Ledger Entry
  const paymentId = 'PAY-' + Math.floor(100000 + Math.random() * 900000);
  const ledger: PaymentHistory = {
    id: paymentId,
    ownerId: getCurrentOwnerId() || 'system',
    orderId: orderNumber,
    amount,
    method,
    type: 'payment',
    timestamp: new Date().toISOString(),
    recordedBy: username,
    notes
  };
  await setDoc(getDocRef('payments', paymentId), ledger);

  // Update Customer Outstanding Due
  const customer = await lookupCustomerByMobile(order.customer.mobile);
  if (customer) {
    await updateDoc(getDocRef('customers', customer.id), {
      remainingDue: Math.max(0, customer.remainingDue - amount)
    });
  }

  await createNotification(
    'paymentReceived',
    `Payment of ₹${amount} received for order ${orderNumber} (${method})`,
    { orderNumber }
  );

  await logActivity('Payment Updated', `Recorded payment ₹${amount} on order ${orderNumber}`);
}

// Refund Payment on Order
export async function refundOrder(orderNumber: string, amount: number, notes: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  const user = auth?.currentUser;
  const username = user?.displayName || user?.email?.split('@')[0] || 'Admin';

  const orderDocRef = getDocRef('orders', orderNumber);
  const orderDoc = await getDoc(orderDocRef);
  if (!orderDoc.exists()) throw new Error('Order not found');
  
  const order = orderDoc.data() as Order;
  assertResourceOwnedByCurrentUser(order.ownerId);
  if (amount > order.payment.paid) {
    throw new Error(`Refund amount exceeds total paid amount of ₹${order.payment.paid}`);
  }

  const newPaid = order.payment.paid - amount;
  const newRemaining = order.payment.grandTotal - newPaid;
  const newStatus = newRemaining === 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

  await updateDoc(orderDocRef, {
    status: 'refunded',
    'payment.paid': newPaid,
    'payment.remaining': newRemaining,
    'payment.status': newStatus
  });

  // Log Refund Ledger Entry
  const paymentId = 'PAY-' + Math.floor(100000 + Math.random() * 900000);
  const ledger: PaymentHistory = {
    id: paymentId,
    ownerId: getCurrentOwnerId() || 'system',
    orderId: orderNumber,
    amount,
    method: 'Cash', // Default refund method
    type: 'refund',
    timestamp: new Date().toISOString(),
    recordedBy: username,
    notes
  };
  await setDoc(getDocRef('payments', paymentId), ledger);

  // Restore Stock on Order Refund/Cancellation
  for (const item of order.products) {
    const pRef = getDocRef('products', item.productId);
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      const pData = pSnap.data() as Product;
      const newStock = pData.quantity + item.quantity;
      await updateDoc(pRef, { quantity: newStock });
      await logStockChange(item.productId, item.name, pData.quantity, newStock, `Refund/Cancel - ${orderNumber}`);
    }
  }

  await logActivity('Order Refunded', `Refunded ₹${amount} on order ${orderNumber}`);
}

// Cancel Order
export async function cancelOrder(orderNumber: string, reason: string): Promise<void> {
  if (!db) throw new Error('Database not configured');

  const orderDocRef = getDocRef('orders', orderNumber);
  const orderDoc = await getDoc(orderDocRef);
  if (!orderDoc.exists()) throw new Error('Order not found');
  
  const order = orderDoc.data() as Order;
  await assertDocumentOwnedByCurrentUser(orderDocRef, 'Order');
  if (order.status === 'delivered') {
    throw new Error('Delivered orders cannot be cancelled.');
  }

  await updateDoc(orderDocRef, {
    status: 'cancelled',
    notes: order.notes ? `${order.notes} | Cancel reason: ${reason}` : `Cancel reason: ${reason}`
  });

  // Restore stock
  for (const item of order.products) {
    const pRef = getDocRef('products', item.productId);
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      const pData = pSnap.data() as Product;
      const newStock = pData.quantity + item.quantity;
      await updateDoc(pRef, { quantity: newStock });
      await logStockChange(item.productId, item.name, pData.quantity, newStock, `Order Cancellation - ${orderNumber}`);
    }
  }

  // Update Customer remaining due (since order is cancelled, customer outstanding for this order is wiped)
  const customer = await lookupCustomerByMobile(order.customer.mobile);
  if (customer) {
    await updateDoc(getDocRef('customers', customer.id), {
      remainingDue: Math.max(0, customer.remainingDue - order.payment.remaining)
    });
  }

  await createNotification(
    'pendingPayment',
    `Order ${orderNumber} cancelled. Inventory stock restored.`,
    { orderNumber }
  );

  await logActivity('Order Cancelled', `Cancelled order ${orderNumber}. Reason: ${reason}`);
}

// Confirm Delivery via QR
export async function confirmDelivery(orderNumber: string, deviceDetails: string): Promise<void> {
  if (!db) throw new Error('Database not configured');
  const user = auth?.currentUser;
  const username = user?.displayName || user?.email?.split('@')[0] || 'Staff';

  const orderDocRef = getDocRef('orders', orderNumber);
  const orderDoc = await getDoc(orderDocRef);
  if (!orderDoc.exists()) throw new Error('Order not found');

  const order = orderDoc.data() as Order;
  await assertDocumentOwnedByCurrentUser(orderDocRef, 'Order');
  if (order.status === 'delivered') {
    throw new Error('Order has already been delivered!');
  }
  if (order.status === 'cancelled') {
    throw new Error('Cannot deliver a cancelled order.');
  }

  await updateDoc(orderDocRef, {
    status: 'delivered',
    deliveredBy: username,
    deliveryTime: new Date().toISOString(),
    deliveryDevice: deviceDetails
  });

  await createNotification(
    'deliveryCompleted',
    `Delivery confirmed for ${orderNumber} by ${username}`,
    { orderNumber }
  );

  await logActivity('Delivery Confirmed', `Delivered order ${orderNumber} via QR Scanner`);
}

// ==========================================
// PAYMENTS LEDGER QUERYING
// ==========================================
export function subscribePayments(callback: (payments: PaymentHistory[]) => void) {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return () => {};
  const q = query(
    getColRef('payments'),
    where('ownerId', '==', ownerId),
    orderBy('timestamp', 'desc'),
    limit(200)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentHistory)));
  });
}

// ==========================================
// NOTIFICATIONS
// ==========================================
export async function createNotification(
  type: Notification['type'], 
  message: string, 
  metadata?: Record<string, any>
): Promise<void> {
  if (!db) return;
  const ownerId = getCurrentOwnerId();
  const notification: Omit<Notification, 'id'> = {
    ownerId: ownerId || 'system',
    type,
    message,
    read: false,
    createdAt: new Date().toISOString(),
    metadata
  };
  await addDoc(getColRef('notifications'), notification);
}

export function subscribeNotifications(callback: (notifications: Notification[]) => void) {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return () => {};
  const q = query(
    getColRef('notifications'),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
  });
}

export async function markNotificationAsRead(id: string): Promise<void> {
  if (!db) return;
  await updateDoc(getDocRef('notifications', id), { read: true });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return;
  const snapshot = await getDocs(query(
    getColRef('notifications'),
    where('ownerId', '==', ownerId),
    where('read', '==', false)
  ));
  const batchPromises = snapshot.docs.map(doc => updateDoc(doc.ref, { read: true }));
  await Promise.all(batchPromises);
}

// ==========================================
// BUSINESS SETTINGS
// ==========================================

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const defaultSettings: BusinessSettings = {
    businessName: 'Onkareshwararts',
    ownerName: 'Admin Owner',
    phone: '+91 9168925461',
    whatsapp: '+91 9168925461',
    address: 'Ayodhya Nagari, Plot No. 50, Sakri Road, Dhule, Behind Circuit House',
    upiId: 'ganpatiIdol@upi',
    bankDetails: {
      accountName: 'Onkareshwararts',
      accountNumber: '123456789012',
      ifscCode: 'HDFC0000123',
      bankName: 'HDFC Bank'
    },
    invoiceSettings: {
      prefix: 'GAN-2026-',
      taxRate: 18,
      gstEnabled: false,
      terms: 'No refund on booked idols. Delivery to be taken 2 days before Ganesh Chaturthi.'
    },
    autoLogoutTimer: 15,
    theme: 'light',
    currency: 'INR'
  };

  if (!db) return defaultSettings;
  try {
    const snap = await getDoc(getSettingsDocRef());
    if (snap.exists()) {
      const stored = snap.data() as BusinessSettings;
      const migrated: BusinessSettings = {
        ...defaultSettings,
        ...stored,
        bankDetails: {
          ...defaultSettings.bankDetails,
          ...stored.bankDetails
        },
        invoiceSettings: {
          ...defaultSettings.invoiceSettings,
          ...stored.invoiceSettings
        }
      };

      let changed = false;
      if (migrated.businessName === 'Ganpati Idol Emporium') {
        migrated.businessName = defaultSettings.businessName;
        changed = true;
      }
      if (migrated.bankDetails.accountName === 'Ganpati Idol Emporium') {
        migrated.bankDetails.accountName = defaultSettings.bankDetails.accountName;
        changed = true;
      }
      if (migrated.phone === '+91 9876543210') {
        migrated.phone = defaultSettings.phone;
        changed = true;
      }
      if (migrated.whatsapp === '+91 9876543210') {
        migrated.whatsapp = defaultSettings.whatsapp;
        changed = true;
      }
      if (migrated.address === 'Shop No. 10, Ganesh Chowk, Pune, Maharashtra') {
        migrated.address = defaultSettings.address;
        changed = true;
      }

      if (changed) {
        await setDoc(getSettingsDocRef(), migrated, { merge: true });
      }

      return migrated;
    }
    // Write defaults if not exist
    await setDoc(getSettingsDocRef(), defaultSettings);
    return defaultSettings;
  } catch (e) {
    console.error('Settings lookup failed, using default settings:', e);
    return defaultSettings;
  }
}

export async function updateBusinessSettings(updates: Partial<BusinessSettings>): Promise<void> {
  if (!db) throw new Error('Database not configured');
  await setDoc(getSettingsDocRef(), updates, { merge: true });
  await logActivity('Settings Updated', 'Updated business configurations');
}

// Subscribe to Settings changes
export function subscribeSettings(callback: (settings: BusinessSettings) => void) {
  if (!db) return () => {};
  return onSnapshot(getSettingsDocRef(), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as BusinessSettings);
    }
  });
}

// ==========================================
// ACTIVITY LOGS
// ==========================================
export function subscribeActivityLogs(callback: (logs: ActivityLog[]) => void) {
  const ownerId = getCurrentOwnerId();
  if (!db || !ownerId) return () => {};
  const q = query(
    getColRef('activity_logs'),
    where('ownerId', '==', ownerId),
    orderBy('timestamp', 'desc'),
    limit(150)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
  });
}

// ==========================================
// DATABASE RESET FOR FRESH START
// ==========================================
export async function resetDatabaseForFreshStart(): Promise<void> {
  if (!db) throw new Error('Database not configured');
  const ownerId = getCurrentOwnerId();
  if (!ownerId) throw new Error('User must be signed in to reset database.');

  try {
    // Delete all orders for the current user
    const ordersSnap = await getDocs(query(getColRef('orders'), where('ownerId', '==', ownerId)));
    for (const doc of ordersSnap.docs) {
      await deleteDoc(doc.ref);
    }

    // Delete all payments/ledger entries for the current user
    const paymentsSnap = await getDocs(query(getColRef('payments'), where('ownerId', '==', ownerId)));
    for (const doc of paymentsSnap.docs) {
      await deleteDoc(doc.ref);
    }

    // Delete all activity logs for the current user
    const logsSnap = await getDocs(query(getColRef('activity_logs'), where('ownerId', '==', ownerId)));
    for (const doc of logsSnap.docs) {
      await deleteDoc(doc.ref);
    }

    // Delete all inventory history for the current user
    const inventorySnap = await getDocs(query(getColRef('inventory_history'), where('ownerId', '==', ownerId)));
    for (const doc of inventorySnap.docs) {
      await deleteDoc(doc.ref);
    }

    // Reset all customers for current user (clear order counts and totals)
    const customersSnap = await getDocs(query(getColRef('customers'), where('ownerId', '==', ownerId)));
    for (const customerDoc of customersSnap.docs) {
      await updateDoc(customerDoc.ref, {
        totalOrders: 0,
        totalAmount: 0,
        remainingDue: 0,
        tags: [],
        lastVisit: '',
      });
    }

    // Log this action to a new log entry (after clearing)
    await addDoc(getColRef('activity_logs'), {
      ownerId,
      action: 'Database Reset',
      details: 'Performed fresh start - cleared orders, payments, logs, inventory history, and reset customer totals',
      timestamp: new Date().toISOString(),
      userId: auth?.currentUser?.uid || 'system',
      username: auth?.currentUser?.displayName || auth?.currentUser?.email?.split('@')[0] || 'System',
      ip: '127.0.0.1',
      device: navigator.userAgent
    });

    console.log('Database reset completed successfully');
  } catch (e) {
    console.error('Database reset failed:', e);
    throw new Error('Failed to reset database: ' + (e instanceof Error ? e.message : 'Unknown error'));
  }
}
