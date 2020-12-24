import { useState, useEffect, useMemo, useCallback } from 'react'
import { parseTokenFromLocation } from './parseTokenFromLocation'

const STORAGE_KEY = 'identityData'
// const TOKEN_REFRESH_INTERVAL = 20_000
const TWENTY_MINUTES = 1000 * 30 // milli * sec * min
const THREE_MINUTES = 1000 * 60 * 3 //milliseconds * sec * min

const useNetlifyIdentity = ({ url: _url }) => {
  const [identityData, setIdentityData] = useState()
  const [provisionalUser, setProvisionalUser] = useState()
  const [pendingUpdate, setPendingUpdate] = useState()
  const [urlToken, setUrlToken] = useState()
  const url = useMemo(() => `${_url}/.netlify/identity`, [_url])

  // Any time the identityData changes, make sure it gets cloned down to
  // localStorage and setup refreshToken polling
  useEffect(() => {
    if (identityData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identityData))

      // Define async token refresh procedure
      const refreshToken = async () => {
        if (!identityData) throw new Error('Cannot refresh token when not logged in')

        const now = new Date()
        const tokenExpiresAt = new Date(identityData.token.expires_at)

        // Refresh the token if it expires within twenty minutes
        if (now > (tokenExpiresAt - TWENTY_MINUTES)) {
          console.log('Refreshing Auth Token')
          const token = await fetch(`${url}/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=refresh_token&refresh_token=${identityData.token.refresh_token}`,
          }).then(resp => resp.json())
          if (token?.error_description) {
            // Any error refreshing the token will mean the local token is stale and
            // won't work for Functions etc. - better to just log user out and re-auth
            logout()
            throw new Error(token.error_description)
          }
          setToken(token)
        }
      }

      // Configure automatic token refreshing - run refreshToken every 5 minutes
      refreshToken()
      const interval = setInterval(() => refreshToken(), THREE_MINUTES)
      return () => {
        clearInterval(interval)
      }
    }
  }, [identityData, url])

  // Loads identityData from LocalStorage on page load
  useEffect(() => {
    const identityData = localStorage.getItem(STORAGE_KEY)
    if (identityData) {
      setIdentityData(JSON.parse(identityData))
      setProvisionalUser()
    }
  }, [])

  // Grab the urlToken from location if exists
  useEffect(() => {
    setUrlToken(parseTokenFromLocation())
  }, [])

  // urlToken-dependent only
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
            .then(token => {
              // Confirmation email clicked second time+
              if (token.code === "404") {
                logout()
                throw new Error('Confirmation already used')
              }
              setToken(token)
            })
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
            .then(setToken)
          // Explicitly not setting the urlToken to null so that a password
          // reset can occur (this just logs the user in first)
          break
        default:
          return
      }
    }

  }, [urlToken, url])

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
      setToken(token)
      setPendingUpdate({ data: rest })
      setUrlToken()
    }
  }

  // API: Thin fetch wrapper for Authenticated Functions
  const authorizedFetch = useCallback(async (url, options) => {
    if (!identityData) throw new Error('No user set for authorized fetch')

    // return refreshToken(false, token)
    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        'Authorization': `Bearer ${identityData.token.access_token}`
      },
    })
  }, [identityData])

  // API: Log out current user
  const logout = async () => {
    localStorage.removeItem(STORAGE_KEY)
    setIdentityData()
  }

  // API: Log in user
  const login = async ({ email, password }) => {
    const token = await fetch(`${url}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=password&username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    }).then(resp => resp.json())
    if (token?.error_description) {
      throw new Error(token.error_description)
    }
    setToken(token)
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
  const update = useCallback(async (props) => {
    const user = await authorizedFetch(`${url}/user`, {
      method: 'PUT',
      body: JSON.stringify(props)
    })
      .then(resp => resp.json())

    setIdentityData(prevIdentityData => {
      return {
        token: prevIdentityData?.token,
        user: {
          ...prevIdentityData?.user,
          ...user
        }
      }
    })
  }, [url, authorizedFetch])

  // Async update - mostly applies for the invite-token workflow when saving
  // more data on a new account than just the password
  useEffect(() => {
    if (identityData?.token && identityData?.user && pendingUpdate) {
      update(pendingUpdate)
      setPendingUpdate()
    }
  }, [identityData, pendingUpdate, update])

  // Token and User dependent since user needs to be logged in to run email_change
  useEffect(() => {
    if (urlToken && urlToken.type === 'email_change' && identityData) {
      console.log('Confirming Email Change')
      update({ email_change_token: urlToken.token })
        .then(() => setUrlToken())
    }
  }, [urlToken, identityData, update])

  // API: A forced data refresh for if the User changes externally (from Function
  // or otherwise)
  const refreshUser = useCallback(async () => {
    return authorizedFetch(`${url}/user`)
      .then(resp => resp.json())
      .then(user => setUser(user))
  }, [url, authorizedFetch])

  // When logging in all we set is the token; if there's no identityData.user,
  // this effect should go grab it
  useEffect(() => {
    if (identityData?.token && !identityData?.user) {
      refreshUser()
    }
  }, [identityData, refreshUser])

  // API: Requests a password recovery email for the specified email-user
  const sendPasswordRecovery = async ({ email }) => {
    return fetch(`${url}/recover`, {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  }

  // Coerces the token half of identityData (and adds expires_at)
  const setToken = (token) => {
    const expires_at = new Date(JSON.parse(urlBase64Decode(token.access_token.split('.')[1])).exp * 1000)
    setIdentityData((prevIdentityData) => {
      return {
        user: prevIdentityData?.user,
        token: {
          ...token,
          expires_at
        }
      }
    })
  }

  // Coerces the user half of identityData
  const setUser = (user) => {
    setIdentityData((prevIdentityData) => {
      return {
        token: prevIdentityData?.token,
        user: {
          ...prevIdentityData?.user,
          ...user
        }
      }
    })
  }

  return {
    login,
    logout,
    update,
    signup,
    urlToken,
    refreshUser,
    authorizedFetch,
    provisionalUser,
    user: identityData?.user,
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
