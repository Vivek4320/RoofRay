"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "How does RoofRay determine if my roof is suitable for solar?",
    answer:
      "RoofRay combines your location, rooftop details, sunlight data, shading conditions, and electricity usage to generate a personalized solar feasibility report.",
  },
  {
    question: "Which data sources does RoofRay use?",
    answer:
      "RoofRay uses trusted public datasets including NASA POWER, Open-Meteo, Nominatim, and PVGIS to provide accurate location-based analysis.",
  },
  {
    question: "Do I need to know my roof dimensions?",
    answer:
      "No. Simply describe your rooftop naturally. RoofRay asks the right questions and estimates everything needed for the analysis.",
  },
  {
    question: "How accurate are the results?",
    answer:
      "The report is based on real solar irradiance data and the information you provide. Final installation details should always be confirmed by a certified installer.",
  },
  {
    question: "How long does the analysis take?",
    answer:
      "Most personalized solar feasibility reports are generated in under two minutes.",
  },
  {
    question: "Is RoofRay free to use?",
    answer:
      "Yes. RoofRay allows you to generate an AI-powered preliminary solar feasibility report for free.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id='faq' className="relative py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6">
        {/* Badge */}
        <div className="mb-4 sm:mb-5 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 sm:px-4 py-1.5 sm:py-2">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
            Frequently Asked Questions
          </span>
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight text-white">
          Everything you
          <br />
          <span className="relative inline-block">
              <span className="blue-text">need to know.</span>
              <svg className="absolute -bottom-4 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
              </svg>
            </span>
        </h2>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg text-slate-400">
          Everything about RoofRay, our AI-powered rooftop analysis, and solar
          feasibility reports.
        </p>

        {/* FAQ */}
        <div className="mt-8 sm:mt-14 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-300 hover:border-blue-500/30"
              >
                <button
                  onClick={() =>
                    setOpenIndex(isOpen ? null : index)
                  }
                  className="flex w-full items-center justify-between px-5 sm:px-6 py-4 sm:py-5 text-left"
                >
                  <span className="text-base sm:text-lg font-semibold text-white">
                    {faq.question}
                  </span>

                  <ChevronDown
                    className={`h-5 w-5 text-blue-400 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-300 ${
                    isOpen
                      ? "grid-rows-[1fr]"
                      : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm sm:text-base text-slate-400 leading-6 sm:leading-7">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}