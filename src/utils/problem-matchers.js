const { join } = require('path')
const { getAssertionsByUrl } = require('./lhci-helpers')

/**
 * Problem matchers allow to add anotatsion to Action output:
 * https://github.com/actions/toolkit/blob/master/docs/problem-matchers.md
 *
 * LHCI assertion output is designed to be readable by humans, not machines, and it's hard to parse with regexp
 * This method enables lhci.json problem matcher for a single string, examples:
 *
 * https://likeeper.com/ – error – offscreen-images – `offscreen-images` failure for `maxLength` assertion, expected **<= 0**, but found **1**.
 * https://likeeper.com/ – warning – mainthread-work-breakdown – `mainthread-work-breakdown` warning for `minScore` assertion, expected **>= 0.9**, but found **0.83**
 *
 * @param {string} resultsPath
 */

exports.runProblemMatchers = function enableProblemMatcher(resultsPath) {
  console.log(`::add-matcher::${join(process.cwd(), '.github/matchers.json')}`)
  const assertionsByUrl = getAssertionsByUrl(resultsPath)
  Object.values(assertionsByUrl).forEach(assertions => {
    assertions.forEach(a => {
      const message =
        `\`${a.auditId}\` ${a.level === 'error' ? 'failure' : 'warning'} for \`${a.name}\` assertion, ` +
        `expected **${a.operator} ${a.expected}**, but found **${a.actual}**.`
      console.log(`${a.url}|${a.level}|${a.auditId}|${message}`)
    })
  })
  console.log('::remove-matcher owner=lighthouse-ci-action::')
}
