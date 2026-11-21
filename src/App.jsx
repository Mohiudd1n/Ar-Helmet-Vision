import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import WelcomeScreen from './screens/WelcomeScreen.jsx';
import CatalogScreen from './screens/CatalogScreen.jsx';
import { getHelmet } from './data/helmets.js';

const TryOnScreen = lazy(() => import('./screens/TryOnScreen.jsx'));
const FitStudio = lazy(() => import('./screens/FitStudio.jsx'));

/**
 * Three screens, driven by the URL hash so the phone's back button works:
 *   #/              Welcome (greeting)
 *   #/catalog       Helmet catalog (2 brands, live 3D previews)
 *   #/try/<id>      AR try-on for one helmet
 *   #/studio/<id>   Developer fit calibration (not linked from the UI)
 */
function parseHash() {
  const path = window.location.hash.replace(/^#/, '') || '/';
  const [, screen = '', id = ''] = path.split('/');
  return { screen, id: decodeURIComponent(id) };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((path) => {
    window.location.hash = path;
  }, []);

  let content;
  if (route.screen === 'catalog') {
    content = <CatalogScreen navigate={navigate} />;
  } else if (route.screen === 'try' && getHelmet(route.id)) {
    content = <TryOnScreen key="tryon" helmetId={route.id} navigate={navigate} />;
  } else if (route.screen === 'studio') {
    content = <FitStudio helmetId={route.id} navigate={navigate} />;
  } else {
    content = <WelcomeScreen navigate={navigate} />;
  }

  return (
    <main className="w-full h-[100dvh] bg-black text-white overflow-hidden">
      <Suspense fallback={<div className="w-full h-full grid place-items-center text-zinc-500 text-sm">Loading…</div>}>
        {content}
      </Suspense>
    </main>
  );
}
