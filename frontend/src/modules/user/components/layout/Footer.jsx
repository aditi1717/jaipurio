import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBullhorn, FaFacebookF, FaGift, FaInfoCircle, FaInstagram, FaLink, FaQuestionCircle, FaStar, FaStore, FaYoutube } from 'react-icons/fa';
import { RiTwitterXFill } from 'react-icons/ri';
import { MdSupportAgent } from 'react-icons/md';
import { useContentStore } from '../../../admin/store/contentStore';
import { useFooterStore } from '../../../admin/store/footerStore';

const Footer = () => {
    const navigate = useNavigate();
    const { copyright, fetchPages } = useContentStore();
    const { footerConfig, fetchFooterConfig } = useFooterStore();

    useEffect(() => {
        if (!footerConfig) {
            fetchFooterConfig();
        }
        fetchPages();
    }, [footerConfig, fetchFooterConfig, fetchPages]);

    if (!footerConfig) return null;

    const handleLinkClick = (link) => {
        if (link.isExternal || (link.url && link.url.startsWith('http'))) {
            window.location.href = link.url;
            return;
        }

        if (link.pageKey) {
            navigate(`/info?type=dynamic&key=${link.pageKey}`);
            return;
        }

        if (link.url) {
            navigate(link.url);
        }
    };

    const footerSections = (footerConfig.sections || []).slice(0, 3);

    const socialIcons = [
        { platform: 'facebook', icon: FaFacebookF, url: footerConfig.socialLinks?.facebook },
        { platform: 'twitter', icon: RiTwitterXFill, url: footerConfig.socialLinks?.twitter },
        { platform: 'youtube', icon: FaYoutube, url: footerConfig.socialLinks?.youtube },
        { platform: 'instagram', icon: FaInstagram, url: footerConfig.socialLinks?.instagram }
    ];

    const quickLinkIconMap = {
        seller: FaStore,
        advertise: FaBullhorn,
        gift: FaGift,
        help: FaQuestionCircle,
        support: MdSupportAgent,
        info: FaInfoCircle,
        star: FaStar,
        link: FaLink
    };

    const legacyQuickLinks = [
        {
            label: 'Become a Seller',
            icon: FaStore,
            pageKey: footerConfig.becomeSellerPageKey || '',
            url: footerConfig.becomeSellerUrl || ''
        },
        {
            label: 'Advertise',
            icon: FaBullhorn,
            pageKey: footerConfig.advertisePageKey || '',
            url: footerConfig.advertiseUrl || ''
        },
        {
            label: 'Gift Cards',
            icon: FaGift,
            pageKey: footerConfig.giftCardsPageKey || '',
            url: footerConfig.giftCardsUrl || ''
        },
        {
            label: 'Help Center',
            icon: FaQuestionCircle,
            pageKey: footerConfig.helpCenterPageKey || '',
            url: footerConfig.helpCenterUrl || ''
        }
    ].filter((link) => link.pageKey || link.url);

    const quickLinks = (footerConfig.quickLinks?.length ? footerConfig.quickLinks : legacyQuickLinks)
        .map((link) => {
            const iconMap = {
                'Become a Seller': FaStore,
                Advertise: FaBullhorn,
                'Gift Cards': FaGift,
                'Help Center': FaQuestionCircle
            };

            return {
                ...link,
                icon: quickLinkIconMap[link.icon] || iconMap[link.label] || FaQuestionCircle
            };
        })
        .filter((link) => link.label && (link.pageKey || link.url));

    return (
        <footer className="w-full overflow-hidden border-t border-gray-700 bg-[#212121] text-[12px] text-white">
            <div className="hidden max-w-[1440px] mx-auto px-4 pb-6 pt-10 md:block">
                <div className="flex w-full gap-8">
                    <div className="flex-[4.5] grid grid-cols-3 gap-6 pr-8">
                        {footerSections.map((section, index) => (
                            <div key={index}>
                                <h6 className="mb-3 cursor-default uppercase text-[#878787]">{section.title}</h6>
                                <ul className="space-y-1.5 font-bold">
                                    {section.links.map((link, linkIndex) => (
                                        <li key={linkIndex}>
                                            <button
                                                onClick={() => handleLinkClick(link)}
                                                className="text-left text-white hover:underline"
                                            >
                                                {link.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <div className="flex-[3] flex border-l border-[#454d5e] pl-8 gap-8 text-[11px] leading-relaxed">
                        <div className="flex-1">
                            <div>
                                <h6 className="mb-3 uppercase text-[#878787]">Mail Us:</h6>
                                <p className="whitespace-pre-line font-medium text-white">{footerConfig.mailAddress}</p>
                            </div>

                            <div className="mt-6">
                                <h6 className="mb-3 uppercase text-[#878787]">Social:</h6>
                                <div className="flex gap-4">
                                    {socialIcons.map((social, index) =>
                                        social.url && social.url.trim() !== '' ? (
                                            <a
                                                key={index}
                                                href={social.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-white transition-colors hover:text-primary-400"
                                            >
                                                <social.icon size={18} />
                                            </a>
                                        ) : null
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1">
                            <div>
                                <h6 className="mb-3 uppercase text-[#878787]">Registered Office Address:</h6>
                                <p className="whitespace-pre-line font-medium text-white">{footerConfig.officeAddress}</p>
                            </div>

                            {footerConfig.cinNumber && (
                                <div className="mt-4">
                                    <h6 className="mb-1 uppercase text-[#878787]">CIN:</h6>
                                    <p className="font-medium uppercase text-white">{footerConfig.cinNumber}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-10 border-t border-[#454d5e] pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-10">
                            {quickLinks.map((link) => (
                                <button
                                    key={link.label}
                                    onClick={() => handleLinkClick({ pageKey: link.pageKey, url: link.url })}
                                    className="group flex items-center gap-2 text-white transition-colors hover:text-yellow-400"
                                >
                                    <link.icon className="text-sm text-yellow-500 transition-transform group-hover:scale-110" />
                                    <span className="font-bold">{link.label}</span>
                                </button>
                            ))}

                            {copyright ? (
                                <span
                                    className="footer-copyright-html font-bold leading-none text-white"
                                    dangerouslySetInnerHTML={{ __html: copyright }}
                                />
                            ) : (
                                <span className="font-bold leading-none text-white">{footerConfig.copyrightText}</span>
                            )}
                        </div>

                        <img
                            src="https://static-assets-web.flixcart.com/batman-returns/batman-returns/p/images/payment-method-c454fb.svg"
                            alt="Payment Methods"
                            className="h-4 cursor-pointer grayscale transition-all hover:grayscale-0"
                        />
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-700 bg-[#212121] px-4 pb-24 pt-8 md:hidden">
                <div className="flex flex-col gap-6 text-xs text-gray-300">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        {footerSections.map((section, sectionIndex) => (
                            <div key={sectionIndex}>
                                <h6 className="mb-2 font-bold uppercase text-[#878787]">{section.title}</h6>
                                <ul className="space-y-1">
                                    {section.links.slice(0, 4).map((link, linkIndex) => (
                                        <li key={linkIndex}>
                                            <button
                                                onClick={() => handleLinkClick(link)}
                                                className="text-left text-white hover:text-primary-400"
                                            >
                                                {link.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-gray-800 pt-6">
                        {quickLinks.map((link) => (
                            <button
                                key={link.label}
                                onClick={() => handleLinkClick({ pageKey: link.pageKey, url: link.url })}
                                className="flex items-center gap-2 text-left text-white"
                            >
                                <link.icon className="text-sm text-yellow-500" />
                                <span className="font-bold">{link.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-center gap-6 border-y border-gray-800 py-4">
                        {socialIcons.map((social, index) =>
                            social.url && social.url.trim() !== '' ? (
                                <a key={index} href={social.url} className="text-white">
                                    <social.icon size={20} />
                                </a>
                            ) : null
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-8 px-2 py-2 text-[10px] leading-relaxed">
                        <div>
                            <h6 className="mb-2 font-bold uppercase tracking-wider text-[#878787]">Mail Us:</h6>
                            <p className="whitespace-pre-line text-white/90">{footerConfig.mailAddress}</p>
                        </div>
                        <div>
                            <h6 className="mb-2 font-bold uppercase tracking-wider text-[#878787]">Office:</h6>
                            <p className="whitespace-pre-line text-white/90">{footerConfig.officeAddress}</p>
                        </div>
                    </div>

                    {footerConfig.cinNumber && (
                        <div className="px-4 text-center">
                            <p className="mb-1 text-[10px] font-bold uppercase text-[#878787]">CIN: {footerConfig.cinNumber}</p>
                        </div>
                    )}

                    <div className="text-center">
                        {copyright ? (
                            <div
                                className="footer-copyright-html mb-4 block font-bold text-white"
                                dangerouslySetInnerHTML={{ __html: copyright }}
                            />
                        ) : (
                            <span className="mb-4 block font-bold text-white">{footerConfig.copyrightText}</span>
                        )}
                        <img
                            src="https://static-assets-web.flixcart.com/batman-returns/batman-returns/p/images/payment-method-c454fb.svg"
                            alt="Payment Methods"
                            className="mx-auto h-4 opacity-70"
                        />
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
