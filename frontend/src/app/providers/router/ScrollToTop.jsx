import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname, state } = useLocation();
  const restoringChart = state?.scrollToChart === true;
  const scrollToSection = state?.scrollToSection;

  useLayoutEffect(() => {
    if (scrollToSection && pathname === '/') {
      const frame = window.requestAnimationFrame(() => {
        document.getElementById(scrollToSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return () => window.cancelAnimationFrame(frame);
    }
		if (restoringChart) return undefined;

		const root = document.documentElement;
		const body = document.body;
		const previousBehavior = root.style.getPropertyValue('scroll-behavior');
		const previousPriority = root.style.getPropertyPriority('scroll-behavior');
		let resetFrame = 0;
		let settleFrame = 0;
		let restoreFrame = 0;
		let restored = false;

		const restoreBehavior = () => {
			if (restored) return;
			restored = true;
			if (previousBehavior) root.style.setProperty('scroll-behavior', previousBehavior, previousPriority);
			else root.style.removeProperty('scroll-behavior');
		};
		const resetScroll = () => {
			window.scrollTo(0, 0);
			root.scrollTop = 0;
			body.scrollTop = 0;
		};

		// Keep the root in instant-scroll mode while the browser and the new route settle.
		root.style.setProperty('scroll-behavior', 'auto', 'important');
		resetScroll();
		resetFrame = window.requestAnimationFrame(resetScroll);
		settleFrame = window.requestAnimationFrame(() => {
			resetScroll();
			restoreFrame = window.requestAnimationFrame(restoreBehavior);
		});

		return () => {
			window.cancelAnimationFrame(resetFrame);
			window.cancelAnimationFrame(settleFrame);
			window.cancelAnimationFrame(restoreFrame);
			restoreBehavior();
		};
  }, [pathname, restoringChart, scrollToSection]);

  return null;
};


export default ScrollToTop;
