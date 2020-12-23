import React, { createContext, useContext } from "react"

import { useNetlifyIdentity } from "./useNetlifyIdentity"

// Create a Context to hold the identity state
const IdentityContext = createContext()

// Export hook to access identity easily
const useIdentityContext = () => useContext(IdentityContext)

// Top level wrapper around the app to instantiate context
const NetlifyIdentityContext = ({ url, children }) => {
  if (!url) throw new Error('No Identity URL defined! Use format https://example.com - no trailing slash')

  const identity = useNetlifyIdentity({ url })

  return (
    <IdentityContext.Provider value={identity}>
      {children}
    </IdentityContext.Provider>
  )
}

export {
  NetlifyIdentityContext as default,
  useIdentityContext
}
