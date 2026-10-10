import Image from 'next/image';

import styles from './site-chrome.module.css';

export function SiteLogo({ preload = false }: { preload?: boolean }) {
  return (
    <Image
      src="/images/best-holiday-packages-logo.png"
      alt="Best Holiday Packages"
      width={1044}
      height={653}
      sizes="(max-width: 640px) 128px, 180px"
      className={styles.brandImage}
      preload={preload}
    />
  );
}
