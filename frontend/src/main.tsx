import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'

// 1. Importe l'arbre généré
import { routeTree } from './routeTree.gen'

// 2. Initialise le routeur
const router = createRouter({ routeTree })

// 3. Déclare le type pour le routeur (pour TypeScript)
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 4. Rendu de l'application avec le Provider
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
