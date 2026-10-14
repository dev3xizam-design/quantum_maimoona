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
        style={{ width: size, height: size, backgroundColor: "#95BF47" }}
        title="Shopify"
      >
        <svg width={size * 0.74} height={size * 0.74} viewBox="0 0 24 24" fill="#FFFFFF">
          <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z"/>
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
  if (b === "prestashop" || b === "prestashop-plugin" || b === "prestashop-module" || b.includes("prestashop")) {
    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs transition-transform duration-200 group-hover:scale-105 ${className}`}
        style={{ width: size, height: size, backgroundColor: "#DF0067" }}
        title="PrestaShop"
      >
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 24 24" fill="#FFFFFF">
          <path d="M11.558 1.034C5.174 1.034 0 6.21 0 12.592c0 1.258.201 2.47.574 3.597l.002-.007a12.415 12.415 0 01.53-1.787l.011-.03c.085-.222.179-.442.277-.66l.084-.181c.08-.171.165-.34.253-.507.036-.068.07-.136.108-.203.02-.038.044-.073.064-.11.094-.166.19-.332.29-.493l.075-.114c.125-.195.256-.386.393-.573l.035-.05c.144-.193.295-.38.451-.563l.1-.118c.155-.177.315-.35.481-.517l.099-.097a10.321 10.321 0 01.546-.503c.74-2.48 3.005-4.285 5.686-4.285 1.079 0 2.152.31 3.071.873a6.017 6.017 0 012.211 2.407l.007.015.04.074v.003l.004.002a9.925 9.925 0 011.567 1.198c.04.037.081.071.12.109.002 0 .006.005.007.006l-.002-.006-.001-.004v-.003l.042-.084c.377-2.384 1.43-4.102 2.67-4.102.934 0 1.762.975 2.276 2.476l.005.016.001.002c.145.158.287.331.424.521l.007.01.021.067-.02-.078c-1.542-4.569-5.863-7.857-10.952-7.857zM9.927 5.477C7.586 5.52 5.34 7.132 4.574 9.365l-.012.034a10.14 10.14 0 011.315-.895c2.806-1.656 6.479-1.646 9.278.016-.895-1.653-2.631-2.819-4.5-3.004a5.14 5.14 0 00-.728-.039zm9.834.5a1.36 1.36 0 00-.39.067c-1.265.562-1.719 2.073-2.031 3.303l-.016.072c.365-.62.808-1.215 1.396-1.642.835-.687 2.105-.655 2.916.053.308.326.141.008.031-.22-.342-.75-1.025-1.653-1.906-1.634zM21.67 7.98zm-9.32.335l-1.07 3.27-.002.005-.006.002-4.498 1.112h-.009l4.456 1.087c.105.11.227.205.36.28h.002c.042.024.085.045.129.065l.01.005c.041.018.083.033.126.047l.021.008c.04.013.08.023.12.032l.033.008a1.677 1.677 0 00.318.033 1.546 1.546 0 001.43-.948c.08-.186.123-.39.123-.604v-.011l-.001-.012c-.001-.054-.004-.107-.01-.16l-.001-.002a1.506 1.506 0 00-.026-.153l-.001-.004a1.511 1.511 0 00-.096-.288v-.003a1.521 1.521 0 00-.348-.49v-.003zm3.148.626c.048 1.008.036 2.046-.1 3.057-.17 2.018-1.19 3.798-1.972 5.616l-.03.08-.035.086c1.51-1.522 3.17-3.04 3.969-5.082.383-.636.118-1.342-.115-1.976-.17-.877-1.069-1.278-1.717-1.781zm6.172.572l-.588 2.688a1.764 1.764 0 00-.047.2c-.002.02-.007.04-.01.06a1.76 1.76 0 00-.016.222l-.002.031h.003c0 .628.297 1.136.663 1.137a.41.41 0 00.182-.045l.027-.015a.537.537 0 00.07-.047c.013-.01.024-.022.036-.033a.752.752 0 00.137-.168l.03-.054a1.23 1.23 0 00.052-.108l.017-.04c.02-.053.038-.108.053-.166l.002-.002.001-.003.404-.451-.407-.456v.001l-.02-.063zm-4.381.856c.69 1.716.85 3.707.091 5.43-.49 1.368-1.587 2.463-1.874 3.905.73.115 1.468.176 2.21.186 2.166.029 4.332-.42 6.284-1.365-2.04-2.869-4.121-5.755-6.711-8.156zm-4.948.977a.583.583 0 110 1.166.583.583 0 010-1.166zm9.352.37c.138 0 .249.19.249.426s-.111.426-.249.426c-.137 0-.248-.19-.248-.426 0-.235.11-.426.248-.426zm-4.044.184c-.016.112-.033.209-.05.29l-.006.023c-.01.05-.022.094-.033.128-.48 1.417-1.275 2.52-2.36 3.697-.147.16-.301.32-.459.484a58.883 58.883 0 01-1.196 1.205c-.112.11-.259.261-.425.436-.103.287-.22.61-.318.95-.044-.016-.086-.031-.131-.049-2.108-.815-3.519-1.904-3.519-1.904s1.086 1.414 2.915 2.74c.177.129.351.24.522.339-.075 1.194.452 2.34 2.83 2.682a4.81 4.81 0 001.228.008l-.01-.029a.062.062 0 00-.004-.01s-.167-.133-.379-.377a3.842 3.842 0 01-.584-.897 3.382 3.382 0 01-.266-.862 3.176 3.176 0 01-.006-.972c.017-.12.04-.241.072-.366.093-.374.255-.772.507-1.192l.002-.003.241-.404c1.103-1.86 1.797-3.275 1.506-5.441a8.943 8.943 0 00-.078-.476zm4.668.576zm.013.203l.003.036v.01c0 .013-.003.025-.003.038 0-.014.003-.028.003-.043 0-.014-.002-.026-.003-.04zm-.012.275v.001l-.002.01-.002.014.004-.025zm1.353 5.928c-2.553 1.138-5.44 1.44-8.192 1.007-.14 1.108.384 2.218 1.214 2.93l.012.01c2.703-.433 4.975-2.168 6.966-3.946z" />
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
