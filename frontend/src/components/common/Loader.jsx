import React from 'react';

const Loader = ({
  fullPage = false,
  message = "Loading...",
  isSuccess = false,
  variant = "spinner",
}) => {
  const loaderContent = (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      {isSuccess ? (
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
            <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3} 
                d="M5 13l4 4L19 7" 
                className="animate-[draw_0.6s_ease-in-out_forwards]"
                style={{ strokeDasharray: 50, strokeDashoffset: 50 }}
              />
            </svg>
          </div>
          <style>{`
            @keyframes draw {
              to { stroke-dashoffset: 0; }
            }
          `}</style>
        </div>
      ) : (
        variant === "shimmer" ? (
          <div className="w-[260px] space-y-3">
            <div className="h-4 rounded shimmer"></div>
            <div className="h-4 rounded shimmer"></div>
            <div className="h-4 w-2/3 rounded shimmer"></div>
          </div>
        ) : (
          <div className="relative">
            <div className="w-12 h-12 border-4 border-primary-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )
      )}
      {message && (
        <p className={`mt-4 text-sm font-bold ${isSuccess ? 'text-green-600' : 'text-gray-600 animate-pulse'} uppercase tracking-widest`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
};

export default Loader;
