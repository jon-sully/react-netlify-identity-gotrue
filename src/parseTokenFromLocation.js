// Loosely based on runRoutes.tsx from react-netlify-identity

const routes = /(confirmation|invite|recovery|email_change|access)_token=([^&]+)/;
const hashReplace = /^#\/?/;

export function parseTokenFromLocation() {
  if (!document?.location?.hash) {
    return null
  }
  const hash = document.location.hash.replace(hashReplace, '')

  try {
    window && window.history.pushState(
      '',
      document.title,
      window.location.pathname + window.location.search
    );
  } catch (_) {
    window.location.href.substr(0, window.location.href.indexOf('#'));
  }

  const matchesActionHashes = hash.match(routes);

  if (matchesActionHashes) {
    return ({
      type: matchesActionHashes[1],
      token: matchesActionHashes[2]
    })
  }

  return null
}
