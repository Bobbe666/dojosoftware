// Service Worker temporarily disabled to fix cache issues
export const registerServiceWorker = () => {
  console.log('Service Worker registration disabled');
  return () => {};
};
