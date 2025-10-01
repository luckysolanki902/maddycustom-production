import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";

/**
 * Custom hook to classify the current page type based on URL and cart drawer state.
 * Returns one of: 'viewcart', 'homepage', 'product-list-page', 'product-id-page', 'others'.
 */
export default function usePageType() {
  const pathname = usePathname();
  const isCartDrawerOpen = useSelector(state => state.ui.isCartDrawerOpen);

  if (isCartDrawerOpen) return "viewcart";

  // Remove query params if any (shouldn't be present in pathname, but for safety)
  const cleanPath = pathname.split("?")[0];

  if (cleanPath === "/") return "homepage";

  if (cleanPath.startsWith("/shop")) {
    const slugs = cleanPath.replace(/^\/shop\/?/, "").split("/").filter(Boolean);
    if (slugs.length <= 1) return "product-list-page";
    return "product-id-page";
  }

  return "others";
}
