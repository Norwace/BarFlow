import React from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import App from './App';
import { useStore } from './store';
import * as actions from './actions';

(window as any).__bfStore = useStore;
(window as any).__bfActions = actions;

createRoot(document.getElementById('root')!).render(<App />);
