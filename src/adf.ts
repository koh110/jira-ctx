type JsonObject = Record<string, unknown>

function ensureArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function ensureObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getTextWithMarks(text: string, marks: unknown) {
  let result = text
  for (const mark of ensureArray(marks)) {
    if (!ensureObject(mark) || typeof mark.type !== 'string') {
      continue
    }
    if (mark.type === 'strong') {
      result = `**${result}**`
      continue
    }
    if (mark.type === 'em') {
      result = `*${result}*`
      continue
    }
    if (mark.type === 'code') {
      result = `\`${result}\``
      continue
    }
    if (mark.type === 'link' && ensureObject(mark.attrs) && typeof mark.attrs.href === 'string') {
      result = `[${result}](${mark.attrs.href})`
    }
  }
  return result
}

function renderInline(node: unknown): string {
  if (!ensureObject(node) || typeof node.type !== 'string') {
    return ''
  }

  if (node.type === 'text') {
    const text = typeof node.text === 'string' ? node.text : ''
    return getTextWithMarks(text, node.marks)
  }

  if (node.type === 'hardBreak') {
    return '\n'
  }

  if (node.type === 'emoji' && ensureObject(node.attrs) && typeof node.attrs.text === 'string') {
    return node.attrs.text
  }

  if (node.type === 'mention' && ensureObject(node.attrs) && typeof node.attrs.text === 'string') {
    return node.attrs.text
  }

  if (node.type === 'inlineCard' && ensureObject(node.attrs) && typeof node.attrs.url === 'string') {
    return node.attrs.url
  }

  return renderChildren(ensureArray(node.content)).trim()
}

function renderChildren(nodes: unknown[]) {
  let result = ''
  for (const node of nodes) {
    result += renderInline(node)
  }
  return result
}

function renderBlock(node: unknown, depth = 0): string {
  if (!ensureObject(node) || typeof node.type !== 'string') {
    return ''
  }

  const content = ensureArray(node.content)

  if (node.type === 'paragraph') {
    return `${renderChildren(content).trim()}\n\n`
  }

  if (node.type === 'heading') {
    const level = ensureObject(node.attrs) && typeof node.attrs.level === 'number' ? node.attrs.level : 1
    return `${'#'.repeat(Math.max(1, Math.min(6, level)))} ${renderChildren(content).trim()}\n\n`
  }

  if (node.type === 'bulletList') {
    let result = ''
    for (const item of content) {
      result += renderBlock(item, depth)
    }
    return `${result}\n`
  }

  if (node.type === 'orderedList') {
    let result = ''
    let index = 1
    for (const item of content) {
      result += renderListItem(item, depth, `${index}.`)
      index += 1
    }
    return `${result}\n`
  }

  if (node.type === 'listItem') {
    return renderListItem(node, depth, '-')
  }

  if (node.type === 'blockquote') {
    const inner = renderBlocks(content).trim().split('\n').map(function prefix(line) {
      return line.length > 0 ? `> ${line}` : '>'
    }).join('\n')
    return `${inner}\n\n`
  }

  if (node.type === 'codeBlock') {
    const text = renderChildren(content).trimEnd()
    return `\`\`\`\n${text}\n\`\`\`\n\n`
  }

  if (node.type === 'rule') {
    return '---\n\n'
  }

  return renderBlocks(content)
}

function renderListItem(node: unknown, depth: number, prefix: string) {
  if (!ensureObject(node)) {
    return ''
  }

  const content = ensureArray(node.content)
  const indent = '  '.repeat(depth)
  let firstLine = true
  let result = ''

  for (const child of content) {
    if (!ensureObject(child) || typeof child.type !== 'string') {
      continue
    }

    if (child.type === 'paragraph') {
      const text = renderChildren(ensureArray(child.content)).trim()
      if (text.length === 0) {
        continue
      }
      if (firstLine) {
        result += `${indent}${prefix} ${text}\n`
        firstLine = false
      } else {
        result += `${indent}  ${text}\n`
      }
      continue
    }

    if (child.type === 'bulletList' || child.type === 'orderedList') {
      const nested = renderBlock(child, depth + 1)
      result += nested
      firstLine = false
      continue
    }

    const fallback = renderBlock(child, depth + 1).trimEnd()
    if (fallback.length > 0) {
      if (firstLine) {
        result += `${indent}${prefix} ${fallback}\n`
        firstLine = false
      } else {
        result += `${indent}  ${fallback}\n`
      }
    }
  }

  if (result.length === 0) {
    return `${indent}${prefix}\n`
  }

  return result
}

function renderBlocks(nodes: unknown[]) {
  let result = ''
  for (const node of nodes) {
    result += renderBlock(node)
  }
  return result
}

export function adfToMarkdown(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!ensureObject(value)) {
    return ''
  }

  const content = ensureArray(value.content)
  return renderBlocks(content)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
