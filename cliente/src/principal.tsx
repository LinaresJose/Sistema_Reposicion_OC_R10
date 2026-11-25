import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './estilos-globales.css';

const elementoRaiz = document.getElementById('raiz');

if (elementoRaiz) {
  ReactDOM.createRoot(elementoRaiz).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
