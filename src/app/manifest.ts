import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lanche do Mega - Hamburgueria',
    short_name: 'Lanche do Mega',
    description: 'Peça na mesa e acompanhe seu pedido.',
    start_url: '/mesa/04',
    display: 'standalone',
    background_color: '#fff7ea',
    theme_color: '#fff7ea',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
