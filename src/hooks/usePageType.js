import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";

/**
 * Custom hook to classify the current page type based on URL and cart drawer state.
 * Returns one of: 'viewcart', 'homepage', 'products-list-page', 'product-id-page', 'others'.
 */
export default function usePageType() {
  const pathname = usePathname();
  const isCartDrawerOpen = useSelector(state => state.ui.isCartDrawerOpen);

  if (isCartDrawerOpen) return "viewcart";

  // Remove query params if any (shouldn't be present in pathname, but for safety)
  const cleanPath = pathname.split("?")[0];

  if (cleanPath === "/") return "homepage";

  if (cleanPath.startsWith("/shop")) {
    // Count slugs after /shop
    const slugs = cleanPath.replace(/^\/shop\/?/, "").split("/").filter(Boolean);
    if (slugs.length === 4) return "products-list-page";
    if (slugs.length === 5) return "product-id-page";
    return "others";
  }

  return "others";
}
