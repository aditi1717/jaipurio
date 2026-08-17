import React, { useEffect, useState } from 'react';
import { MdArrowBack } from 'react-icons/md';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useContentStore } from '../../admin/store/contentStore';
import API from '../../../services/api';
import HelpCenter from './HelpCenter';

const InfoPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { privacyPolicy, aboutUs } = useContentStore();
    const type = searchParams.get('type');
    const pageKey = searchParams.get('key');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const renderError = () => {
            setTitle('Page Not Found');
            setContent('<p class="text-gray-500 italic">The requested information page could not be found.</p>');
        };

        const getTitle = (key) => {
            if (key === 'privacyPolicy') return 'Privacy Policy';
            if (key === 'aboutUs') return 'About Us';
            if (key === 'seoContent') return 'SEO Footer Text';
            return key.replace(/-/g, ' ').replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
        };

        const fetchDynamicContent = async (key) => {
            setLoading(true);
            try {
                const { data } = await API.get(`/pages/${key}`);
                if (data) {
                    setTitle(data.title || getTitle(key));
                    setContent(data.content || '');
                } else {
                    renderError();
                }
            } catch (error) {
                renderError();
            } finally {
                setLoading(false);
            }
        };

        if (type === 'privacy') {
            setTitle('Privacy Policy');
            setContent(privacyPolicy);
        } else if (type === 'about') {
            setTitle('About Us');
            setContent(aboutUs);
        } else if (type === 'dynamic' && pageKey && pageKey !== 'help-center') {
            fetchDynamicContent(pageKey);
        } else {
            renderError();
        }
    }, [type, pageKey, privacyPolicy, aboutUs]);

    if (type === 'dynamic' && pageKey === 'help-center') {
        return <HelpCenter embeddedInInfo />;
    }

    return (
        <div className="bg-white text-gray-900">
            <div className="w-full px-4 sm:px-5 md:px-7 py-6 md:py-12 min-h-[420px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-primary-50 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-sm text-gray-400 font-medium">Loading content...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="w-10 h-10 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                                aria-label="Go back"
                            >
                                <MdArrowBack size={20} />
                            </button>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-center break-words">{title}</h1>
                            <div />
                        </div>
                        <div
                            className="text-gray-700 leading-7
                                [&_h1]:text-2xl md:[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4
                                [&_h2]:text-xl md:[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3
                                [&_h3]:text-lg md:[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2
                                [&_p]:mb-4
                                [&_p]:break-words
                                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
                                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
                                [&_li]:mb-1
                                [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto"
                            dangerouslySetInnerHTML={{ __html: content || '<p class="text-gray-400 italic">This page has no content yet.</p>' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default InfoPage;
