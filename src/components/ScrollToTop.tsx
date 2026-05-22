import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Reset window scroll when the route changes (e.g. draft complete → new mock draft). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
