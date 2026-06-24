import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'

// 1. Import the auto-generated route tree
import { routeTree } from './routeTree.gen'

// 2. Create the router instance
const router = createRouter({ routeTree })

// 3. Register the router type for TypeScript type-safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 4. Mount the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
