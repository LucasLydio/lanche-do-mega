'use client';

import "./kitchen-dashboard.css";
import "./kitchen-tickets.css";
import "./kitchen-access.css";

import { formatBRL } from '@/lib/menu';
import {
  loadActiveOrders,
  orderTotal,
  subscribeToDemoOrders,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from '@/lib/orders';
import { getSupabaseBrowserClient, hasSupabaseConfig } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  Store,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

const nextStatus: Record<OrderStatus, { status: OrderStatus; label: string }> =
  {
    new: { status: 'preparing', label: 'Em preparo' },
    preparing: { status: 'ready', label: 'Marcar pronto' },
    ready: { status: 'delivered', label: 'Entregue' },
    delivered: { status: 'delivered', label: 'Entregue' },
  };

const statusNames: Record<OrderStatus, string> = {
  new: 'Novo pedido',
  preparing: 'Em preparo',
  ready: 'Pronto para sair',
  delivered: 'Entregue',
};

function elapsedTime(createdAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function KitchenPage() {
  const configured = hasSupabaseConfig();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!configured);
  const [staffAccess, setStaffAccess] = useState<{
    userId: string;
    allowed: boolean;
  } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [busyOrderId, setBusyOrderId] = useState('');
  const [orderError, setOrderError] = useState('');
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [toast, setToast] = useState('');
  const knownOrderIds = useRef<Set<string> | null>(null);
  const soundEnabledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const staffState = !configured
    ? 'allowed'
    : !authReady
      ? 'checking'
      : !session
        ? 'signed-out'
        : staffAccess?.userId === session.user.id
          ? staffAccess.allowed
            ? 'allowed'
            : 'unauthorized'
          : 'checking';
  const newOrderCount = orders.filter((order) => order.status === 'new').length;

  useEffect(() => {
    if (!configured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setAuthReady(true);
        setAuthError('');
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (!configured || !authReady || !session) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    supabase
      .from('kitchen_staff')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setStaffAccess({
          userId: session.user.id,
          allowed: !error && Boolean(data),
        });
      });

    return () => {
      active = false;
    };
  }, [authReady, configured, session]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (staffState !== 'allowed') return;
    let active = true;

    const playChime = () => {
      const context = audioContextRef.current;
      if (!soundEnabledRef.current || !context || context.state !== 'running')
        return;
      [660, 880].forEach((frequency, index) => {
        const start = context.currentTime + index * 0.18;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.15);
      });
    };

    const refreshOrders = async () => {
      try {
        const nextOrders = await loadActiveOrders();
        if (!active) return;
        const nextIds = new Set(nextOrders.map((order) => order.id));
        const previousIds = knownOrderIds.current;
        if (previousIds && [...nextIds].some((id) => !previousIds.has(id))) {
          setToast('Novo pedido na cozinha');
          playChime();
          window.setTimeout(() => setToast(''), 3500);
        }
        knownOrderIds.current = nextIds;
        setOrders(nextOrders);
        setOrderError('');
      } catch {
        if (active)
          setOrderError(
            'Não foi possível atualizar os pedidos. Verifique a conexão.',
          );
      }
    };

    void refreshOrders();
    let unsubscribeDemo: (() => void) | undefined;
    let channel:
      | ReturnType<
          NonNullable<ReturnType<typeof getSupabaseBrowserClient>>['channel']
        >
      | undefined;
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      channel = supabase
        .channel('kitchen-orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => void refreshOrders(),
        )
        .subscribe();
    } else {
      unsubscribeDemo = subscribeToDemoOrders(() => void refreshOrders());
    }
    const backupRefresh = window.setInterval(() => void refreshOrders(), 20000);

    return () => {
      active = false;
      unsubscribeDemo?.();
      if (channel && supabase) void supabase.removeChannel(channel);
      window.clearInterval(backupRefresh);
    };
  }, [refreshVersion, staffState]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningIn(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setAuthError('E-mail ou senha inválidos.');
    setSigningIn(false);
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
  }

  async function advanceOrder(order: Order) {
    setBusyOrderId(order.id);
    setOrderError('');
    try {
      await updateOrderStatus(order.id, nextStatus[order.status].status);
      if (!configured) setRefreshVersion((version) => version + 1);
    } catch {
      setOrderError('Não foi possível atualizar este pedido.');
    } finally {
      setBusyOrderId('');
    }
  }

  async function toggleSound() {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    if (!nextEnabled) return;

    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    audioContextRef.current ??= new AudioContextConstructor();
    await audioContextRef.current.resume();
    const oscillator = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    oscillator.frequency.value = 740;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(audioContextRef.current.destination);
    oscillator.start();
    oscillator.stop(audioContextRef.current.currentTime + 0.12);
  }

  if (configured && (!authReady || staffState === 'checking')) {
    return (
      <KitchenGate>
        <p className="gate-message">Verificando acesso da equipe...</p>
      </KitchenGate>
    );
  }

  if (configured && staffState === 'signed-out') {
    return (
      <KitchenGate>
        <form className="staff-login" onSubmit={handleSignIn}>
          <span className="gate-icon">
            <ChefHat size={25} />
          </span>
          <p className="kds-eyebrow">Acesso da equipe</p>
          <h1>Entrar na cozinha</h1>
          <p className="gate-copy">
            Use sua conta autorizada do Lanche do Mega.
          </p>
          <label htmlFor="staff-email">E-mail</label>
          <input
            id="staff-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="staff-password">Senha</label>
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {authError && (
            <p className="gate-error" role="alert">
              {authError}
            </p>
          )}
          <button
            className="kds-primary-button"
            type="submit"
            disabled={signingIn}
          >
            <LogIn size={17} /> {signingIn ? 'Entrando...' : 'Entrar'}
          </button>
          <Link className="gate-back-link" href="/mesa/04">
            <Store size={15} /> Voltar ao cardápio
          </Link>
        </form>
      </KitchenGate>
    );
  }

  if (configured && staffState === 'unauthorized') {
    return (
      <KitchenGate>
        <div className="staff-login">
          <span className="gate-icon">
            <TriangleAlert size={25} />
          </span>
          <p className="kds-eyebrow">Acesso restrito</p>
          <h1>Conta sem permissão</h1>
          <p className="gate-copy">
            Peça ao responsável para liberar seu usuário como membro da equipe
            da cozinha.
          </p>
          <button
            className="kds-secondary-button"
            type="button"
            onClick={handleSignOut}
          >
            <LogOut size={17} /> Sair da conta
          </button>
        </div>
      </KitchenGate>
    );
  }

  return (
    <main className="kitchen-page">
      <header className="kds-header">
        <div className="kds-brand-wrap">
          <span className="kds-brand-icon">
            <ChefHat size={23} />
          </span>
          <div className="kds-brand">
            <span>Lanche do Mega</span>
            <strong>PAINEL DA COZINHA</strong>
          </div>
        </div>
        <div className="kds-header-right">
          <span className="kds-live">
            <i /> {configured ? 'Ao vivo' : 'Modo demonstração'}
          </span>
          {configured && session && (
            <button
              className="kds-icon-button"
              type="button"
              title="Sair"
              aria-label="Sair da conta"
              onClick={handleSignOut}
            >
              <LogOut size={19} />
            </button>
          )}
          <Link className="kds-back-link" href="/mesa/04">
            Cardápio <Store size={16} />
          </Link>
        </div>
      </header>

      <div className="kds-main">
        <section className="kds-overview">
          <div>
            <p className="kds-eyebrow">Central de pedidos</p>
            <h1>Comanda na chapa.</h1>
            <p>A fila começa pelo pedido mais antigo.</p>
          </div>
          <div className="kds-controls">
            <div className="kds-count">
              <strong>{orders.length}</strong>
              <span>ativos</span>
            </div>
            {newOrderCount > 0 && (
              <span className="new-count">
                {newOrderCount} novo{newOrderCount === 1 ? '' : 's'}
              </span>
            )}
            <button
              className={`kds-control-button${soundEnabled ? ' is-on' : ''}`}
              type="button"
              onClick={toggleSound}
              title={
                soundEnabled ? 'Desativar aviso sonoro' : 'Ativar aviso sonoro'
              }
            >
              {soundEnabled ? <Bell size={17} /> : <BellOff size={17} />}
              <span>{soundEnabled ? 'Som ligado' : 'Ativar som'}</span>
            </button>
            <button
              className="kds-icon-button"
              type="button"
              onClick={() => setRefreshVersion((version) => version + 1)}
              title="Atualizar pedidos"
              aria-label="Atualizar pedidos"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </section>

        <div className="kds-status-line">
          <span className="kds-status-dot" /> Atualização automática ativada{' '}
          <span className="kds-status-separator">·</span>
          <Clock3 size={14} />{' '}
          {new Date(now).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
        {orderError && (
          <p className="kds-error" role="alert">
            {orderError}
          </p>
        )}

        {orders.length === 0 ? (
          <section className="kds-empty-state">
            <span>
              <CheckCircle2 size={30} />
            </span>
            <h2>Cozinha tranquila por aqui.</h2>
            <p>Os novos pedidos aparecem automaticamente nesta tela.</p>
          </section>
        ) : (
          <section className="order-grid" aria-label="Pedidos ativos">
            {orders.map((order, index) => {
              const next = nextStatus[order.status];
              return (
                <article
                  className={`order-ticket status-${order.status}`}
                  key={order.id}
                >
                  <header className="ticket-header">
                    <div className="ticket-table-wrap">
                      <span className="ticket-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h2>Mesa {order.tableNumber}</h2>
                    </div>
                    <div
                      className={`ticket-timer${order.status === 'new' ? ' timer-new' : ''}`}
                      aria-label={`Tempo de espera ${elapsedTime(order.createdAt, now)}`}
                    >
                      <Clock3 size={16} />
                      <strong>{elapsedTime(order.createdAt, now)}</strong>
                    </div>
                  </header>
                  <div className="ticket-status-row">
                    <span
                      className={`ticket-status-badge badge-${order.status}`}
                    >
                      <i />
                      {statusNames[order.status]}
                    </span>
                    <span className="ticket-time">
                      {new Date(order.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="ticket-customer">
                    <span>Cliente</span>
                    <strong>{order.customerName || 'Sem nome'}</strong>
                  </div>
                  <div className="ticket-items">
                    {order.items.map((item) => (
                      <div className="ticket-item" key={item.id}>
                        <div className="ticket-item-title">
                          <b>{item.quantity}×</b>
                          <strong>{item.name}</strong>
                        </div>
                        {item.customization.meatPoint && (
                          <p className="ticket-detail">
                            Carne: {item.customization.meatPoint.toLowerCase()}
                          </p>
                        )}
                        {item.customization.addOns.map((addOn) => (
                          <p
                            className="ticket-detail ticket-extra"
                            key={addOn.slug}
                          >
                            + {addOn.name}
                          </p>
                        ))}
                        {item.customization.removedIngredients.map(
                          (ingredient) => (
                            <p className="ticket-warning" key={ingredient}>
                              <TriangleAlert size={14} /> SEM{' '}
                              {ingredient.toUpperCase()}
                            </p>
                          ),
                        )}
                        {item.customization.notes && (
                          <p className="ticket-warning">
                            <TriangleAlert size={14} />{' '}
                            {item.customization.notes.toUpperCase()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <footer className="ticket-footer">
                    <span>
                      Total <strong>{formatBRL(orderTotal(order))}</strong>
                    </span>
                    <button
                      className="ticket-action"
                      type="button"
                      disabled={busyOrderId === order.id}
                      onClick={() => void advanceOrder(order)}
                    >
                      {busyOrderId === order.id ? 'Salvando...' : next.label}
                      {order.status === 'ready' ? (
                        <Check size={17} />
                      ) : (
                        <ChevronRightIcon />
                      )}
                    </button>
                  </footer>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {toast && (
        <div className="kds-toast" role="status">
          <Bell size={17} />
          {toast}
        </div>
      )}
    </main>
  );
}

function ChevronRightIcon() {
  return <span aria-hidden="true">›</span>;
}

function KitchenGate({ children }: { children: React.ReactNode }) {
  return (
    <main className="kitchen-gate">
      <Link className="gate-brand" href="/mesa/04">
        <span>
          <ChefHat size={20} />
        </span>
        Lanche do Mega
      </Link>
      {children}
    </main>
  );
}
