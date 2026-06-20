import test from 'node:test'
import assert from 'node:assert/strict'
import { adfToMarkdown } from '../src/adf.ts'

test('adfToMarkdown renders nested rich text', function () {
  const markdown = adfToMarkdown({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Summary' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world', marks: [{ type: 'strong' }] },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }],
          },
        ],
      },
    ],
  })

  assert.equal(markdown, '## Summary\n\nHello **world**\n\n- One\n- Two')
})
