import React from "react";

export type BrandId =
  | "shopify"
  | "woocommerce"
  | "wix"
  | "bigcommerce"
  | "medusa"
  | "magento"
  | "prestashop"
  | "squarespace"
  | "ecwid"
  | "connect"
  | "api"
  | "push"
  | string;

export function BrandLogo({
  brand,
  size = 42,
  className = "",
}: {
  brand: BrandId;
  size?: number;
  className?: string;
}) {
  const b = (brand || "").toLowerCase();

  // 1. Shopify
  if (b === "shopify" || b === "shopify-app" || b === "shopify_csv") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#5E8E3E" }}
        title="Shopify"
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <path
            d="M15.3 6.6c-.04-.26-.22-.44-.45-.45-.21-.01-3.67-.26-3.67-.26s-2.42-2.38-2.67-2.62c-.25-.24-.65-.17-.82.02l-1.2 1.37c-.11.12-.16.29-.14.45l1.6 9.89c.03.2.2.35.41.35h6.2c.2 0 .38-.15.41-.35l1.6-7.75c.01-.14-.03-.27-.13-.37l-1.54-.75z"
            fill="#3B6324"
          />
          <path
            d="M13.1 4.9c-.01-.1-.08-.9-.56-1.3-.58-.49-1.48-.46-1.77-.45-.3.01-.73.11-1 .22l-1.07 1.84c2.18-.16 4.02-.95 4.4-.31z"
            fill="#FFFFFF"
            fillOpacity="0.75"
          />
          <path
            d="M12.1 9.4c-.6-.1-.95-.27-.95-.6 0-.32.35-.55.9-.55.67 0 1.3.24 1.75.52l.46-1.18c-.52-.3-1.28-.5-2.2-.5-1.5 0-2.45.83-2.45 1.98 0 1.3 1.14 1.74 2.13 1.91.73.13 1 .36 1 .68 0 .36-.4.63-1.07.63-.8 0-1.56-.3-2.12-.7l-.51 1.25c.6.4 1.52.62 2.53.62 1.6 0 2.65-.79 2.65-2.06 0-1.26-.94-1.77-2.09-1.97z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    );
  }

  // 2. WooCommerce
  if (b === "woocommerce") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#7F54B3" }}
        title="WooCommerce"
      >
        <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 24 24" fill="none">
          <path
            d="M23.957 7.747c-.12-.862-.577-1.428-1.37-1.7-.8-.27-1.898-.242-3.298.083-1.4.326-2.92.936-4.562 1.83-1.64.894-3.146 1.942-4.517 3.145C8.84 9.9 7.334 8.852 5.694 7.958 4.053 7.064 2.533 6.454 1.133 6.128c-.4-.093-.762-.128-1.087-.107C.02 6.04-.002 6.07 0 6.108c.02.327.206.845.556 1.554.35.71.79 1.48 1.32 2.31.53.83 1.107 1.68 1.73 2.55.624.87 1.18 1.63 1.67 2.28.49.65.86 1.11 1.11 1.38.25.27.35.34.3.21-.05-.13-.19-.48-.42-1.05-.23-.57-.45-1.25-.66-2.04-.21-.79-.31-1.57-.3-2.34.01-.77.19-1.4.54-1.89.35-.49.88-.74 1.59-.75.71-.01 1.57.26 2.58.81 1.01.55 2.05 1.3 3.12 2.25 1.07.95 2.02 1.98 2.85 3.09.83 1.11 1.37 2.15 1.62 3.12.25.97.23 1.66-.06 2.07-.29.41-.85.55-1.68.42-.83-.13-1.88-.56-3.15-1.29-1.27-.73-2.61-1.72-4.02-2.97-1.41-1.25-2.75-2.67-4.02-4.26C2.18 10.45 1.18 8.67.55 6.72c-.1-.31-.19-.59-.27-.84C.12 6.36 0 6.94 0 7.62c0 2.94 1.25 5.58 3.28 7.39l-.02.13c-.02.1-.03.21-.03.32 0 1.93 1.57 3.5 3.5 3.5h1.24l3.66 3.66c.39.39 1.02.39 1.41 0l3.66-3.66H19c2.76 0 5-2.24 5-5V7.8c0-.02 0-.04-.04-.05z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    );
  }

  // 3. Wix
  if (b === "wix" || b === "wix-app") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#0C6EFC" }}
        title="Wix"
      >
        <svg width={size * 0.72} height={size * 0.45} viewBox="0 0 52 24" fill="none">
          <path d="M2.5 4h4.8l3.2 11.2L14 4h4.4l3.5 11.2L25.1 4h4.8l-5.6 16h-4.8L16 8.5 12.5 20H7.7L2.5 4z" fill="#FFFFFF" />
          <circle cx="34" cy="5" r="2.5" fill="#FFFFFF" />
          <rect x="31.8" y="9.5" width="4.4" height="10.5" rx="1" fill="#FFFFFF" />
          <path d="M40 9.5h4.6l2.7 4.2 2.7-4.2H54.6l-5 7.5 5.4 8h-4.8l-3.2-5-3.2 5H39l5.4-8-4.4-7.5z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // 4. BigCommerce
  if (b === "bigcommerce" || b === "bigcommerce-app") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#121118" }}
        title="BigCommerce"
      >
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none">
          <path d="M4.5 18.5h3.8l4.8-6.5-4.8-6.5H4.5l4.8 6.5-4.8 6.5z" fill="#FFFFFF" />
          <path d="M10.8 18.5h3.8l4.8-6.5-4.8-6.5h-3.8l4.8 6.5-4.8 6.5z" fill="#FFFFFF" fillOpacity="0.85" />
        </svg>
      </div>
    );
  }

  // 5. Medusa
  if (b === "medusa") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#111827" }}
        title="Medusa"
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3.5 7v10L12 22l8.5-5V7L12 2z" stroke="#94B1C8" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 22V12M12 12L3.5 7M12 12l8.5-5" stroke="#94B1C8" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
          <circle cx="12" cy="2" r="1.5" fill="#FFFFFF" />
          <circle cx="3.5" cy="7" r="1.5" fill="#FFFFFF" />
          <circle cx="20.5" cy="7" r="1.5" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // 6. Magento / Adobe Commerce
  if (b === "magento" || b === "adobe" || b === "magento-plugin") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#EE672F" }}
        title="Magento / Adobe Commerce"
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7.2v10.4L6 19.3V9.8l6-3.5 6 3.5v9.5l3-1.7V7.2L12 2z" fill="#FFFFFF" />
          <path d="M9 13.5v7.6l3 1.7 3-1.7v-7.6l-3 1.7-3-1.7z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // 7. PrestaShop
  if (b === "prestashop" || b === "prestashop-plugin") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#DF0067" }}
        title="PrestaShop"
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <path d="M12 3a9 9 0 0 0-9 9c0 3.3 1.8 6.2 4.5 7.7l.5-2.2A6.8 6.8 0 0 1 5.2 12a6.8 6.8 0 1 1 13.6 0c0 2.2-1 4.1-2.8 5.5l.5 2.2A9 9 0 0 0 12 3z" fill="#FFFFFF" />
          <circle cx="12" cy="11.5" r="2.8" fill="#FFFFFF" />
          <path d="M10.5 15.5h3l-1.5 4.5-1.5-4.5z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // 8. Squarespace
  if (b === "squarespace") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#000000" }}
        title="Squarespace"
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <path d="M16.5 7.5L13 11l2 2 3.5-3.5a3.5 3.5 0 0 0-4.95-4.95L10 8.05l2 2 1.55-1.55a1.5 1.5 0 0 1 2.12 2.12L13.2 13.1l1.4 1.4 2.5-2.5a3.5 3.5 0 0 0 0-4.95l-.6-.55zm-9 9L11 13l-2-2-3.5 3.5a3.5 3.5 0 0 0 4.95 4.95L14 15.95l-2-2-1.55 1.55a1.5 1.5 0 0 1-2.12-2.12l2.47-2.48-1.4-1.4-2.5 2.5a3.5 3.5 0 0 0 0 4.95l.6.55z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // 9. Ecwid
  if (b === "ecwid") {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#0082FF" }}
        title="Ecwid"
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
          <path d="M3 4h2.5l2.6 11h10.4l2-8H6.8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="19" r="2" fill="#FFFFFF" />
          <circle cx="17" cy="19" r="2" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // 10. Connect API / Webhooks / Push
  return (
    <div
      className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
      style={{ width: size, height: size, backgroundColor: "#1D364A" }}
      title="Connect API"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 7l-2 10" stroke="#94B1C8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
