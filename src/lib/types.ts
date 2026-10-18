export type Role = 'owner' | 'admin' | 'cashier';

export interface Business {
  id: string;
  name: string;
  country_code: string;
  currency_code: string;
  locale: string;
  timezone: string;
  tax_name: string;
  tax_rate: number;
  prices_include_tax: boolean;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  receipt_footer: string | null;
  invite_code: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  track_stock: boolean;
  image_url: string | null;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  address: string | null;
  notes: string | null;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface SaleItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Sale {
  id: string;
  number: number;
  customer_name: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change_given: number;
  notes: string | null;
  status: 'completed' | 'voided';
  void_reason: string | null;
  created_at: string;
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};
