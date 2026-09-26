import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';
import App from './App';
import './styles/index.css';

function AppWithMotionConfig() {
  const reduced = useReducedMotion();
  
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <App />
    </MotionConfig>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithMotionConfig />
  </React.StrictMode>,
);
