import { ADD_ONS } from '@/lib/menu';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered';

export type OrderCustomization = {
  meatPoint?: string;
  removedIngredients: string[];
  addOns: { slug: string; name: string; priceCents: number }[];
  notes: string;
};

export type OrderLine = {
  id: string;
  itemSlug: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  customization: OrderCustomization;
};

export type Order = {
  id: string;
  tableNumber: string;
  customerName: string;
  status: OrderStatus;
  createdAt: string;
  items: OrderLine[];
};

const STORAGE_KEY = 'lanche-do-mega:orders:v1';
const DEMO_EVENT = 'lanche-do-mega:orders-changed';

export function getDemoOrders(): Order[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Order[]) : [];
  } catch {
    return [];
  }
}

function saveDemoOrders(orders: Order[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event(DEMO_EVENT));
}

export function subscribeToDemoOrders(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(DEMO_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(DEMO_EVENT, onChange);
  };
}

export function orderTotal(order: Pick<Order, 'items'>) {
  return order.items.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
}

export async function createOrder(order: Order) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    saveDemoOrders([order, ...getDemoOrders()]);
    return order.id;
  }

  const { data, error } = await supabase.rpc('create_customer_order', {
    p_table_number: order.tableNumber,
    p_customer_name: order.customerName || null,
    p_items: order.items.map((line) => ({
      menu_item_id: line.itemSlug,
      quantity: line.quantity,
      notes: line.customization.notes,
      customizations: {
        meatPoint: line.customization.meatPoint ?? null,
        removedIngredients: line.customization.removedIngredients,
      },
      add_ons: line.customization.addOns.map((addOn) => addOn.slug),
    })),
  });

  if (error) throw error;
  return data as string;
}

export async function loadActiveOrders() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return getDemoOrders()
      .filter((order) => order.status !== 'delivered')
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, table_number, customer_name, status, created_at, order_items(id, menu_item_id, item_name_snapshot, quantity, unit_price_cents, notes, customizations)',
    )
    .in('status', ['new', 'preparing', 'ready'])
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const orderItems = (row.order_items ?? []) as {
      id: string;
      menu_item_id: string;
      item_name_snapshot: string;
      quantity: number;
      unit_price_cents: number;
      notes: string | null;
      customizations: {
        meatPoint?: string | null;
        removedIngredients?: string[];
        addOns?: string[];
      } | null;
    }[];

    return {
      id: row.id,
      tableNumber: row.table_number,
      customerName: row.customer_name ?? '',
      status: row.status as OrderStatus,
      createdAt: row.created_at,
      items: orderItems.map((item) => {
        const selectedAddOns = item.customizations?.addOns ?? [];
        return {
          id: item.id,
          itemSlug: item.menu_item_id,
          name: item.item_name_snapshot,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          customization: {
            meatPoint: item.customizations?.meatPoint ?? undefined,
            removedIngredients: item.customizations?.removedIngredients ?? [],
            addOns: selectedAddOns.flatMap((slug) => {
              const addOn = ADD_ONS.find(
                (candidate) => candidate.slug === slug,
              );
              return addOn
                ? [{ slug, name: addOn.name, priceCents: addOn.priceCents }]
                : [];
            }),
            notes: item.notes ?? '',
          },
        };
      }),
    } satisfies Order;
  });
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const orders = getDemoOrders().map((order) =>
      order.id === id ? { ...order, status } : order,
    );
    saveDemoOrders(orders);
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
