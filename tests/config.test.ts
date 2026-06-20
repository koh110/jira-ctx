import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveProfiles } from '../src/config.ts'

const sampleConfig = {
  defaultProfile: 'work-a',
  profiles: {
    'work-a': {
      baseUrl: 'https://company-a.atlassian.net',
      email: 'a@example.com',
      tokenEnv: 'TOKEN_A',
    },
    'work-b': {
      baseUrl: 'https://company-b.atlassian.net',
      email: 'b@example.com',
      tokenEnv: 'TOKEN_B',
    },
  },
}

test('resolveProfiles returns default profile when nothing is specified', function () {
  const profiles = resolveProfiles(sampleConfig, {})
  assert.equal(profiles.length, 1)
  assert.equal(profiles[0]?.name, 'work-a')
})

test('resolveProfiles returns requested profiles in order', function () {
  const profiles = resolveProfiles(sampleConfig, { profiles: ['work-b', 'work-a'] })
  assert.deepEqual(profiles.map(function mapProfile(profile) {
    return profile.name
  }), ['work-b', 'work-a'])
})

test('resolveProfiles throws on unknown profile', function () {
  assert.throws(function () {
    resolveProfiles(sampleConfig, { profile: 'missing' })
  }, /Unknown profile: missing/)
})
