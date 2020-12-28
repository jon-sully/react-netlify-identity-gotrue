# react-netlify-identity-gotrue

### See the Gatsby-integrated Demo! ✨ https://gatsby-identity-demo.jonsully.net ✨

 _See the demo code 🤖 [here](https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo)! 🤖_

---

**Welcome to the fully-featured, easy to use Netlify Identity integration for React, built purely in React without any dependencies.**

[![NPM](https://img.shields.io/npm/v/react-netlify-identity-gotrue.svg)](https://www.npmjs.com/package/react-netlify-identity-gotrue)

## Install

```sh
npm i react-netlify-identity-gotrue
# or
yarn add react-netlify-identity-gotrue
```

This package exports `NetlifyIdentityContext`, which must be instantiated at the upper-most part of the React tree that you wish to contain identity services below (the root of the site, in most cases). While there is a [Gatsby port][1] of this package that provides out-of-the-box Gatsby bindings for setting up the root React-tree provider, if you're using another framework or pure react, you'll need to do this yourself. For something like Next.js, following the ['Custom App'][10] system, this looks like:

```js
// ./pages/_app.js  --  How to wrap a Next.js app with a Provider
import App from 'next/app'
import React from 'react'
import NetlifyIdentityContext from 'react-netlify-identity-gotrue'

export default class NetlifyIdentityApp extends App {
  render() {
    const { Component, pageProps } = this.props
    return (
      <NetlifyIdentityContext url={'https://nextjs-identity-demo.jonsully.net'}>
        <Component {...pageProps} />
      </NetlifyIdentityContext>
    )
  }
}

```

❗NOTE:❗️`NetlifyIdentityContext` requires a `url` be passed in. This URL should contain no path (`/.netlify/identity` etc..) and no trailing slash. **Netlify Identity must be enabled on the site URL given**. If Identity is not enabled, this package will fail. Make sure it's turned on 🙂

Once you have the `NetlifyIdentityContext` correctly wrapping your React tree, you should be all set to begin using `useIdentityContext`! Read on!

## Usage

By installing the Context at the root of your site (above), you can leverage the `identity` object _anywhere_ in your site. It looks like this:

```js
// pages/my-account.js
import React from 'react'
import { useIdentityContext } from 'react-netlify-identity-gotrue'

export default () => {
  const identity = useIdentityContext()
  
  return {
    identity.user
      ? <p>Welcome to your account, {identity.user.email}</p>
      : <p>Please log in</p>
  }
}
```

The `identity` object consists of a few key functions and values:

## API

### `identity.user`

**Returns: `object` or `undefined`**

When a user is logged in, the `user` object gives all of the information about that current user. When logged out, this objet is `undefined`, making ternary and conditional blocks in your application code simple: `if (identity.user) doThing()`. This object typically contains a wealth of information. Taken from a test user on the [demo site][6], here's an example of the `user` object's fields and values:

```json
{
    "id": "1c3abcb6-4aac-a060-1feq1g42ed19",
    "aud": "",
    "role": "",
    "email": "test_person@jonsully.net",
    "confirmed_at": "2020-12-27T21:26:38Z",
    "confirmation_sent_at": "2020-12-27T21:26:28Z",
    "app_metadata": {
        "provider": "email",
        "roles": [
            "member",
            "dog-owner"
        ]
    },
    "user_metadata": {
        "address": {
            "city": "Testertown",
            "state": "CA",
            "street": "123 Test Avenue",
            "zip": "95056"
        },
        "full_name": "Test Person",
        "phone_number": "800-888-4422"
    },
    "created_at": "2020-12-27T21:26:28Z",
    "updated_at": "2020-12-27T21:26:28Z"
}
```

As we can see, plenty of data to pull from. As a note of caution, it's always a good idea to leverage [optional chaining][11] when writing code to access the `user` object. This provides an error-mitigation mechanism for the rare cases where a user reaches your component without being logged in or the _particular user_ doesn't have the specified field set on their _specific_ `user`. 

**Example usage:**

Constructing a greeting string:

```js
const greeting = `Hey ${identity.user?.user_metadata?.full_name || 'there'}!`
```

### `(async) identity.login({ email, password })`

**Returns: `undefined`**

Ultimately a function that would probably be called in your `submit` handler on your login form (the [demo][12] does exactly this), this function receives an object with an `email` and `password` key as arguments and logs the user in (any/all other arguments passed are ignored). This function returns no values, but can throw a standard Error if the logging-in-user isn't found, credentials are wrong, or other rare cases. These errors can be caught and displayed as needed ([demo example][13]).

The critical workflow step involved here is that `.login()` sets up and populates the `.user` object. So any `useEffect`s or other rendering occurring in your site that relies on or uses the `.user` object will automatically re-render with the user logged in after `.login()` completes. This behavior aids in the 'it just works' mentality.

**Example usage:**

Handling a login-form submit:

```js
// Login form partial example - using a managed-state form approach
const [userEmail, setUserEmail] = useState()
const [userPassword, setUserPassword] = useState()
const [formError, setFormError] = useState()

const submitHandler = async e => {
  e.preventDefault()
  await identity.login({
    email: userEmail,
    password: userPassword
  })
    .then(() => navigate('/my-account'))
    .catch(e => setFormError(e.message))
}
```

Demo site reference: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/LoginForm.jsx (using `react-hook-form`)

### `(async) identity.logout()`

**Returns: `undefined`**

A somewhat simple function, likely bound to a 'logout' button directly, this method removes all instances of a local user and reverts the React app back to a logged-out state with no remnants of the prior user. 

**Example usage:**

A typical logout button:

```jsx
{identity.user &&
  <button onClick={identity.logout}>
    Log Out
  </button>
}
```

Demo site reference: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/Layout.js#L38

### `(async) identity.update({ email, password, user_metadata: { } })`

**Returns: `undefined`**

The `.update()` function is the primary mechanism for updating a user's data. Similar to `.login()`, this function receives an object with `email` and `password` keys but also supports the `user_metadata` key. Any of the keys may be omitted or included and only the values that differ from what's already saved for the user will change (e.g. if you include `email` every time but it's the same email on file, it's a no-op). 

Updating the user's email address requires passing the user's _new_ / desired email address in under the `email` key. Once the email-change request has been made, the `identity.pendingEmailUpdate` will update to reflect the user's desired email, but the `user.email` will _not_ immediately be the users new email. This is due to the email-confirmation process required by Netlify Identity. Upon submitting a request for an email-change (that is, running `.update()` with a different `email` value specified than what's currently saved for that user), a confirmation email is sent to the _new_ email containing a link. The user must click that link (which should lead back to the site with a confirmation token in the URL) to confirm the new email address. When `react-netlify-identity-gotrue`'s Context is running at the root of the app (identity available on all pages), the email-confirmation token will be automatically parsed, processed, and confirmed. Application developers in the meantime can leverage the `identity.pendingEmailUpdate` value (as described below) to display to users that there's a pending email change and they need to check their email.

Updating the user's `password` is as simple as calling this function an passing the new `password` value in under the `password` key. There is no necessary second-step or confirmation, or is there a `secondPassword` validation key of any sort. Any "type it twice to make sure you get it right" sort of functionality needs to be configured at the Application level - this library presumes that what's passed in the `password` key is indeed the correct, known new password for the user. It will be updated immediately.

Updating the user's `user_metadata` is far less bound by process but does contain diff'ing logic that should be noted. Updates to `user_metadata` replace all data from the top-level (`user_metadata`) key down. To put that into the context of a real example, consider a test user that currently has `user_metadata` such as: 

```js
user = {
  "email": "test_person@jonsully.net",
  "app_metadata": {
    "etc": "etc"
  },
  "etc": "etc",
  "user_metadata": {
    "address": {
      "city": "Testertown",
      "state": "CA",
      "street": "123 Test Avenue",
      "zip": "95056"
    },
    "full_name": "Test Person",
    "phone_number": "800-888-4422"
  },
}
```

If I submit an `.update()` to that user with arguments such as `.update({ user_metadata: { address: { street: "44 Example Way" } } })`, the result would look like:

```js
user = {
  "email": "test_person@jonsully.net",
  "app_metadata": {
    "etc": "etc"
  },
  "etc": "etc",
  "user_metadata": {
    "address": {
      "street": "44 Example Way"
    },
    "full_name": "Test Person",
    "phone_number": "800-888-4422"
  },
}
```

The takeaway here being that the previous `user.user_metadata.address.city` and `.state` and `.zip` were removed, because an update was made to the top-level `user_metadata` key, `address`, and the update didn't include those tertiary fields. To contrast that, note that my update _didn't_ change the data under `user.user_metadata.full_name` or `phone_number`. Since those are separate top-level fields in `user_metadata`, they're un-impacted and retained unless explicitly specified in the update. ([source][15])

The point here being that we need to be careful about data contained within / nested under a top-level key inside of `user_metadata` - in order to retain that data, it needs to be sent back _with_ the top-level key in the update.

The [demo][14] follows what I would recommend: just send all the fields in each update. That lowers the risk of any data mishaps and ensures that everything is up to date!

NOTE: If you ever need to outright _remove_ a top-level `user_metadata` key from a user, just update it with the value set to `null`.

**Example usage:**

Updating password: _Note that the 'enter it twice for security' logic is purely on the front-end and the identity API itself doesn't require it, passing only a single instance of `password`_

```js
// Update form partial example - using a managed-state form approach
const [userPassword, setUserPassword] = useState()
const [userPasswordAgain, setUserPasswordAgain] = useState()
const [formMessage, setFormMessage] = useState()

const submitHandler = async e => {
  e.preventDefault()
  if (userPassword === userPasswordAgain) {
    await identity.update({
      password: userPasswordAgain
    })
      .then(() => setFormMessage('Updated!'))
      .catch(e => setFormError(e.message))  
  }
}
```

Updating email:

```js
// Update form partial example - using a managed-state form approach
const [newUserEmail, setNewUserEmail] = useState()
const [formMessage, setFormMessage] = useState()

const submitHandler = async e => {
  e.preventDefault()
  await identity.update({
    email: newUserEmail
  })
    .then(() => setFormMessage('Please check your email to confirm'))
    .catch(e => setFormError(e.message))  
}
```

Updating metadata:

```js
// Update form partial example - using a managed-state form approach
const [userFullName, setUserFullName] = useState()
const [userPhoneNumber, setUserPhoneNumber] = useState()
const [formMessage, setFormMessage] = useState()

const submitHandler = async e => {
  e.preventDefault()
  await identity.update({
    user_metadata: {
      full_name: userFullName,
      phone_number: userPhoneNumber
    }
  })
    .then(() => setFormMessage('Saved!'))
    .catch(e => setFormError(e.message))  
}
```

Demo site reference: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/pages/my-account.js#L27

### `(async) identity.signup({ email, password, user_metadata: { } })`

**Returns: `undefined`**

This function sets up the initial sign-up functionality for the identity interface, allowing the user to submit their `email` and `password` for the new account, but also to submit any tertiary `user_metadata` as needed per the Application developer's needs.

If the site has auto-confirm disabled (default), a successful signup will populate `identity.provisionalUser` but will not populate `identity.user` (since a Netlify Identity user is not able to execute authorized calls and/or login until they confirm their email).

If the site has auto-confirm enabled, a successful signup will log the user in to a fully authenticated session and the user will accessible via `identity.user`. 

Auto-confirm settings can be configured under the "Confirmation Template" section of 
`https://app.netlify.com/sites/<YOUR-SITE-SLUG>/settings/identity#confirmation-template` 
e.g. https://app.netlify.com/sites/flying-banana-12c2b/settings/identity#confirmation-template

**Example usage:**

Sign-up Form:

```js
// Signup form partial example - using a managed-state form approach
const [password, setPassword] = useState()
const [email, setEmail] = useState()
const [fullName, setFullName] = useState()
const [formMessage, setFormMessage] = useState()

const submitHandler = async e => {
  e.preventDefault()
  await identity.signup({
    password,
    email,
    user_metadata: {
      full_name: fullName
    }
  })
    .then(() => setFormMessage('Please check your email to confirm your account!'))
    .catch(e => setFormError(e.message))  
}
```

Demo site reference: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/pages/sign-up.js#L17

### `identity.urlToken`

**Returns: `object` or `undefined`**

The `identity.urlToken` is a flag, more than anything. When there _is_ a `urlToken`, the goal is to check the `urlToken.type` and change your display accordingly. This is well displayed in the demo app via the [`AuthOverlay.jsx`][16] component. 

The presence of a `urlToken` means one of two things:

1) It's there to act as a flag so that the Application UI can trigger a spinner or waiting overlay for the brief period of time that `react-netlify-identity-gotrue` is processing in the background (e.g. while the library automatically confirms a user after clicking the "confirm" email link)

2) It's there to act as a flag to tell the Application that we need more information from the user before moving forward.

Here are the options for what the `urlToken.type` can be and what they mean:

- `urlToken.type === 'confirmation'`
  - When this token type is present, the token is simply acting as a flag for the Application to show a spinner or loading animation briefly. There's no extra step needed to be taken. The spinner / loading animation simply covers the brief (typically less than 1 second) time between when the user loads the page and when this library has automatically confirmed the user and logged the user into a full session. Yay for automatic things!
- `urlToken.type === 'invite'`
  - When the `invite` token type is present, the two-step process _is_ required. When a user is invited to create an account on the site from the Netlify Admin, only the email address for that user is taken. So when the user comes to the site and this library becomes aware of the invite, the user needs to enter their desired `password` and any other `user_metadata` the Application is looking to create on the user account. The second step is calling `identity.completeUrlTokenTwoStep({ password, user_metadata: { } })` with that data, as described further below. Once the `completeUrlTokenTwoStep()` function completes, the user will be fully logged in to their account.
  - In the [demo site][17] we leverage a transparent (forced) overlay and render a small form to take the additional information, then call `completeUrlTokenTwoStep()` to complete the invitation process!
- `urlToken.type === 'email_change'`
  - The `email_change` token type may either be automatic (and thus just a flag to render a spinner similar to the `confirmation` type) _or_ may require a second step - depending on whether or not there's already a user logged (whether or not `identity.user` is 'truthy'). The `email_change` workflow requires that the user be actively logged in (using their prior email address) before the change can be confirmed. So, the onus is on the Application to determine if there's an `email_change` token _and_ whether or not `identity.user` is true; if it is, the process is running automatically; if it's not, the Application must log the user in before the `email_change` can complete.
  - While it may sound tedious, this is a fairly straightforward double-conditional that the [demo site][18] displays easier than reading it here. You are recommended to check that link and read through some of the mark up in the `AuthOverlay` component.
- `urlToken.type === 'passwordRecovery'`
  - Similarly to the `invite` token, the `passwordRecovery` token warrants a two-step process. Luckily, this token type need only complete the process with a new `password` rather than having to worry about additional `user_metadata` as well. Once again, this token being present is the flag to tell the Application that additional data is needed from the user, and the onus is upon the Application to render a 'new password' form, get the input from the user, and call `identity.completeUrlTokenTwoStep({ password })` to complete the process.
  - Once again, the [demo site][19] is the best view into this process workflow and illustration. 

**Example usage:**

Since there are many cases of the `urlToken` and the workflow it requires, we'll defer example usages to the [`AuthOverlay.jsx`][16] component in the demo site.

### `(async) identity.refreshUser()`

**Returns: `undefined`**

This method is a utility to forcibly refresh the local user's information and authorization. While not ostensibly the most useful functionality, it presents a particular use case for when you know a user's data has been altered externally. This typically isn't the case - a user's own `identity.user` data tends to only be changed _by that user_ but if the user kicks off a process that externally alters the user data, this method can be useful.

The demo site exhibits this use-case for clarity - when clicking the "Make me a member!" or "Make me an admin!" buttons, the Netlify Function that runs behind the scenes makes a change to the `user` data - it adds or removes role(s). Since we _know_ that's what's happening, we can use `.refreshUser()` once the button execution has completed in order to refresh the user and pull down the new role(s).

In cases where the Application / front-end code doesn't kick off an action that we _know_ will change the `user` data, but rather a change is made to the use data in an ad-hoc format (e.g. adding a Role from the Netlify Admin UI), instructing users to log out then back in will pull down the latest data.

**Example usage:**

From the demo site's [use case][20] described above, where we kick off a Function we know will ultimately alter the `user` data on the server:

```js
const updateRoles = ({ add, remove }) => {
    setProcessing(true)
    identity.authorizedFetch('/api/update-role', {
      method: 'POST',
      body: JSON.stringify({
        action: add ? 'add' : 'remove',
        role: add || remove
      })
    })
      .then(identity.refreshUser)
  }
```

### `(async) identity.authorizedFetch(url, options)`

**Returns: `Promise<Response>`**

Another utility function, the `authorizedFetch` is a simple wrapper around the native `fetch()` function that injects the `Authorization` header into the `fetch()` for use with Netlify Functions. Since this method is just a thin wrapper around `fetch()`, it should be treated just like `fetch()`, using `.then(response => response.json()).then(object => etc.)` and any other typical usages you might expect. 

For more information on Netlify Identity + Netlify Functions I recommend reading [this post][21] about how Netlify Functions work with "Authentication Functions" and [this initial documentation][22] from Netlify on the matter. The gist of it is that any time an AuthorizedFetch is placed to _any_ Function running on a site that has Netlify Identity enabled, the Function validates that the incoming request was made with a valid JWT (checks the signed cryptographic signature) then makes data available inside the Function pertaining to _who_ made the request (the user details). The functions are _also_ automatically granted a short-lived "super-admin" token that allows them to make admin-level changes to the Netlify Identity instance if need-be (similar to the abilities available when in the Netlify Admin UI.. deleting users, creating users, changing roles, etc.). This is how the `update-role` Function in the [demo site][23] is powered. 

**Example usage:**

Hitting a Function that returns a token of some sort:

```js
identity.authorizedFetch('/api/update-role', {
  method: 'POST',
  body: JSON.stringify({
    action: add ? 'add' : 'remove',
      role: add || remove
    })
  })
  .then(resp => resp.json())
  .then(token => console.log(token.status))
```

### `identity.provisionalUser`

**Returns: `object` or `undefined`**

As described in `identity.signup()` above, the `provisionalUser` object is only ever set when a new user has signed up for an account on the site and auto-confirm is disabled. This user is considered un-confirmed until they click the confirmation email that was sent, but until then, the user information is temporarily stored in the `identity.provisionalUser` object.

❗Do note that this object is _not_ persisted, unlike the `identity.user`! Once a user signs up, this object will be present, but if they refresh the page, the `provisionalUser` will once again be `undefined` and similar to as if they never signed up in the first place (until they click the link in their confirmation email) - so it's advised that the Application urge the user to click the link in their email as soon as possible. Alternatively, the site may enable auto-confirm so that all new sign-ups are automatically created as full user accounts rather than having a provisional stage in the middle.

**Example usage:**

```js
// Signup form partial example - using a managed-state form approach
const [password, setPassword] = useState()
const [email, setEmail] = useState()
const [fullName, setFullName] = useState()
const [formMessage, setFormMessage] = useState()

// Assuming auto-confirm disabled
const submitHandler = async e => {
  e.preventDefault()
  await identity.signup({
    password,
    email,
    user_metadata: {
      full_name: fullName
    }
  })
    .then(() => setFormMessage('Please check your email to confirm your account!'))
    .catch(e => setFormError(e.message))  
}

useEffect(() => {
  if (identity.provisionalUser) {
    console.log(`Provisional user now set: ${identity.provisionalUser.email}`)
  }
}, [identity.provisionalUser])
```

### `identity.pendingEmailUpdate`

**Returns: `string` or `undefined`**

The `pendingEmailUpdate` value is a utility for quickly assessing whether the current user has a pending email change, and the string returned _is_ the 'new' email address waiting to be confirmed. This allows for simple shorthand like `{identity.pendingEmailUpdate && <p>Pending email update to {identity.pendingEmailUpdate}</p>}`.

It should be noted that even if the user has a pending email change, they may still submit _another_ subsequent `.update({ email: 'xyz@example.com' })` to re-generate the confirmation email to the new email address. Similarly, even if they have a pending update request, they can submit another subsequent update to change the email to a _different_ new email address. In either of these cases, only the most recent `email_change` confirmation email will be valid. Prior emails containing 'old' URLs will not process.

These two methods can be combined to setup a quick "resend email confirmation" button that re-runs an `.update` _with_ the `.pendingEmailUpdate`. See the following example

**Example usage:**

Taken from the [demo app][24] for a re-send confirmation workflow:

```js
const reSendEmailChangeConfirmation = async () => {
  if (!identity.pendingEmailUpdate || formProcessing) return

  setFormProcessing(true)

  await identity.update({ email: identity.pendingEmailUpdate })

  setFormProcessing(false)
  setFormSubmitted(true)
  setTimeout(() => (setFormSubmitted(false)), 2000)
}
```

### `(async) identity.sendPasswordRecovery({ email })`

**Returns: `undefined`**

A simple async function (capable of `await`ing or `then`-ing) that kicks off a password recovery email for the specified user-email, if such a user exists on the site. Presumably no user would be logged in while running this method, but the method is technically agnostic of any user currently being logged in and runs without impact to the current state of `identity`

**Example usage:**

```js
// Password reset form partial example - using a managed-state form approach
const [email, setEmail] = useState()
const [formMessage, setFormMessage] = useState()

const submitHandler = async e => {
  e.preventDefault()
  await identity.sendPasswordRecovery({
    email
  })
    .then(() => setFormMessage('Please check your email for a password recovery link'))
    .catch(e => setFormError(e.message))  
}
```

### `identity.completeUrlTokenTwoStep({ password, user_metadata: { } })`

**Returns: `undefined`**

As described above in the `urlToken` section, the `completeUrltokenTwoStep` method is specifically used to complete the two-step process of setting up a new user after they've been _invited_ to join the site (sent an invitation email) or when the user is executing a password recovery sequence. In both cases, the `identity.urlToken` will be set and `identity.urlToken.type` will be equal to either `invite` or `passwordRecovery` (respectively). Once the Application has gathered the necessary additional information from the user, the Application needs to call this method and pass in the additional information to complete the two-step process.

For the `invite` token, the additional information required is the new user's desired account password and optional additional information is any `user_metadata` the Application would like to store for that user (full name, address, etc.) - typically the password and additional information are collected in the same "invitation signup" form (as we do in [the demo][25])

For the `passwordRecovery` token, the only additional information required is the new `password` for the user. Once the application has allowed the user to select a new password, it should be passed into the `completeUrltokenTwoStep` method. 

Once the `completeUrltokenTwoStep()` method has been called, the rest of the user account processing is automatic. In both cases, the result will be a full user account session with `identity.user` populated and set correctly. 

**Example usage:**

As this two-step workflow is a bit more than can be fit into a README code block, it's encouraged to read through the [`AuthOverlay.jsx`][16] component from the demo site.

## Demo

A comprehensive demo was built using this package in a Gatsby application (a Next.js-based clone will be on the way soon) - it uses the same `identity` API as described above, the Gatsby port just automates the installation of the React Context wrapping the React tree. 

The demo utilizes the `identity` API above extensively and presents a fully implemented Auth'd website. It's strongly recommended to look through the React code behind the demo for a better picture of how to leverage the `identity` API above.

The demo can be found here: https://gatsby-identity-demo.jonsully.net

The demo source code is here: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo




---

#### Note ❗

**This repository, the Gatsby-specific wrapper (to provide React Context bindings at the React tree root) [`gatsby-plugin-netlify-identity-gotrue`][1], and the  [`gatsby-plugin-netlify-identity-gotrue-demo`][6] repository (demo site) that consumes the Gatsby-specific wrapper are _not_ related to Netlify's [`netlify-identity-widget`][3] stack _or_ @sw-yx's [`react-netlify-identity`][4] stack, both of which ultimately sit on [`gotrue-js`][5]. *This* stack is written in pure React and interfaces with Netlify Identity directly without any dependencies. You can read some history about the three stacks here: https://jonsully.net/blog/announcing-react-netlify-identity-gotrue.**

[2]:https://github.com/jon-sully/react-netlify-identity-gotrue
[3]:https://github.com/netlify/netlify-identity-widget
[4]:https://github.com/netlify-labs/react-netlify-identity
[5]:https://github.com/netlify/gotrue-js
[1]: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue
[10]:https://nextjs.org/docs/advanced-features/custom-app
[11]:https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
[12]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/LoginForm.jsx#L21
[13]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/LoginForm.jsx#L31
[14]: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/pages/my-account.js#L24
[15]:https://github.com/netlify/gotrue/blob/f023c23d846c98fafc8e227608d6059fb02845df/models/user.go#L156
[16]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/AuthOverlay.jsx
[17]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/AuthOverlay.jsx#L55
[18]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/AuthOverlay.jsx#L44
[6]: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo
[20]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/pages/index.js#L9
[21]:https://community.netlify.com/t/questions-about-netlify-identity-serverless-functions/20755/13?u=jonsully
[19]: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/AuthOverlay.jsx#L85
[23]: https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/pages/index.js#L11
[24]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/pages/my-account.js#L36
[25]:https://github.com/jon-sully/gatsby-plugin-netlify-identity-gotrue-demo/blob/master/src/components/AuthOverlay.jsx#L55
[22]: https://docs.netlify.com/functions/functions-and-identity/