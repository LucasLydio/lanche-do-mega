export type MenuCategory =
  | 'Lanches'
  | 'Acompanhamentos'
  | 'Bebidas'
  | 'Sobremesas'
  | 'Adicionais';

export type MenuItem = {
  slug: string;
  name: string;
  description: string;
  category: MenuCategory;
  priceCents: number;
  image: string;
  featured?: boolean;
  customizable?: boolean;
};

export const MENU_CATEGORIES: MenuCategory[] = [
  'Lanches',
  'Acompanhamentos',
  'Bebidas',
  'Sobremesas',
  'Adicionais',
];

export const MENU_ITEMS: MenuItem[] = [
  {
    slug: 'mega-classico',
    name: 'Mega Clássico',
    description: 'Smash 160g, queijo prato, cebola na chapa e molho da casa.',
    category: 'Lanches',
    priceCents: 3290,
    image: '/images/buguer02.jpg',
    featured: true,
    customizable: true,
  },
  {
    slug: 'duplo-bacon',
    name: 'Duplo Bacon',
    description: 'Dois smash, cheddar cremoso, bacon crocante e barbecue.',
    category: 'Lanches',
    priceCents: 3890,
    image: '/images/buguer03.jpg',
    customizable: true,
  },
  {
    slug: 'frango-crocante',
    name: 'Frango Crocante',
    description: 'Frango empanado, coleslaw fresquinha e maionese de limão.',
    category: 'Lanches',
    priceCents: 2990,
    image: '/images/buguer04.jpg',
    customizable: true,
  },
  {
    slug: 'veg-do-mega',
    name: 'Veg do Mega',
    description: 'Burger de grão-de-bico, queijo coalho e relish de pepino.',
    category: 'Lanches',
    priceCents: 3190,
    image: '/images/buguer05.jpg',
    customizable: true,
  },
  {
    slug: 'fritas-da-casa',
    name: 'Fritas da Casa',
    description: 'Porção individual com páprica e maionese temperada.',
    category: 'Acompanhamentos',
    priceCents: 1490,
    image: '/images/fries.png',
  },
  {
    slug: 'fritas-cheddar-bacon',
    name: 'Fritas Cheddar & Bacon',
    description: 'Fritas sequinhas, cheddar cremoso e bacon crocante.',
    category: 'Acompanhamentos',
    priceCents: 2290,
    image: '/images/extras.png',
  },
  {
    slug: 'limonada-da-casa',
    name: 'Limonada da Casa',
    description: 'Limão espremido na hora, bem gelada. 400ml.',
    category: 'Bebidas',
    priceCents: 990,
    image: '/images/drink.png',
  },
  {
    slug: 'cola-gelada',
    name: 'Cola Gelada',
    description: 'Lata 350ml, servida bem gelada.',
    category: 'Bebidas',
    priceCents: 790,
    image: '/images/drink.png',
  },
  {
    slug: 'brownie-quente',
    name: 'Brownie Quentinho',
    description: 'Brownie de chocolate com uma bola de sorvete de baunilha.',
    category: 'Sobremesas',
    priceCents: 1690,
    image: '/images/dessert.png',
  },
  {
    slug: 'queijo-cheddar-extra',
    name: 'Queijo cheddar',
    description: 'Uma camada extra de cheddar cremoso.',
    category: 'Adicionais',
    priceCents: 450,
    image: '/images/extras.png',
  },
  {
    slug: 'bacon-extra',
    name: 'Bacon crocante',
    description: 'Bacon em tiras, douradinho na chapa.',
    category: 'Adicionais',
    priceCents: 550,
    image: '/images/extras.png',
  },
];

export const ADD_ONS = MENU_ITEMS.filter(
  (item) => item.category === 'Adicionais',
);

export function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
