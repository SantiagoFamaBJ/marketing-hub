'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

interface RichEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minHeight?: number
}

export default function RichEditor({ value, onChange, placeholder = 'Escribí acá...', minHeight = 120 }: RichEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; outline: none; padding: 0.75rem; font-size: 0.875rem; line-height: 1.7; color: #1a1a1a;`,
      },
    },
  })

  useEffect(() => {
    if (editor && value === '') {
      editor.commands.clearContent()
    }
  }, [value, editor])

  if (!editor) return null

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 8px',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: active ? '#f15922' : 'transparent',
    color: active ? '#fff' : '#555',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    lineHeight: 1,
  })

  return (
    <div style={{
      border: '1.5px solid #e8e8e8',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#fff',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '6px 8px',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fafafa',
        flexWrap: 'wrap',
      }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))}>
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))}>
          <em>I</em>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} style={btnStyle(editor.isActive('strike'))}>
          <s>S</s>
        </button>
        <div style={{ width: 1, backgroundColor: '#e8e8e8', margin: '0 4px' }} />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))}>
          • Lista
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))}>
          1. Lista
        </button>
        <div style={{ width: 1, backgroundColor: '#e8e8e8', margin: '0 4px' }} />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} style={btnStyle(editor.isActive('heading', { level: 3 }))}>
          H3
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} style={btnStyle(editor.isActive('blockquote'))}>
          ❝
        </button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} style={btnStyle(false)}>
          —
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <button type="button" onClick={() => editor.chain().focus().undo().run()} style={btnStyle(false)}>↩</button>
          <button type="button" onClick={() => editor.chain().focus().redo().run()} style={btnStyle(false)}>↪</button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ position: 'relative' }}>
        {editor.isEmpty && (
          <p style={{
            position: 'absolute', top: '0.75rem', left: '0.75rem',
            color: '#a0a0a0', fontSize: '0.875rem', pointerEvents: 'none', margin: 0,
          }}>{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .tiptap { outline: none; }
        .tiptap p { margin: 0 0 0.5em; }
        .tiptap ul, .tiptap ol { padding-left: 1.5em; margin: 0.5em 0; }
        .tiptap li { margin: 0.25em 0; }
        .tiptap h3 { font-size: 1rem; font-weight: 700; margin: 0.75em 0 0.25em; }
        .tiptap blockquote { border-left: 3px solid #f15922; padding-left: 1em; color: #666; margin: 0.5em 0; }
        .tiptap hr { border: none; border-top: 1px solid #e8e8e8; margin: 0.75em 0; }
        .tiptap strong { font-weight: 700; }
      `}</style>
    </div>
  )
}

// Componente para renderizar HTML de forma segura
export function RichContent({ html }: { html: string }) {
  if (!html || html === '<p></p>') return null
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ fontSize: '0.875rem', color: '#333', lineHeight: 1.7 }}
    />
  )
}
