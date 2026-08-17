import React, { useEffect, useMemo, useState } from 'react';
import {
    MdAdd,
    MdArrowBack,
    MdDelete,
    MdDescription,
    MdEdit,
    MdLink,
    MdOpenInNew,
    MdSave
} from 'react-icons/md';
import toast from 'react-hot-toast';
import RichTextEditor from '../components/RichTextEditor';
import { useContentStore } from '../store/contentStore';

const RESERVED_PAGE_KEYS = new Set([
    'privacyPolicy',
    'terms-of-use',
    'aboutUs',
    'seoContent',
    'copyright',
    'help-center-config'
]);

const FIXED_EDITABLE_PAGES = [
    { pageKey: 'privacyPolicy', title: 'Privacy Policy' },
    { pageKey: 'terms-of-use', title: 'Terms of Use' }
];

const isFixedEditablePageKey = (pageKey) => FIXED_EDITABLE_PAGES.some((page) => page.pageKey === pageKey);

const createEmptyDraft = () => ({
    title: '',
    pageKey: '',
    content: '<p></p>',
    showInMobileProfile: false
});

const sanitizePageKey = (value) => (
    String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
);

const formatTitle = (page) => (
    page?.title?.trim()
        || String(page?.pageKey || '')
            .replace(/-/g, ' ')
            .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase())
);

const buildPageHref = (pageKey) => `/info?type=dynamic&key=${pageKey}`;

const PageManager = () => {
    const { pages, fetchPages, upsertPage, deletePage, isLoading } = useContentStore();
    const [selectedPageKey, setSelectedPageKey] = useState(null);
    const [draft, setDraft] = useState(createEmptyDraft);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchPages();
    }, [fetchPages]);

    const customPages = useMemo(
        () => pages
            .filter((page) => !RESERVED_PAGE_KEYS.has(page.pageKey))
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
        [pages]
    );

    const fixedEditablePages = useMemo(
        () => FIXED_EDITABLE_PAGES.map((config) => {
            const existingPage = pages.find((page) => page.pageKey === config.pageKey);
            return existingPage || {
                pageKey: config.pageKey,
                title: config.title,
                content: '<p></p>',
                showInMobileProfile: false,
                isFixed: true
            };
        }),
        [pages]
    );

    const selectedPage = useMemo(
        () => [...fixedEditablePages, ...customPages].find((page) => page.pageKey === selectedPageKey) || null,
        [fixedEditablePages, customPages, selectedPageKey]
    );

    const isFixedPageEditing = useMemo(
        () => isFixedEditablePageKey(selectedPageKey),
        [selectedPageKey]
    );

    useEffect(() => {
        if (!selectedPageKey || !selectedPage) return;

        setDraft({
            title: selectedPage.title || formatTitle(selectedPage),
            pageKey: selectedPage.pageKey,
            content: selectedPage.content || '<p></p>',
            showInMobileProfile: Boolean(selectedPage.showInMobileProfile)
        });
    }, [selectedPage, selectedPageKey]);

    useEffect(() => {
        if (selectedPageKey && !selectedPage) {
            setSelectedPageKey(null);
            setDraft(createEmptyDraft());
        }
    }, [selectedPageKey, selectedPage]);

    const startCreatingPage = () => {
        setSelectedPageKey(null);
        setDraft(createEmptyDraft());
        setIsEditorOpen(true);
    };

    const startEditingPage = (page) => {
        setSelectedPageKey(page.pageKey);
        setDraft({
            title: page.title || formatTitle(page),
            pageKey: page.pageKey,
            content: page.content || '<p></p>',
            showInMobileProfile: Boolean(page.showInMobileProfile)
        });
        setIsEditorOpen(true);
    };

    const closeEditor = () => {
        setIsEditorOpen(false);
        setSelectedPageKey(null);
        setDraft(createEmptyDraft());
    };

    const handleDraftChange = (field, value) => {
        if (field === 'pageKey') {
            setDraft((prev) => ({ ...prev, pageKey: sanitizePageKey(value) }));
            return;
        }

        if (field === 'title') {
            setDraft((prev) => {
                const nextTitle = value;
                const shouldSyncSlug = !selectedPageKey && (prev.pageKey.trim() === '' || prev.pageKey === sanitizePageKey(prev.title));

                return {
                    ...prev,
                    title: nextTitle,
                    pageKey: shouldSyncSlug ? sanitizePageKey(nextTitle) : prev.pageKey
                };
            });
            return;
        }

        setDraft((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        const title = draft.title.trim();
        const pageKey = isFixedPageEditing ? selectedPageKey : sanitizePageKey(draft.pageKey);
        const content = draft.content || '<p></p>';
        const showInMobileProfile = Boolean(draft.showInMobileProfile);

        if (!title) {
            toast.error('Page name is required');
            return;
        }

        if (!pageKey) {
            toast.error('Page link is required');
            return;
        }

        if (RESERVED_PAGE_KEYS.has(pageKey) && !isFixedPageEditing) {
            toast.error('This page link is reserved');
            return;
        }

        const duplicate = customPages.find(
            (page) => page.pageKey === pageKey && page.pageKey !== selectedPageKey
        );

        if (duplicate) {
            toast.error('A page with this link already exists');
            return;
        }

        setIsSaving(true);

        try {
            await upsertPage({ pageKey, title, content, showInMobileProfile });

            if (selectedPageKey && selectedPageKey !== pageKey) {
                await deletePage(selectedPageKey);
            }

            setSelectedPageKey(pageKey);
            setDraft({ title, pageKey, content, showInMobileProfile });
            setIsEditorOpen(false);
            toast.success('Page saved successfully');
            await fetchPages();
        } catch (error) {
            toast.error('Failed to save page');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (page) => {
        const confirmed = window.confirm(`Delete "${formatTitle(page)}"?`);
        if (!confirmed) return;

        setIsDeleting(true);

        try {
            await deletePage(page.pageKey);
            if (selectedPageKey === page.pageKey) {
                setSelectedPageKey(null);
                setDraft(createEmptyDraft());
            }
            toast.success('Page deleted successfully');
            await fetchPages();
        } catch (error) {
            toast.error('Failed to delete page');
        } finally {
            setIsDeleting(false);
        }
    };

    const pageHref = draft.pageKey ? buildPageHref(draft.pageKey) : '';

    return (
        <div className="p-6 h-full bg-gray-50/60">
            {!isEditorOpen ? (
                <>
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Pages</h1>
                            <p className="text-sm text-gray-500">See all pages here and create a new one when needed.</p>
                        </div>
                        <button
                            onClick={startCreatingPage}
                            className="px-4 py-2.5 rounded-2xl bg-primary-600 text-white font-black text-sm flex items-center gap-2 hover:bg-primary-700 transition-colors"
                        >
                            <MdAdd size={18} />
                            Add Page
                        </button>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Legal Pages</h2>
                                <p className="text-xs text-gray-400 font-semibold mt-1">These links are fixed and only their content can be edited.</p>
                            </div>
                        </div>

                        <div className="p-4 space-y-3 border-b border-gray-100 bg-gray-50/40">
                            {fixedEditablePages.map((page) => (
                                <div
                                    key={page.pageKey}
                                    className="rounded-2xl border border-gray-100 bg-white p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-gray-900 truncate">
                                                {page.title || formatTitle(page)}
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-1 break-all">{buildPageHref(page.pageKey)}</p>
                                            <p className="text-[10px] font-bold text-primary-600 mt-2 uppercase tracking-wider">
                                                Fixed link
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => startEditingPage(page)}
                                                className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                                                aria-label={`Edit ${formatTitle(page)}`}
                                            >
                                                <MdEdit size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Saved Pages</h2>
                                <p className="text-xs text-gray-400 font-semibold mt-1">{customPages.length} page{customPages.length === 1 ? '' : 's'}</p>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            {customPages.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
                                    <div className="w-14 h-14 rounded-full bg-white border border-gray-100 flex items-center justify-center mx-auto mb-4">
                                        <MdDescription size={28} className="text-gray-300" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-600">No pages created yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Use Add Page to create your first custom page.</p>
                                </div>
                            ) : (
                                customPages.map((page) => (
                                    <div
                                        key={page.pageKey}
                                        className="rounded-2xl border border-gray-100 bg-white p-4"
                                    >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-gray-900 truncate">
                                                        {formatTitle(page)}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 mt-1 break-all">{buildPageHref(page.pageKey)}</p>
                                                    {page.showInMobileProfile && (
                                                        <p className="text-[10px] font-bold text-primary-600 mt-2 uppercase tracking-wider">
                                                            Show in mobile profile
                                                        </p>
                                                    )}
                                                </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => startEditingPage(page)}
                                                    className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                                                    aria-label={`Edit ${formatTitle(page)}`}
                                                >
                                                    <MdEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(page)}
                                                    disabled={isDeleting}
                                                    className="w-9 h-9 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 flex items-center justify-center disabled:opacity-50"
                                                    aria-label={`Delete ${formatTitle(page)}`}
                                                >
                                                    <MdDelete size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <button
                                onClick={closeEditor}
                                className="mt-0.5 w-10 h-10 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                                aria-label="Back to pages list"
                            >
                                <MdArrowBack size={18} />
                            </button>
                            <div>
                                <h2 className="text-lg font-black text-gray-900">
                                    {selectedPageKey ? 'Edit Page' : 'Create Page'}
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Set the page name, choose the link, and write the content below.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {pageHref && (
                                <button
                                    onClick={() => window.open(pageHref, '_blank')}
                                    type="button"
                                    className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold flex items-center gap-2 hover:bg-gray-50"
                                >
                                    <MdOpenInNew size={16} />
                                    Open Page
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                                className="px-4 py-2.5 rounded-2xl bg-primary-600 text-white font-black text-sm flex items-center gap-2 hover:bg-primary-700 disabled:opacity-60"
                            >
                                <MdSave size={18} />
                                {isSaving || isLoading ? 'Saving...' : 'Save Page'}
                            </button>
                        </div>
                    </div>

                    <div className="p-5 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                    Page Name
                                </label>
                                <input
                                    type="text"
                                    value={draft.title}
                                    onChange={(e) => handleDraftChange('title', e.target.value)}
                                    placeholder="e.g. Careers"
                                    disabled={isFixedPageEditing}
                                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                    Page Link
                                </label>
                                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-primary-500">
                                    <MdLink size={18} className="text-gray-400 shrink-0" />
                                    <span className="text-xs font-bold text-gray-400 shrink-0">/info?type=dynamic&key=</span>
                                    <input
                                        type="text"
                                        value={draft.pageKey}
                                        onChange={(e) => handleDraftChange('pageKey', e.target.value)}
                                        placeholder="careers"
                                        disabled={isFixedPageEditing}
                                        className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 outline-none"
                                    />
                                </div>
                                {isFixedPageEditing ? (
                                    <p className="mt-2 text-[11px] font-semibold text-gray-400">
                                        This page link is fixed and cannot be changed.
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Open Link</p>
                            <p className="text-sm font-semibold text-gray-700 break-all">
                                {pageHref || 'Enter a page link to generate the page URL'}
                            </p>
                        </div>

                        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={draft.showInMobileProfile}
                                onChange={(e) => handleDraftChange('showInMobileProfile', e.target.checked)}
                                disabled={isFixedPageEditing}
                                className="w-4 h-4 accent-primary-600"
                            />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Show in mobile profile page</p>
                                <p className="text-xs text-gray-500">This page will appear in the user mobile profile menu.</p>
                            </div>
                        </label>

                        <div className="border border-gray-100 rounded-3xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                <p className="text-sm font-black text-gray-800">Page Content</p>
                            </div>
                            <div className="min-h-[420px] relative">
                                <RichTextEditor
                                    key={selectedPageKey || 'new-page'}
                                    value={draft.content}
                                    onChange={(html) => handleDraftChange('content', html)}
                                    placeholder="Write your page content here..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PageManager;
