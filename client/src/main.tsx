import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { Home } from './routes/Home';
import { Room } from './routes/Room';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/r/:roomCode', element: <Room /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
