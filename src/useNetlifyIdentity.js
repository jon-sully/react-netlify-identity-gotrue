import { useState, useEffect } from 'react'
import { parseTokenFromLocation } from './parseTokenFromLocation'

const STORAGE_KEY = 'nid.token'

const useNetlifyIdentity = ({ url: _url }) => {
  const [persistedToken, setPersistedToken] = useState()
  const [tokenExpiration, setTokenExpiration] = useState()
  const [provisionalUser, setProvisionalUser] = useState()
  const [urlToken, setUrlToken] = useState()
  const url = `${_url}/.netlify/identity`

  // Make sure token in LocalStorage is always up to date and tokenExpiration
  // state is always correct
  useEffect(() => {
    if (persistedToken) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedToken))
      setTokenExpiration(
        new Date(
          JSON.parse(
            urlBase64Decode(persistedToken.token.access_token.split('.')[1])
          ).exp * 1000
        )
      )
    }
  }, [persistedToken])

  // Keep the token fresh if expired
  useEffect(() => {
    tokenExpiration && refreshToken()
  }, [tokenExpiration])

  // Loads Token from LocalStorage; only run once
  useEffect(() => {
    const persistedToken = localStorage.getItem(STORAGE_KEY)
    persistedToken && setPersistedToken(JSON.parse(persistedToken)) && setProvisionalUser()
  }, [])

  // Grab the urlToken from location if exists
  useEffect(() => {
    setUrlToken(parseTokenFromLocation())
  }, [])

  // Token-dependent only
  useEffect(() => {
    if (urlToken) {
      switch (urlToken.type) {
        case 'confirmation':
          // TODO: Handle failure case (clicked again)
          console.log('Confirming User')
          fetch(`${url}/verify`, {
            method: 'POST',
            body: JSON.stringify({
              token: urlToken.token,
              type: 'signup'
            })
          })
            .then(resp => resp.json())
            .then(setupUserFromToken)
            .then(() => {
              setUrlToken()
            })
          break
        case 'recovery':
          console.log('Recovering User')
          fetch(`${url}/verify`, {
            method: 'POST',
            body: JSON.stringify({
              token: urlToken.token,
              type: 'recovery'
            })
          })
            .then(resp => resp.json())
            .then(setupUserFromToken)
          // Explicitly not setting the urlToken to null so that a password
          // reset can occur (this just logs the user in first)
          break
        default:
          return
      }
    }

  }, [urlToken])

  // Token and User dependent since user needs to be logged in to run email_change
  useEffect(() => {
    if (urlToken && urlToken.type === 'email_change' && persistedToken) {
      console.log('Confirming Email Change')
      update({ email_change_token: urlToken.token })
        .then(() => setUrlToken())
    }
  }, [urlToken, persistedToken])

  // API: The handler for urlTokens which require the user to set a password in
  // addition to the urlToken
  const completeUrlTokenTwoStep = async ({ password, ...rest }) => {
    if (urlToken?.type === 'recovery') {
      console.log('Updating Password & Clearing URL Token')
      update({ password })
        .then(() => setUrlToken())
    }
    else if (urlToken?.type === 'invite') {
      console.log('Setting Up Invited User')
      // Initial POST only sets the password
      const token = await fetch(`${url}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          token: urlToken.token,
          type: 'signup',
          password,
        })
      }).then(resp => resp.json())
      await setupUserFromToken(token)
      // Subsequent update covers the rest of the fields (name, etc.)
      await _update({ data: rest }, token)
      setUrlToken()
    }
  }

  // API: Log out current user
  const logout = async () => {
    localStorage.removeItem(STORAGE_KEY)
    setPersistedToken()
    setTokenExpiration()
  }

  // API: Log in user
  const login = async ({ email, password }) => {
    await getToken({ email, password })
  }

  // API: Sign up as a new user - email, password, data: { full_name: }, etc.
  // Sets the provisional user for visibility's sake
  const signup = async (props) => {
    const user = await fetch(`${url}/signup`, {
      method: 'POST',
      body: JSON.stringify(props)
    }).then(resp => resp.json())
    setProvisionalUser(user)
  }

  // API: Update user info - update({ email, password, data: { full_name: } }), etc.
  const update = async (props) => {
    await _update(props)
  }

  // Not for public API; allows manual access_token specification
  const _update = async (props, token) => {
    const user = await authorizedFetch(`${url}/user`, {
      method: 'PUT',
      body: JSON.stringify(props)
    }, token)
      .then(resp => resp.json())

    setPersistedToken({ token, ...persistedToken, ...user })
  }

  // API: Requests a password recovery email for the specified email-user
  const sendPasswordRecovery = async ({ email }) => {
    return fetch(`${url}/recover`, {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  }

  // API: Fetch wrapper that always ensures a fresh token (for Auth'd Functions usage)
  const authorizedFetch = async (url, options, token = persistedToken.token) => {
    const updatedToken = await refreshToken()
    return fetch(url, { headers: { 'Authorization': `Bearer ${updatedToken || token.access_token}` }, ...options })
  }

  // API: A forced data refresh for if the User changes externally (from Function
  // or otherwise)
  const refreshUser = async () => {
    await refreshToken(true)
  }

  // Refresh JWT if server won't ratify it anymore (expired)
  const refreshToken = async (force = false) => {
    const now = new Date()
    if (force || (tokenExpiration && now > tokenExpiration)) {
      const token = await getTokenByRefresh({ refreshToken: persistedToken.token.refresh_token }).then(resp => resp.json())
      if (token?.error_description) {
        throw new Error(token.error_description)
      }
      setupUserFromToken(token)
      return token
    }
  }

  // Get token from login 
  const getToken = async ({ email, password }) => {
    const token = await getTokenByEmailAndPassword({ email, password }).then(resp => resp.json())
    if (token?.error_description) {
      // If there's an error refreshing the token, just bail on the persistence
      logout()
      throw new Error(token.error_description)
    }
    setupUserFromToken(token)
  }

  // Converts the {access_token, refresh_token} response into the in-memory
  // combination of that _and_ the /user definition 
  const setupUserFromToken = async (token) => {
    const user = await authorizedFetch(`${url}/user`, {}, token).then(resp => resp.json())
    setPersistedToken({ token, ...user })
  }

  const getTokenByEmailAndPassword = async ({ email, password }) => {
    return fetch(`${url}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=password&username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    })
  }

  const getTokenByRefresh = async ({ refreshToken }) => {
    return fetch(`${url}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    })
  }

  return {
    login,
    logout,
    update,
    signup,
    urlToken,
    refreshUser,
    persistedToken,
    authorizedFetch,
    provisionalUser,
    user: persistedToken,
    sendPasswordRecovery,
    completeUrlTokenTwoStep,
  }
}

function urlBase64Decode(str) {
  // From https://jwt.io/js/jwt.js
  var output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string!')
  }
  var result = window.atob(output); //polifyll https://github.com/davidchambers/Base64.js
  try {
    return decodeURIComponent(escape(result));
  } catch (err) {
    return result;
  }
}

export {
  useNetlifyIdentity
}
