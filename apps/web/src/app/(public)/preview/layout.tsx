import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PreviewShell } from '@/components/shared/preview-shell';

export const metadata: Metadata = {
  title: 'Hotel booking UI preview',
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <PreviewShell>{children}</PreviewShell>;
}
