import PwaRegister from '@/components/pwa-register';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lanche do Mega | Pedido na mesa',
  description: 'Peça seu lanche sem fila. O Mega prepara tudo na hora.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#fff7ea',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
