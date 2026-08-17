import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdCall, MdEmail, MdPerson, MdSchedule, MdSupportAgent } from 'react-icons/md';
import { legalContact } from './legalPageData';

const SupportPage = () => {
    const navigate = useNavigate();

    const supportTopics = [
        {
            title: 'Order Help',
            description: 'Use this for delayed delivery, tracking issues, cancellation help, damaged items, returns, or refund follow-up.'
        },
        {
            title: 'Account Help',
            description: 'Reach out if you have login trouble, OTP issues, profile updates, address problems, or account security concerns.'
        },
        {
            title: 'Payment Help',
            description: 'Contact support for payment failures, double charges, UPI/card issues, invoice requests, and refund status.'
        }
    ];

    const steps = [
        'Share your order ID, registered mobile number, and a short description of the issue.',
        'If the issue is about a damaged or wrong product, include photos or a short video if available.',
        'For payment issues, mention the payment method, transaction time, and the amount charged.',
        'The support team will review the request and respond with the next steps as quickly as possible.'
    ];

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
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2874f0]">Support</p>
                        <h1 className="text-2xl font-bold md:text-3xl">Customer Support</h1>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 md:p-8">
                        <div className="mb-6 flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-[#2874f0]">
                                <MdSupportAgent size={30} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">We are here to help</h2>
                                <p className="mt-2 text-sm leading-6 text-gray-600">
                                    If you need help with orders, returns, payments, account access, or product issues,
                                    you can contact the IndiaKart support team using the details below.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            {supportTopics.map((topic) => (
                                <div key={topic.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                    <h3 className="text-base font-semibold text-gray-900">{topic.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-gray-600">{topic.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 rounded-2xl border border-primary-100 bg-primary-50/60 p-5">
                            <div className="mb-3 flex items-center gap-2 text-[#2874f0]">
                                <MdSchedule size={20} />
                                <h3 className="text-base font-semibold">Before you contact support</h3>
                            </div>
                            <ol className="space-y-3 text-sm leading-6 text-gray-700">
                                {steps.map((step, index) => (
                                    <li key={step} className="flex gap-3">
                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#2874f0]">
                                            {index + 1}
                                        </span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </section>

                    <aside className="space-y-6">
                        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Contact Details</h2>
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

                        <section className="rounded-3xl bg-[#111827] p-6 text-white shadow-sm">
                            <h2 className="text-lg font-bold">Support Note</h2>
                            <p className="mt-3 text-sm leading-6 text-white/80">
                                For the fastest response, contact support from the same mobile number or email used on your IndiaKart account.
                            </p>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
