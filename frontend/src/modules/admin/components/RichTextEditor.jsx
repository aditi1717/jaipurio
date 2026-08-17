import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import './RichTextEditor.css';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import {
    MdFormatBold,
    MdFormatItalic,
    MdFormatUnderlined,
    MdFormatListBulleted,
    MdFormatListNumbered,
    MdTableChart,
    MdUndo,
    MdRedo
} from 'react-icons/md';

const RichTextEditor = ({ value, onChange, placeholder = 'Enter product highlights...' }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'tiptap-table',
                },
            }),
            TableRow,
            TableCell,
            TableHeader,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            FontFamily,
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    useEffect(() => {
        if (!editor) return;
        const nextContent = value || '';
        const currentContent = editor.getHTML();
        if (currentContent !== nextContent) {
            editor.commands.setContent(nextContent, false);
        }
    }, [editor, value]);

    if (!editor) {
        return null;
    }

    const MenuButton = ({ onClick, active, children, title }) => (
        <button
            type="button"
            onClick={onClick}
            className={`p-2 rounded-lg transition-all ${active
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            title={title}
        >
            {children}
        </button>
    );

    const ColorButton = ({ color, label }) => (
        <button
            type="button"
            onClick={() => editor.chain().focus().setColor(color).run()}
            className={`w-8 h-8 rounded-lg border-2 transition-all ${editor.isActive('textStyle', { color })
                ? 'border-primary-600 scale-110'
                : 'border-gray-300 hover:scale-105'
                }`}
            style={{ backgroundColor: color }}
            title={label}
        />
    );

    const HighlightButton = ({ color, label }) => (
        <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
            className={`w-8 h-8 rounded-lg border-2 transition-all ${editor.isActive('highlight', { color })
                ? 'border-primary-600 scale-110'
                : 'border-gray-300 hover:scale-105'
                }`}
            style={{ backgroundColor: color }}
            title={label}
        />
    );

    const FontButton = ({ font, label }) => (
        <button
            type="button"
            onClick={() => editor.chain().focus().setFontFamily(font).run()}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${editor.isActive('textStyle', { fontFamily: font })
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            style={{ fontFamily: font }}
            title={label}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-200 space-y-3">
                {/* Row 1: Basic Formatting */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
                        <MenuButton
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            active={editor.isActive('bold')}
                            title="Bold"
                        >
                            <MdFormatBold size={18} />
                        </MenuButton>
                        <MenuButton
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            active={editor.isActive('italic')}
                            title="Italic"
                        >
                            <MdFormatItalic size={18} />
                        </MenuButton>
                        <MenuButton
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            active={editor.isActive('underline')}
                            title="Underline"
                        >
                            <MdFormatUnderlined size={18} />
                        </MenuButton>
                    </div>

                    {/* Heading Buttons */}
                    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${editor.isActive('heading', { level: 1 })
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            title="Heading 1 (Large)"
                        >
                            H1
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${editor.isActive('heading', { level: 2 })
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            title="Heading 2 (Medium)"
                        >
                            H2
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${editor.isActive('heading', { level: 3 })
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            title="Heading 3 (Small)"
                        >
                            H3
                        </button>
                    </div>

                    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
                        <MenuButton
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            active={editor.isActive('bulletList')}
                            title="Bullet List"
                        >
                            <MdFormatListBulleted size={18} />
                        </MenuButton>
                        <MenuButton
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            active={editor.isActive('orderedList')}
                            title="Numbered List"
                        >
                            <MdFormatListNumbered size={18} />
                        </MenuButton>
                    </div>

                    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
                        <MenuButton
                            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                            title="Insert Table"
                        >
                            <MdTableChart size={18} />
                        </MenuButton>
                    </div>

                    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
                        <MenuButton
                            onClick={() => editor.chain().focus().undo().run()}
                            title="Undo"
                        >
                            <MdUndo size={18} />
                        </MenuButton>
                        <MenuButton
                            onClick={() => editor.chain().focus().redo().run()}
                            title="Redo"
                        >
                            <MdRedo size={18} />
                        </MenuButton>
                    </div>
                </div>

                {/* Row 2: Text Colors */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Text Color:</span>
                    <div className="flex items-center gap-1.5">
                        <ColorButton color="#000000" label="Black" />
                        <ColorButton color="#DC2626" label="Red" />
                        <ColorButton color="#EA580C" label="Orange" />
                        <ColorButton color="#16A34A" label="Green" />
                        <ColorButton color="#2563EB" label="Blue" />
                        <ColorButton color="#9333EA" label="Purple" />
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().unsetColor().run()}
                            className="px-2 py-1 text-[10px] font-bold text-gray-500 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Row 3: Highlights */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Highlight:</span>
                    <div className="flex items-center gap-1.5">
                        <HighlightButton color="#FEF3C7" label="Yellow" />
                        <HighlightButton color="#DBEAFE" label="Blue" />
                        <HighlightButton color="#D1FAE5" label="Green" />
                        <HighlightButton color="#FCE7F3" label="Pink" />
                        <HighlightButton color="#E5E7EB" label="Gray" />
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().unsetHighlight().run()}
                            className="px-2 py-1 text-[10px] font-bold text-gray-500 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Row 4: Font Families */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Font:</span>
                    <div className="flex items-center gap-1.5">
                        <FontButton font="Inter, sans-serif" label="Inter" />
                        <FontButton font="Georgia, serif" label="Georgia" />
                        <FontButton font="'Courier New', monospace" label="Courier" />
                        <FontButton font="Arial, sans-serif" label="Arial" />
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().unsetFontFamily().run()}
                            className="px-2 py-1 text-[10px] font-bold text-gray-500 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
                        >
                            Default
                        </button>
                    </div>
                </div>

                {/* Table Controls (shown when table is active) */}
                {editor.isActive('table') && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-300">
                        <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Table:</span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnBefore().run()}
                                className="px-2 py-1 text-[10px] font-bold bg-white text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50"
                            >
                                + Col Left
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                className="px-2 py-1 text-[10px] font-bold bg-white text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50"
                            >
                                + Col Right
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                className="px-2 py-1 text-[10px] font-bold bg-white text-red-600 rounded-lg border border-red-300 hover:bg-red-50"
                            >
                                - Col
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                className="px-2 py-1 text-[10px] font-bold bg-white text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50"
                            >
                                + Row Above
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                className="px-2 py-1 text-[10px] font-bold bg-white text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50"
                            >
                                + Row Below
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                className="px-2 py-1 text-[10px] font-bold bg-white text-red-600 rounded-lg border border-red-300 hover:bg-red-50"
                            >
                                - Row
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                className="px-2 py-1 text-[10px] font-bold bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete Table
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Editor Content */}
            <div data-placeholder={placeholder}>
                <EditorContent
                    editor={editor}
                    className="prose prose-sm max-w-none p-6 min-h-[400px] focus:outline-none"
                />
            </div>
        </div>
    );
};

export default RichTextEditor;
