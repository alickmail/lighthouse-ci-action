const core = require('@actions/core')
const { get } = require('lodash')
const { context } = require('@actions/github')
const { readFileSync } = require('fs')
const { parse: urlParse, URL } = require('url')

function getArgs() {
  // Make sure we don't have LHCI xor API token
  const serverBaseUrl = getArg('upload.serverBaseUrl')
  const token = getArg('upload.token')
  if (!!serverBaseUrl != !!token) {
    // Fail and exit
    core.setFailed(`Need both a LHCI server url and an API token`)
    process.exit(1)
  }

  let rcCollect = false
  let rcAssert = false
  let staticDistDir = undefined
  // Inspect lighthouserc file for malformations
  const configPath = getArg('configPath')
  if (configPath) {
    const contents = readFileSync(configPath, 'utf8')
    const rcFileObj = JSON.parse(contents)
    if (!('ci' in rcFileObj)) {
      // Fail and exit
      core.setFailed(`Config missing top level 'ci' property`)
      process.exit(1)
    }
    rcCollect = 'collect' in rcFileObj.ci
    rcAssert = 'assert' in rcFileObj.ci

    // Check if we have a static-dist-dir
    if (rcCollect) {
      if ('staticDistDir' in rcFileObj.ci.collect) {
        staticDistDir = rcFileObj.ci.collect.staticDistDir
      }
    }
  }

  // Get and interpolate URLs
  const urls = interpolateProcessIntoURLs(getList('urls'))

  // Make sure we have either urls or a static-dist-dir
  if (!urls && !staticDistDir) {
    // Fail and exit
    core.setFailed(`Need either 'urls' in action parameters or a 'static_dist_dir' in lighthouserc file`)
    process.exit(1)
  }

  // Warn if specifying both
  if (urls.length > 0 && staticDistDir) {
    core.warning(
      `Setting both 'url' and 'static_dist_dir' will ignore urls in 'url' since 'static_dist_dir' has higher priority`
    )
  }

  const logLevel = getArg('logLevel')

  return {
    urls,
    staticDistDir,
    canUpload: getArg('temporaryPublicStorage') ? true : false,
    budgetPath: getArg('budgetPath'),
    slackWebhookUrl: getArg('slackWebhookUrl'),
    logLevel: logLevel ? logLevel : 'info',
    numberOfRuns: getIntArg('runs'),
    applicationGithubToken: getArg('applicationGithubToken'),
    personalGithubToken: getArg('personalGithubToken'),
    serverBaseUrl,
    token,
    rcCollect,
    rcAssert,
    configPath
  }
}

/**
 * Wrapper for core.getInput.
 *
 * @param {string} arg
 * @return {string | undefined}
 */
function getArg(arg) {
  return core.getInput(arg) || undefined
}

/**
 * Wrapper for core.getInput for a numeric input.
 *
 * @param {string} arg
 * @return {number | undefined}
 */
function getIntArg(arg) {
  return parseInt(core.getInput(arg)) || undefined
}

/**
 * Wrapper for core.getInput for a list input.
 *
 * @param {string} arg
 * @return {string[]}
 */
function getList(arg, separator = '\n') {
  const input = getArg(arg)
  if (!input) return []
  return input.split(separator).map(url => url.trim())
}

/**
 * @param {string[]} urls
 * @return {string[]}
 */
function interpolateProcessIntoURLs(urls) {
  urls = urls.map(url => {
    if (!url.includes('$')) return url
    Object.keys(process.env).forEach(key => {
      if (url.includes(`${key}`)) {
        url = url.replace(`$${key}`, `${process.env[key]}`)
      }
    })
    return url
  })

  const branch = get(context, 'ref', '').split('/')[2]
  const netlifySite = getArg('netlifySite')
  if (branch && netlifySite) {
    const origin = `https://${branch}--${netlifySite}`
    return urls.map(
      /**
       * @param {string} url
       * @return {module:url.URL}
       */
      url => {
        let { path } = urlParse(url)
        path = path || ''
        return new URL(origin, path)
      }
    )
  }
  console.log(urls)
  return urls
}

module.exports = getArgs()
