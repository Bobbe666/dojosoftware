import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/designsystem.css';
import './styles/themes.css';
import './styles/Buttons.css';
import './styles/components.css';
import { DatenProvider } from '@shared/DatenContext.jsx';
import axios from 'axios';
import config from './config/config.js';

// Axios-Basis-URL konfigurieren
axios.defaults.baseURL = `${config.apiBaseUrl}/api`;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DatenProvider>
      <App />
    </DatenProvider>
  </React.StrictMode>
);
