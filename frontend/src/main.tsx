// This is the real entry point of the React app (index.html just hands off to this file).
// It creates the router and mounts the app into the <div id="root"> in index.html.
//
// Rendering flow - how a URL becomes a page:
//
// index.html <div id="root">
//   └── RouterProvider (intercepts the URL, no page reload)
//         └── __root.tsx (wrapper always rendered regardless of the URL)
//               └── _public/route.tsx  if the route requires no login  (header + footer)
//               └── _authenticated/route.tsx  if the route requires login  (navbar + sidebar + footer)
//                     └── the matching page component

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
  // StrictMode is only for dev time, not prod
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
