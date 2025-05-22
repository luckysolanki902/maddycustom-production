import { redirect } from 'next/navigation';

export default function ViewCartPage() {
  // Redirect to home page with the cart drawer open parameter
  redirect('/?openCart=true');
}
