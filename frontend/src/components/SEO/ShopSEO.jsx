import { Helmet } from 'react-helmet-async';

export default function ShopSEO({ shop, product = null }) {
  if (!shop) return null;

  const title = product
    ? `${product.name} - ${shop.shop_name}`
    : `${shop.shop_name} - Premium Online Store`;

  const description = product
    ? product.description?.substring(0, 160) || `Buy ${product.name} from ${shop.shop_name}`
    : shop.shop_description || `Shop at ${shop.shop_name} for quality products`;

  const imageUrl = product?.image_urls?.[0] || shop.shop_logo_url;
  const url = window.location.href;

  return (
    <Helmet>
      {/* Basic meta tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={product ? 'product' : 'website'} />
      <meta property="og:site_name" content={shop.shop_name} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": product ? "Product" : "Store",
          "name": product?.name || shop.shop_name,
          "description": description,
          "image": imageUrl,
          ...(product && {
            "offers": {
              "@type": "Offer",
              "price": product.price,
              "priceCurrency": "NGN",
              "availability": product.quantity_available > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock"
            }
          })
        })}
      </script>
    </Helmet>
  );
}
