import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname, state } = useLocation();
  const restoringChart = state?.scrollToChart === true;

  useEffect(() => {
    if (!restoringChart) window.scrollTo(0, 0);
  }, [pathname, restoringChart]);

  return null;
};


export default ScrollToTop;
