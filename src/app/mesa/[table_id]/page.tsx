'use client';

import "./menu.css";
import "./ordering.css";
import "./responsive.css";

import {
  ADD_ONS,
  MENU_CATEGORIES,
  MENU_ITEMS,
  formatBRL,
  type MenuCategory,
  type MenuItem,
} from '@/lib/menu';
import {
  createOrder,
  orderTotal,
  type Order,
  type OrderCustomization,
  type OrderLine,
} from '@/lib/orders';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type ItemDraft = {
  meatPoint: string;
  removedIngredients: string[];
  addOnSlugs: string[];
  notes: string;
};

const emptyDraft = (): ItemDraft => ({
  meatPoint: '',
  removedIngredients: [],
  addOnSlugs: [],
  notes: '',
});

const removableIngredients = ['Cebola', 'Picles', 'Tomate', 'Alface'];

function defaultCustomization(): OrderCustomization {
  return { removedIngredients: [], addOns: [], notes: '' };
}

export default function CustomerOrderingPage() {
  const params = useParams<{ table_id: string }>();
  const tableNumber = decodeURIComponent(params.table_id || '04');
  const [category, setCategory] = useState<MenuCategory>('Lanches');
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderSent, setOrderSent] = useState(false);

  const visibleItems = MENU_ITEMS.filter((item) => item.category === category);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = orderTotal({ items: cart });
  const isBeefBurger =
    activeItem?.slug === 'mega-classico' || activeItem?.slug === 'duplo-bacon';
  const selectedAddOns = draft.addOnSlugs.flatMap((slug) =>
    ADD_ONS.filter((item) => item.slug === slug),
  );
  const editedPrice = activeItem
    ? activeItem.priceCents +
      selectedAddOns.reduce((total, item) => total + item.priceCents, 0)
    : 0;

  function openItem(item: MenuItem) {
    if (!item.customizable) {
      addQuickItem(item);
      return;
    }
    setDraft(emptyDraft());
    setActiveItem(item);
  }

  function addQuickItem(item: MenuItem) {
    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        itemSlug: item.slug,
        name: item.name,
        quantity: 1,
        unitPriceCents: item.priceCents,
        customization: defaultCustomization(),
      },
    ]);
    setOrderSent(false);
    setSubmitError('');
  }

  function saveCustomizedItem() {
    if (!activeItem) return;
    const addOns = selectedAddOns.map(({ slug, name, priceCents }) => ({
      slug,
      name,
      priceCents,
    }));
    const customization: OrderCustomization = {
      meatPoint: draft.meatPoint || undefined,
      removedIngredients: draft.removedIngredients,
      addOns,
      notes: draft.notes.trim(),
    };
    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        itemSlug: activeItem.slug,
        name: activeItem.name,
        quantity: 1,
        unitPriceCents: editedPrice,
        customization,
      },
    ]);
    setActiveItem(null);
    setOrderSent(false);
    setSubmitError('');
  }

  function changeQuantity(lineId: string, change: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === lineId
            ? { ...line, quantity: line.quantity + change }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    const order: Order = {
      id: crypto.randomUUID(),
      tableNumber,
      customerName: customerName.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
      items: cart,
    };

    try {
      await createOrder(order);
      setCart([]);
      setCustomerName('');
      setCartOpen(false);
      setOrderSent(true);
    } catch {
      setSubmitError(
        'Não conseguimos enviar agora. Confira a conexão e tente de novo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleIngredient(ingredient: string) {
    setDraft((current) => ({
      ...current,
      removedIngredients: current.removedIngredients.includes(ingredient)
        ? current.removedIngredients.filter((item) => item !== ingredient)
        : [...current.removedIngredients, ingredient],
    }));
  }

  function toggleAddOn(slug: string) {
    setDraft((current) => ({
      ...current,
      addOnSlugs: current.addOnSlugs.includes(slug)
        ? current.addOnSlugs.filter((item) => item !== slug)
        : [...current.addOnSlugs, slug],
    }));
  }

  return (
    <div className="shop-app">
      <header className="shop-header">
        <Link
          className="brand-lockup"
          href={`/mesa/${encodeURIComponent(tableNumber)}`}
          aria-label="Lanche do Mega, início"
        >
          <span className="brand-mark">
            <Store size={20} strokeWidth={2.5} />
          </span>
          <span className="brand-name">
            Lanche <b>do Mega</b>
          </span>
        </Link>
        <div className="header-actions">
          <span className="table-pill">
            <span className="status-dot" /> Mesa {tableNumber}
          </span>
          <Link className="kitchen-link" href="/cozinha">
            Cozinha <ChevronRight size={16} />
          </Link>
        </div>
      </header>

      <main className="shop-main">
        <section className="shop-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> Feito na hora, do seu jeito
            </p>
            <h1 id="hero-title">
              Bateu a fome?
              <br />
              <em>Chama o Mega.</em>
            </h1>
            <p className="hero-description">
              Escolha seu favorito e a gente prepara fresquinho pra você.
            </p>
            <a className="hero-action" href="#cardapio">
              Ver o cardápio <ChevronRight size={18} />
            </a>
          </div>
          <div className="hero-image-wrap">
            <Image
              className="hero-image"
              src="/images/buguer03.jpg"
              alt="Hambúrguer artesanal com queijo e salada"
              fill
              priority
              loading="eager"
              sizes="(min-width: 900px) 40vw, 48vw"
            />
            <span className="hero-stamp">
              <span>100%</span>
              <br />
              na chapa
            </span>
          </div>
          <div className="hero-footnote">
            <Clock3 size={15} /> Preparo médio de 15 a 20 min
          </div>
        </section>

        {orderSent && (
          <div className="order-success" role="status">
            <CheckCircle2 size={24} />
            <div>
              <strong>Pedido enviado para a cozinha!</strong>
              <span>Já estamos preparando tudo na Mesa {tableNumber}.</span>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setOrderSent(false)}
              aria-label="Fechar confirmação"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <section
          id="cardapio"
          className="menu-section"
          aria-labelledby="menu-title"
        >
          <div className="menu-heading">
            <div>
              <p className="eyebrow">Cardápio da casa</p>
              <h2 id="menu-title">O que vai ser hoje?</h2>
            </div>
            <p className="menu-hint">
              Tudo preparado na hora <span>•</span> ingredientes frescos
            </p>
          </div>

          <nav className="category-tabs" aria-label="Categorias do cardápio">
            {MENU_CATEGORIES.map((item) => (
              <button
                className={`category-tab${category === item ? ' is-active' : ''}`}
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="menu-grid">
            {visibleItems.map((item) => (
              <article className="menu-item" key={item.slug}>
                <button
                  className="menu-item-image-button"
                  type="button"
                  onClick={() => openItem(item)}
                  aria-label={`Ver ${item.name}`}
                >
                  <Image
                    className="menu-item-image"
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 900px) 25vw, (min-width: 600px) 33vw, 50vw"
                    loading="lazy"
                  />
                  {item.featured && (
                    <span className="popular-badge">Queridinho</span>
                  )}
                </button>
                <div className="menu-item-copy">
                  <div className="menu-item-title-row">
                    <h3>{item.name}</h3>
                    <span className="menu-item-price">
                      {formatBRL(item.priceCents)}
                    </span>
                  </div>
                  <p>{item.description}</p>
                  <button
                    className="add-item-button"
                    type="button"
                    onClick={() => openItem(item)}
                  >
                    {item.customizable ? (
                      <>
                        <span>Personalizar</span>
                        <Plus size={16} />
                      </>
                    ) : (
                      <>
                        <span>Adicionar</span>
                        <Plus size={16} />
                      </>
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="shop-footer">
          <span className="brand-name">
            Lanche <b>do Mega</b>
          </span>
          <span>Feito com fome e carinho.</span>
          <Link href="/cozinha">Acesso da cozinha</Link>
        </footer>
      </main>

      {itemCount > 0 && !cartOpen && (
        <button
          className="cart-fab"
          type="button"
          onClick={() => setCartOpen(true)}
        >
          <span className="cart-fab-icon">
            <ShoppingBag size={21} />
            <b>{itemCount}</b>
          </span>
          <span className="cart-fab-label">Ver pedido</span>
          <strong>{formatBRL(cartTotal)}</strong>
          <ChevronRight size={19} />
        </button>
      )}

      {activeItem && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setActiveItem(null)
          }
        >
          <section
            className="item-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-dialog-title"
          >
            <button
              className="dialog-close icon-button"
              type="button"
              onClick={() => setActiveItem(null)}
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
            <Image
              className="dialog-image"
              src={activeItem.image}
              alt=""
              width={900}
              height={700}
            />
            <div className="dialog-body">
              <p className="eyebrow">Personalize do seu jeito</p>
              <h2 id="item-dialog-title">{activeItem.name}</h2>
              <p className="dialog-description">{activeItem.description}</p>

              {isBeefBurger && (
                <fieldset className="option-group">
                  <legend>
                    Ponto da carne <span>opcional</span>
                  </legend>
                  <div className="choice-row">
                    {['Ao ponto', 'Bem passado'].map((point) => (
                      <label
                        className={`choice-chip${draft.meatPoint === point ? ' is-selected' : ''}`}
                        key={point}
                      >
                        <input
                          type="radio"
                          name="meat-point"
                          value={point}
                          checked={draft.meatPoint === point}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              meatPoint: point,
                            }))
                          }
                        />
                        {point}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className="option-group">
                <legend>
                  Quer tirar algo? <span>opcional</span>
                </legend>
                <div className="choice-row">
                  {removableIngredients.map((ingredient) => (
                    <label
                      className={`choice-chip${draft.removedIngredients.includes(ingredient) ? ' is-selected' : ''}`}
                      key={ingredient}
                    >
                      <input
                        type="checkbox"
                        checked={draft.removedIngredients.includes(ingredient)}
                        onChange={() => toggleIngredient(ingredient)}
                      />
                      Sem {ingredient.toLowerCase()}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="option-group">
                <legend>
                  Adicionar um extra <span>opcional</span>
                </legend>
                <div className="option-list">
                  {ADD_ONS.map((addOn) => (
                    <label className="option-row" key={addOn.slug}>
                      <span
                        className={`check-box${draft.addOnSlugs.includes(addOn.slug) ? ' is-checked' : ''}`}
                        aria-hidden="true"
                      >
                        {draft.addOnSlugs.includes(addOn.slug) && (
                          <Check size={14} />
                        )}
                      </span>
                      <input
                        className="visually-hidden"
                        type="checkbox"
                        checked={draft.addOnSlugs.includes(addOn.slug)}
                        onChange={() => toggleAddOn(addOn.slug)}
                      />
                      <span>{addOn.name}</span>
                      <strong>+ {formatBRL(addOn.priceCents)}</strong>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="field-label" htmlFor="item-notes">
                Algum recado pra cozinha?
              </label>
              <textarea
                id="item-notes"
                className="text-input note-input"
                value={draft.notes}
                maxLength={140}
                placeholder="Ex.: cortar ao meio"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
              <button
                className="primary-button dialog-add-button"
                type="button"
                onClick={saveCustomizedItem}
              >
                <span>Adicionar ao pedido</span>
                <strong>{formatBRL(editedPrice)}</strong>
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div
          className="scrim cart-scrim"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setCartOpen(false)
          }
        >
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <header className="cart-header">
              <div>
                <p className="eyebrow">Mesa {tableNumber}</p>
                <h2 id="cart-title">
                  Seu pedido <span>({itemCount})</span>
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Fechar sacola"
              >
                <X size={21} />
              </button>
            </header>
            {cart.length === 0 ? (
              <div className="cart-empty">
                <ShoppingBag size={30} />
                <p>Sua sacola está vazia.</p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setCartOpen(false)}
                >
                  Voltar ao cardápio
                </button>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cart.map((line) => (
                    <article className="cart-line" key={line.id}>
                      <div className="cart-line-main">
                        <div>
                          <h3>{line.name}</h3>
                          <span>{formatBRL(line.unitPriceCents)} cada</span>
                        </div>
                        <button
                          className="remove-line icon-button"
                          type="button"
                          onClick={() =>
                            changeQuantity(line.id, -line.quantity)
                          }
                          aria-label={`Remover ${line.name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      {(line.customization.meatPoint ||
                        line.customization.removedIngredients.length > 0 ||
                        line.customization.addOns.length > 0 ||
                        line.customization.notes) && (
                        <p className="cart-customization">
                          {[
                            line.customization.meatPoint,
                            ...line.customization.removedIngredients.map(
                              (item) => `Sem ${item.toLowerCase()}`,
                            ),
                            ...line.customization.addOns.map(
                              (item) => `+ ${item.name}`,
                            ),
                            line.customization.notes,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      <div className="cart-line-bottom">
                        <div className="quantity-control">
                          <button
                            type="button"
                            onClick={() => changeQuantity(line.id, -1)}
                            aria-label="Diminuir quantidade"
                          >
                            <Minus size={15} />
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(line.id, 1)}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                        <strong>
                          {formatBRL(line.unitPriceCents * line.quantity)}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
                <form className="checkout-form" onSubmit={submitOrder}>
                  <label className="field-label" htmlFor="customer-name">
                    Seu nome <span>(opcional)</span>
                  </label>
                  <input
                    id="customer-name"
                    className="text-input"
                    value={customerName}
                    maxLength={60}
                    placeholder="Como podemos te chamar?"
                    onChange={(event) => setCustomerName(event.target.value)}
                  />
                  {submitError && (
                    <p className="form-error" role="alert">
                      {submitError}
                    </p>
                  )}
                  <div className="cart-total-row">
                    <span>Total</span>
                    <strong>{formatBRL(cartTotal)}</strong>
                  </div>
                  <button
                    className="primary-button checkout-button"
                    type="submit"
                    disabled={submitting}
                  >
                    <span>
                      {submitting
                        ? 'Enviando pedido...'
                        : 'Enviar para a cozinha'}
                    </span>
                    <ChevronRight size={19} />
                  </button>
                  <p className="checkout-note">
                    <ChefHat size={15} /> Seu pedido vai direto para a chapa.
                  </p>
                </form>
              </>
            )}
          </aside>
        </div>
      )}

      {orderSent && (
        <button
          className="success-cart-link"
          type="button"
          onClick={() => setOrderSent(false)}
        >
          <ArrowLeft size={16} /> Continuar escolhendo
        </button>
      )}
    </div>
  );
}
