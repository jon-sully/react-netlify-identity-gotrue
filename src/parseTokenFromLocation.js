// Loosely based on runRoutes.tsx from react-netlify-identity

const routes = /(confirmation|invite|recovery|email_change|access)_token=([^&]+)/
const hashReplace = /^#\/?/

export function parseTokenFromLocation () {
  if (!document?.location?.hash) {
    return null
  }
  const hash = document.location.hash.replace(hashReplace, '')

  try {
    window && window.history.pushState(
      '',
      document.title,
      window.location.pathname + window.location.search
    )
  } catch (_) {
    window.location.href.substr(0, window.location.href.indexOf('#'))
  }

  const matchesActionHashes = hash.match(routes)

  if (matchesActionHashes) {
    const urlToken = {}

    hash.split('&').forEach((pair) => {
      const [key, value] = pair.split('=')
      urlToken[key] = value
    })

    urlToken['type'] = matchesActionHashes[1]
    urlToken['token'] = matchesActionHashes[2]

    return urlToken
  }

  return null
}
