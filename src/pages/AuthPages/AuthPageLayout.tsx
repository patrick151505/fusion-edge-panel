import React from "react";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}
        {/* Right half: a full-bleed background video with the logo overlaid. */}
        <div className="relative hidden w-full h-full overflow-hidden lg:block lg:w-1/2 bg-gray-900">
          <video
            className="absolute inset-0 object-cover w-full h-full"
            src="https://txgxonwcdrxayurzjcwb.supabase.co/storage/v1/object/public/assets/cover-hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          {/* Scrim so the logo stays readable over any frame. */}
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <Link to="/" className="block">
              <img
                width={231}
                height={50}
                src="/log-fusion-dark.png"
                alt="FusionEdge"
              />
            </Link>
          </div>
        </div>
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
