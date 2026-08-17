import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdCall, MdEmail, MdPerson, MdPrivacyTip } from 'react-icons/md';
import { legalContact, privacySections } from './legalPageData';

const PrivacyPolicyPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#f7f8fa] text-gray-900">
            <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
                <div className="mb-6 flex items-center gap-3 md:mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        aria-label="Go back"
                    >
                        <MdArrowBack size={20} />
                    </button>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2874f0]">Privacy</p>
                        <h1 className="text-2xl font-bold md:text-3xl">Privacy Policy</h1>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[1.65fr_0.95fr]">
                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 md:p-8">
                        <div className="mb-6 flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-[#2874f0]">
                                <MdPrivacyTip size={30} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Your privacy matters</h2>
                                <p className="mt-2 text-sm leading-6 text-gray-600">
                                    This page explains how IndiaKart may collect, use, store, and protect customer information
                                    while providing shopping, delivery, account, and support services.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {privacySections.map((section) => (
                                <div key={section.title} className="rounded-2xl border border-gray-100 p-5">
                                    <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-gray-600">{section.body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <aside className="space-y-6">
                        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Contact For Privacy Queries</h2>
                            <div className="mt-5 space-y-4">
                                <div className="flex items-start gap-3">
                                    <MdPerson className="mt-1 text-[#2874f0]" size={20} />
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Owner Name</p>
                                        <p className="text-sm font-medium text-gray-800">{legalContact.ownerName}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MdCall className="mt-1 text-[#2874f0]" size={20} />
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Contact Number</p>
                                        <a href={`tel:+91${legalContact.phoneHref}`} className="text-sm font-medium text-gray-800 hover:text-[#2874f0]">
                                            +91 {legalContact.phoneDisplay}
                                        </a>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MdEmail className="mt-1 text-[#2874f0]" size={20} />
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Email Address</p>
                                        <a href={`mailto:${legalContact.email}`} className="text-sm font-medium text-gray-800 hover:text-[#2874f0]">
                                            {legalContact.email}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-3xl bg-primary-50 p-6 shadow-sm ring-1 ring-primary-100">
                            <h2 className="text-lg font-bold text-gray-900">Need A Change?</h2>
                            <p className="mt-3 text-sm leading-6 text-gray-700">
                                If you want to update your profile details or request account deletion, please contact the client using the details above.
                            </p>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;
