export interface User {
  uid: string;
  username: string;
  name: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  createdAt: string;
  /** The Firestore sub-path (shop owner's username) all users of this shop read/write to.
   *  For admin: their own username. For staff: the admin's username. */
  ownerPath?: string;
}

export interface Product {
  id: string; // Unique ID (e.g. BAR-123 or scan)
  ownerId?: string;
  name: string;
  photoUrl: string;
  category: string;
  purchaseCost: number; // retained internally for old imported records
  sellingPrice: number;
  profit: number; // retained internally for old imported records
  quantity: number;
  size: string; // size details, e.g., "1.5 feet"
  weight: string; // weight details, e.g., "5 kg"
  material: string; // e.g., Shadu Mati, POP
  description: string;
  lowStockLimit: number;
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
  barcode: string;
  qrCode?: string;
}

export interface Customer {
  id: string;
  ownerId?: string;
  name: string;
  mobile: string;
  address: string;
  notes: string;
  totalOrders: number;
  totalAmount: number;
  remainingDue: number;
  lastVisit: string;
  joinedDate: string;
  tags: ('VIP' | 'Regular' | 'Wholesale' | 'Repeat Customer')[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus = 'booked' | 'pending' | 'delivered' | 'cancelled' | 'refunded';

export interface Order {
  orderNumber: string; // GAN-2026-000001
  ownerId?: string;
  products: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    size: string;
  }[];
  customer: {
    id: string;
    name: string;
    mobile: string;
    address: string;
  };
  payment: {
    subtotal: number;
    discount: number;
    gstEnabled: boolean;
    gstAmount: number;
    grandTotal: number;
    paid: number;
    remaining: number;
    status: 'Paid' | 'Partial' | 'Pending';
    method: 'Cash' | 'Online' | 'UPI' | 'Card' | 'Other' | 'Split';
    splitDetails?: { method: 'Cash' | 'Online' | 'UPI' | 'Card' | 'Other'; amount: number }[];
  };
  status: OrderStatus;
  qrToken: string; // Digital signature & details token
  invoiceUrl?: string;
  createdBy: string;
  createdAt: string;
  deliveryDate: string;
  deliveredBy?: string;
  deliveryTime?: string;
  deliveryDevice?: string;
  notes?: string;
}

export interface PaymentHistory {
  id: string;
  ownerId?: string;
  orderId: string;
  amount: number;
  method: 'Cash' | 'Online' | 'UPI' | 'Card' | 'Other';
  type: 'payment' | 'refund';
  timestamp: string;
  recordedBy: string;
  notes?: string;
}

export interface InventoryHistory {
  id: string;
  ownerId?: string;
  productId: string;
  productName: string;
  previousStock: number;
  newStock: number;
  change: number; // positive or negative
  reason: string; // e.g. "Restock", "Booking - GAN-2026-000001", "Manual Adjustment"
  timestamp: string;
  userId: string;
  username: string;
}

export interface ActivityLog {
  id: string;
  ownerId?: string;
  action: string;
  details: string;
  userId: string;
  username: string;
  timestamp: string;
  ip: string;
  device: string;
}

export interface Notification {
  id: string;
  ownerId?: string;
  type: 'lowStock' | 'pendingPayment' | 'deliveryToday' | 'largeOrder' | 'paymentReceived' | 'newBooking' | 'deliveryCompleted';
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface BusinessSettings {
  businessName: string;
  businessLogo?: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  address: string;
  upiId: string;
  bankDetails: {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  invoiceSettings: {
    prefix: string;
    taxRate: number; // standard GST e.g. 18% or 5%
    gstEnabled: boolean;
    terms: string;
  };
  autoLogoutTimer: number; // in minutes, 0 to disable
  theme: 'light' | 'dark' | 'system';
  currency: string;
}
