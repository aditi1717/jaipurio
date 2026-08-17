import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaBullhorn, FaGift, FaInfoCircle, FaLink, FaQuestionCircle, FaStar, FaStore } from 'react-icons/fa';
import { MdAdd, MdBusiness, MdChevronLeft, MdChevronRight, MdCopyright, MdDelete, MdEdit, MdLink, MdSave, MdShare, MdSupportAgent } from 'react-icons/md';
import { useFooterStore } from '../../store/footerStore';
import { useContentStore } from '../../store/contentStore';

const RESERVED_PAGE_KEYS = new Set([
    'privacyPolicy',
    'aboutUs',
    'seoContent',
    'copyright',
    'help-center-config'
]);

const createEmptyLink = () => ({
    label: '',
    pageKey: '',
    url: '',
    isExternal: false
});

const createEmptySection = () => ({
    title: '',
    links: [createEmptyLink()]
});

const createEmptyQuickLink = () => ({
    label: '',
    icon: 'help',
    pageKey: '',
    url: '',
    isExternal: false
});

const EXTERNAL_LINK_OPTION = '__external_link__';
const QUICK_LINK_ICONS = [
    { value: 'seller', label: 'Seller' },
    { value: 'advertise', label: 'Advertise' },
    { value: 'gift', label: 'Gift' },
    { value: 'help', label: 'Help' },
    { value: 'support', label: 'Support' },
    { value: 'info', label: 'Info' },
    { value: 'star', label: 'Star' },
    { value: 'link', label: 'Link' }
];

const QUICK_LINK_ICON_COMPONENTS = {
    seller: FaStore,
    advertise: FaBullhorn,
    gift: FaGift,
    help: FaQuestionCircle,
    support: MdSupportAgent,
    info: FaInfoCircle,
    star: FaStar,
    link: FaLink
};

const isGenericColumnTitle = (value) => /^column\s+\d+$/i.test(String(value || '').trim());

const FooterManager = () => {
    const { footerConfig, fetchFooterConfig, updateFooterConfig, isLoading } = useFooterStore();
    const { pages, fetchPages } = useContentStore();
    const [config, setConfig] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [expandedQuickLinks, setExpandedQuickLinks] = useState([]);
    const [expandedSections, setExpandedSections] = useState([]);
    const [expandedSectionLinks, setExpandedSectionLinks] = useState([]);

    useEffect(() => {
        fetchFooterConfig();
        fetchPages();
    }, [fetchFooterConfig, fetchPages]);

    useEffect(() => {
        if (!footerConfig) return;

        const nextConfig = JSON.parse(JSON.stringify(footerConfig));
        nextConfig.sections = Array.isArray(nextConfig.sections) ? nextConfig.sections.slice(0, 3) : [];

        while (nextConfig.sections.length < 3) {
            nextConfig.sections.push(createEmptySection());
        }

        nextConfig.sections = nextConfig.sections.map((section) => ({
            ...section,
            title: isGenericColumnTitle(section.title) ? '' : (section.title || '')
        }));

        nextConfig.socialLinks = {
            facebook: '',
            twitter: '',
            youtube: '',
            instagram: '',
            ...nextConfig.socialLinks
        };

        const legacyQuickLinks = [
            {
                label: 'Become a Seller',
                icon: 'seller',
                pageKey: nextConfig.becomeSellerPageKey || '',
                url: nextConfig.becomeSellerUrl || '',
                isExternal: Boolean(nextConfig.becomeSellerUrl)
            },
            {
                label: 'Advertise',
                icon: 'advertise',
                pageKey: nextConfig.advertisePageKey || '',
                url: nextConfig.advertiseUrl || '',
                isExternal: Boolean(nextConfig.advertiseUrl)
            },
            {
                label: 'Gift Cards',
                icon: 'gift',
                pageKey: nextConfig.giftCardsPageKey || '',
                url: nextConfig.giftCardsUrl || '',
                isExternal: Boolean(nextConfig.giftCardsUrl)
            },
            {
                label: 'Help Center',
                icon: 'help',
                pageKey: nextConfig.helpCenterPageKey || '',
                url: nextConfig.helpCenterUrl || '',
                isExternal: Boolean(nextConfig.helpCenterUrl)
            }
        ].filter((link) => link.label && (link.pageKey || link.url));

        nextConfig.quickLinks = Array.isArray(nextConfig.quickLinks) && nextConfig.quickLinks.length
            ? nextConfig.quickLinks
            : legacyQuickLinks;
        nextConfig.quickLinks = nextConfig.quickLinks.map((link) => ({
            ...link,
            isExternal: Boolean(link.isExternal || link.url)
        }));
        nextConfig.sections = nextConfig.sections.map((section) => ({
            ...section,
            links: (section.links || []).map((link) => ({
                ...link,
                isExternal: Boolean(link.isExternal || link.url)
            }))
        }));

        setConfig(nextConfig);
        setIsEditing(false);
        setExpandedQuickLinks([]);
        setExpandedSections([]);
        setExpandedSectionLinks([]);
    }, [footerConfig]);

    const handleSave = async () => {
        try {
            const payload = {
                ...config,
                sections: (config.sections || []).map((section, index) => ({
                    title: section.title?.trim() || '',
                    links: (section.links || [])
                        .map((link) => ({
                            label: link.label?.trim() || '',
                            pageKey: link.pageKey || '',
                            url: link.url?.trim() || '',
                            isExternal: Boolean(link.isExternal || link.url)
                        }))
                        .filter((link) => link.label && (link.pageKey || link.url))
                })).filter((section) => section.title || section.links.length),
                quickLinks: (config.quickLinks || [])
                    .map((link) => ({
                        label: link.label?.trim() || '',
                        icon: link.icon || 'help',
                        pageKey: link.pageKey || '',
                        url: link.url?.trim() || '',
                        isExternal: Boolean(link.isExternal || link.url)
                    }))
                    .filter((link) => link.label && (link.pageKey || link.url))
            };

            await updateFooterConfig(payload);
            toast.success('Footer settings updated');
            setIsEditing(false);
        } catch (error) {
            toast.error('Failed to update footer settings');
        }
    };

    const handleConfigChange = (field, value) => {
        setConfig((current) => ({ ...current, [field]: value }));
    };

    const handleSectionTitleChange = (index, value) => {
        setConfig((current) => ({
            ...current,
            sections: current.sections.map((section, sectionIndex) =>
                sectionIndex === index ? { ...section, title: value } : section
            )
        }));
    };

    const handleLinkChange = (sectionIndex, linkIndex, field, value) => {
        setConfig((current) => ({
            ...current,
            sections: current.sections.map((section, currentSectionIndex) => {
                if (currentSectionIndex !== sectionIndex) return section;

                return {
                    ...section,
                    links: section.links.map((link, currentLinkIndex) =>
                        currentLinkIndex === linkIndex
                            ? {
                                ...link,
                                ...(
                                    field === 'pageKey'
                                        ? { pageKey: value, url: value ? '' : link.url, isExternal: false }
                                        : field === 'url'
                                            ? { url: value, pageKey: value ? '' : link.pageKey, isExternal: true }
                                            : { [field]: value }
                                )
                            }
                            : link
                    )
                };
            })
        }));
    };

    const addLink = (sectionIndex) => {
        setConfig((current) => ({
            ...current,
            sections: current.sections.map((section, currentSectionIndex) =>
                currentSectionIndex === sectionIndex
                    ? { ...section, links: [...section.links, createEmptyLink()] }
                    : section
            )
        }));
        setExpandedSections((current) =>
            current.includes(sectionIndex) ? current : [...current, sectionIndex]
        );
        setExpandedSectionLinks((current) => [
            ...current,
            `${sectionIndex}-${config?.sections?.[sectionIndex]?.links?.length || 0}`
        ]);
    };

    const removeLink = (sectionIndex, linkIndex) => {
        setConfig((current) => ({
            ...current,
            sections: current.sections.map((section, currentSectionIndex) => {
                if (currentSectionIndex !== sectionIndex) return section;

                const nextLinks = section.links.filter((_, currentLinkIndex) => currentLinkIndex !== linkIndex);
                return { ...section, links: nextLinks.length ? nextLinks : [createEmptyLink()] };
            })
        }));
        setExpandedSectionLinks((current) =>
            current.filter((key) => key !== `${sectionIndex}-${linkIndex}`)
        );
    };

    const addQuickLink = () => {
        setConfig((current) => ({
            ...current,
            quickLinks: [...(current.quickLinks || []), createEmptyQuickLink()]
        }));
        setExpandedQuickLinks((current) => [...current, (config?.quickLinks || []).length]);
    };

    const handleQuickLinkChange = (index, field, value) => {
        setConfig((current) => ({
            ...current,
            quickLinks: (current.quickLinks || []).map((link, linkIndex) =>
                linkIndex === index
                    ? {
                        ...link,
                        ...(
                            field === 'pageKey'
                                ? { pageKey: value, url: value ? '' : link.url, isExternal: false }
                                : field === 'url'
                                    ? { url: value, pageKey: value ? '' : link.pageKey, isExternal: true }
                                    : { [field]: value }
                        )
                    }
                    : link
            )
        }));
    };

    const removeQuickLink = (index) => {
        setConfig((current) => ({
            ...current,
            quickLinks: (current.quickLinks || []).filter((_, linkIndex) => linkIndex !== index)
        }));
        setExpandedQuickLinks((current) =>
            current
                .filter((item) => item !== index)
                .map((item) => (item > index ? item - 1 : item))
        );
    };

    const toggleSectionExpanded = (index) => {
        setExpandedSections((current) =>
            current.includes(index)
                ? current.filter((item) => item !== index)
                : [...current, index]
        );
    };

    const toggleSectionLinkExpanded = (sectionIndex, linkIndex) => {
        const key = `${sectionIndex}-${linkIndex}`;
        setExpandedSectionLinks((current) =>
            current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key]
        );
    };

    const toggleQuickLinkExpanded = (index) => {
        setExpandedQuickLinks((current) =>
            current.includes(index)
                ? current.filter((item) => item !== index)
                : [...current, index]
        );
    };

    const availablePages = Array.from(
        new Map(
            (pages || [])
                .filter((page) => !RESERVED_PAGE_KEYS.has(page.pageKey))
                .map((page) => [page.pageKey, page])
        ).values()
    ).sort((a, b) => a.pageKey.localeCompare(b.pageKey));

    if (!config) {
        return <div className="p-8 text-center text-sm font-medium text-gray-500">Loading footer settings...</div>;
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Footer Settings</h1>
                    <p className="text-sm text-gray-500">
                        Keep the footer simple: 3 columns, quick links, address, CIN, copyright, and social links.
                    </p>
                </div>
                {isEditing ? (
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                    >
                        <MdSave />
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        <MdEdit />
                        Edit
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <MdBusiness className="text-primary-600" />
                        Address
                    </h2>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Mail Us Address</label>
                        <textarea
                            value={config.mailAddress || ''}
                            onChange={(e) => handleConfigChange('mailAddress', e.target.value)}
                            rows="4"
                            disabled={!isEditing}
                            placeholder="Enter mail us address"
                            className="w-full resize-none rounded-xl border border-gray-200 p-4 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Address</label>
                        <textarea
                            value={config.officeAddress || ''}
                            onChange={(e) => handleConfigChange('officeAddress', e.target.value)}
                            rows="4"
                            disabled={!isEditing}
                            placeholder="Enter address"
                            className="w-full resize-none rounded-xl border border-gray-200 p-4 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <MdCopyright className="text-primary-600" />
                        Copyright, CIN And Social Links
                    </h2>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Copyright Text</label>
                        <input
                            value={config.copyrightText || ''}
                            onChange={(e) => handleConfigChange('copyrightText', e.target.value)}
                            disabled={!isEditing}
                            placeholder="Enter copyright text"
                            className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">CIN</label>
                        <input
                            value={config.cinNumber || ''}
                            onChange={(e) => handleConfigChange('cinNumber', e.target.value)}
                            disabled={!isEditing}
                            placeholder="Enter CIN number"
                            className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {['facebook', 'twitter', 'youtube', 'instagram'].map((platform) => (
                            <div key={platform} className="space-y-1">
                                <label className="text-sm font-medium capitalize text-gray-700">{platform}</label>
                                <input
                                    value={config.socialLinks?.[platform] || ''}
                                    onChange={(e) =>
                                        handleConfigChange('socialLinks', {
                                            ...config.socialLinks,
                                            [platform]: e.target.value
                                        })
                                    }
                                    disabled={!isEditing}
                                    placeholder={`https://${platform}.com/...`}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                                />
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <MdLink className="text-primary-600" />
                    Bottom Quick Links
                </h2>

                <div className="space-y-4">
                    {(config.quickLinks || []).map((link, index) => (
                        <div key={index} className="rounded-xl border border-gray-200">
                            <button
                                type="button"
                                onClick={() => toggleQuickLinkExpanded(index)}
                                className="flex w-full items-center justify-between gap-3 p-4 text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {React.createElement(QUICK_LINK_ICON_COMPONENTS[link.icon || 'help'] || FaQuestionCircle, {
                                        className: 'shrink-0 text-base text-primary-600'
                                    })}
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-gray-900">
                                            {link.label || `Quick Link ${index + 1}`}
                                        </p>
                                        <p className="truncate text-xs text-gray-500">
                                            {link.pageKey || link.url || 'No target selected'}
                                        </p>
                                    </div>
                                </div>
                                {expandedQuickLinks.includes(index) ? (
                                    <MdChevronLeft className="shrink-0 text-xl text-gray-400" />
                                ) : (
                                    <MdChevronRight className="shrink-0 text-xl text-gray-400" />
                                )}
                            </button>

                            {expandedQuickLinks.includes(index) ? (
                                <div className="space-y-3 border-t border-gray-200 p-4">
                                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(220px,1.2fr)]">
                                        <input
                                            value={link.label}
                                            onChange={(e) => handleQuickLinkChange(index, 'label', e.target.value)}
                                            disabled={!isEditing}
                                            placeholder="Name"
                                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                                        />
                                        <select
                                            value={link.icon || 'help'}
                                            onChange={(e) => handleQuickLinkChange(index, 'icon', e.target.value)}
                                            disabled={!isEditing}
                                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                                        >
                                            {QUICK_LINK_ICONS.map((icon) => (
                                                <option key={icon.value} value={icon.value}>
                                                    {icon.label} icon
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={`grid grid-cols-1 gap-3 ${link.isExternal ? 'xl:grid-cols-[minmax(220px,1fr)_minmax(320px,1.5fr)]' : 'xl:grid-cols-[minmax(220px,1fr)]'}`}>
                                        <select
                                            value={link.isExternal ? EXTERNAL_LINK_OPTION : (link.pageKey || '')}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === EXTERNAL_LINK_OPTION) {
                                                    handleQuickLinkChange(index, 'url', link.url || '');
                                                    return;
                                                }
                                                handleQuickLinkChange(index, 'pageKey', value);
                                            }}
                                            disabled={!isEditing}
                                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                                        >
                                            <option value="">Select page</option>
                                            {availablePages.map((page) => (
                                                <option key={page.pageKey} value={page.pageKey}>
                                                    {page.pageKey}
                                                </option>
                                            ))}
                                            <option value={EXTERNAL_LINK_OPTION}>External link</option>
                                        </select>
                                        {link.isExternal ? (
                                            <input
                                                value={link.url || ''}
                                                onChange={(e) => handleQuickLinkChange(index, 'url', e.target.value)}
                                                disabled={!isEditing}
                                                placeholder="Enter external URL"
                                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                                            />
                                        ) : null}
                                    </div>
                                    {isEditing ? (
                                        <button
                                            onClick={() => removeQuickLink(index)}
                                            className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                                        >
                                            <MdDelete />
                                            Remove link
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ))}

                    {isEditing ? (
                        <button
                            onClick={addQuickLink}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-primary-400 hover:text-primary-600"
                        >
                            <MdAdd />
                            Add Link
                        </button>
                    ) : null}
                </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <MdLink className="text-primary-600" />
                        Footer Columns
                    </h2>
                    <span className="text-sm text-gray-500">3 fixed columns with page links or external URLs</span>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    {config.sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="rounded-2xl border border-gray-200">
                            <div className="flex items-center justify-between gap-3 p-5">
                                <div className="min-w-0 flex-1">
                                    <input
                                        value={section.title}
                                        onChange={(e) => handleSectionTitleChange(sectionIndex, e.target.value)}
                                        placeholder={`Column ${sectionIndex + 1} heading`}
                                        disabled={!isEditing}
                                        className="w-full rounded-lg border border-transparent px-0 py-0 text-sm font-semibold text-gray-900 outline-none focus:border-gray-200 focus:px-3 focus:py-2 disabled:bg-transparent disabled:text-gray-900"
                                    />
                                    <p className="text-xs text-gray-500">
                                        {(section.links || []).filter((link) => link.label || link.pageKey || link.url).length} links
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleSectionExpanded(sectionIndex)}
                                    className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-50"
                                >
                                    {expandedSections.includes(sectionIndex) ? (
                                        <MdChevronLeft className="text-xl" />
                                    ) : (
                                        <MdChevronRight className="text-xl" />
                                    )}
                                </button>
                            </div>

                            {expandedSections.includes(sectionIndex) ? (
                                <div className="space-y-4 border-t border-gray-200 p-5">
                                    <div className="space-y-3">
                                        {section.links.map((link, linkIndex) => (
                                            <div key={linkIndex} className="rounded-xl border border-gray-200">
                                                <div className="flex items-center justify-between gap-3 p-4">
                                                    <div className="min-w-0 flex-1">
                                                        <input
                                                            value={link.label}
                                                            onChange={(e) => handleLinkChange(sectionIndex, linkIndex, 'label', e.target.value)}
                                                            disabled={!isEditing}
                                                            placeholder={`Link ${linkIndex + 1}`}
                                                            className="w-full rounded-lg border border-transparent px-0 py-0 text-sm font-semibold text-gray-900 outline-none focus:border-gray-200 focus:px-3 focus:py-2 disabled:bg-transparent disabled:text-gray-900"
                                                        />
                                                        <p className="truncate text-xs text-gray-500">
                                                            {link.pageKey || link.url || 'No target selected'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSectionLinkExpanded(sectionIndex, linkIndex)}
                                                        className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-50"
                                                    >
                                                        {expandedSectionLinks.includes(`${sectionIndex}-${linkIndex}`) ? (
                                                            <MdChevronLeft className="text-xl" />
                                                        ) : (
                                                            <MdChevronRight className="text-xl" />
                                                        )}
                                                    </button>
                                                </div>

                                                {expandedSectionLinks.includes(`${sectionIndex}-${linkIndex}`) ? (
                                                    <div className="space-y-3 border-t border-gray-200 p-4">
                                                        <select
                                                    value={link.isExternal ? EXTERNAL_LINK_OPTION : (link.pageKey || '')}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (value === EXTERNAL_LINK_OPTION) {
                                                                    handleLinkChange(sectionIndex, linkIndex, 'url', link.url || '');
                                                                    return;
                                                                }
                                                                handleLinkChange(sectionIndex, linkIndex, 'pageKey', value);
                                                            }}
                                                            disabled={!isEditing}
                                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                                                        >
                                                            <option value="">Select page</option>
                                                            {availablePages.map((page) => (
                                                                <option key={page.pageKey} value={page.pageKey}>
                                                                    {page.pageKey}
                                                                </option>
                                                            ))}
                                                            <option value={EXTERNAL_LINK_OPTION}>External link</option>
                                                        </select>
                                                        {link.isExternal ? (
                                                            <input
                                                                value={link.url || ''}
                                                                onChange={(e) => handleLinkChange(sectionIndex, linkIndex, 'url', e.target.value)}
                                                                disabled={!isEditing}
                                                                placeholder="Enter external URL"
                                                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                                                            />
                                                        ) : null}
                                                        {isEditing ? (
                                                            <button
                                                                onClick={() => removeLink(sectionIndex, linkIndex)}
                                                                className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                                                            >
                                                                <MdDelete />
                                                                Remove link
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}

                                        {isEditing ? (
                                            <button
                                                onClick={() => addLink(sectionIndex)}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-primary-400 hover:text-primary-600"
                                            >
                                                <MdAdd />
                                                Add Link
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default FooterManager;
