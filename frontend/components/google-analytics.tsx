import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Loads GA4 only when a Measurement ID is configured (production build), so
// local dev sends nothing. Client-side route changes are counted by GA4's
// "page changes based on browser history events" enhanced measurement.
export function GoogleAnalytics() {
  if (!GA_ID || !/^G-[A-Z0-9]+$/.test(GA_ID)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            // Never report the URL fragment - reset links carry their one-time token there.
            page_location: location.origin + location.pathname + location.search
          });
        `}
      </Script>
    </>
  );
}
